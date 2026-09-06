/**
 * Match game loop. Drives one match: deal → turns → calls → hand end → next
 * hand → match over, while running the AI.
 *
 * Design goals:
 *  - AI seats decide from ONLY toPublicView(state, seat) + getLegalActions.
 *  - AI turns are paced with a short delay; the UI thread never blocks.
 *  - The loop is guarded against a throwing engine (the adapter handles that).
 *  - Human seat (0) surfaces legal actions as UI options and waits.
 *  - Nothing advances while the pause menu is open or the pre-match intro is
 *    still on screen: the pump gates on both flags so "Paused" really is, and
 *    "Deal" really starts the deal flow.
 *
 * Exposed as a zustand store so the MatchScreen can render reactively; the
 * async pump lives here, off React's render path.
 */
import { create } from 'zustand';
import {
  createAI, DEFAULT_OPPONENTS, personalityById, opponentDifficulty, type AIPlayer, type SpecialPersonality,
} from '@ai/index';
import type {
  Action, GameState, HandResult, LegalAction, MatchResult, PublicView,
  SeatIndex, TableSettings, TileId, TileKind, Difficulty,
} from '@engine/types';
import { completeOpponents } from './opponents';
import {
  applyAction, createMatch, getLegalActions, nextHand, pendingSeats, toPublicView,
} from './engineAdapter';

export interface SeatPersonality {
  seat: SeatIndex;
  id: string;
  name: string;
  tagline: string;
  title: string;
  tell: string;
  difficulty: Difficulty;
  special?: SpecialPersonality;
}

export interface HandEndBanner {
  result: HandResult;
  roundLabel: string;
}


interface MatchStore {
  state: GameState | null;
  /** Human seat's current public view (recomputed each state change). */
  view: PublicView | null;
  /** Legal actions for the human right now (empty when it's not their turn). */
  humanLegal: LegalAction[];
  /** True while an AI turn is being paced (for subtle "thinking" UI). */
  aiThinking: boolean;
  seatPersonalities: SeatPersonality[];
  handEnd: HandEndBanner | null;
  matchResult: MatchResult | null;
  /** Pause menu open: the pump is stopped until it closes. */
  paused: boolean;
  /** Pre-match intro on screen: the pump waits for "Deal". */
  introDismissed: boolean;
  /** Engine error message, when the guard caught a throw mid-hand. */
  message: string | null;

  // actions
  start: (settings: TableSettings, seed?: number, opponents?: readonly (string | null)[]) => void;
  humanAct: (action: Action) => void;
  advanceHand: () => void;
  setPaused: (paused: boolean) => void;
  dismissIntro: () => void;
  reset: () => void;
}

const AI_MIN_DELAY = 420;
const AI_MAX_DELAY = 780;

// Module-scoped, non-reactive controller data (avoids re-render churn).
let ais: Record<number, AIPlayer> = {};
let pumpToken = 0; // invalidates in-flight timers when we reset/restart
let handCounter = 0;

function roundLabel(state: GameState): string {
  const wind = state.roundWind[0].toUpperCase() + state.roundWind.slice(1);
  return `${wind} ${state.roundNumber} · Honba ${state.honba}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function randDelay(): number {
  return AI_MIN_DELAY + Math.floor(Math.random() * (AI_MAX_DELAY - AI_MIN_DELAY));
}


export const useMatch = create<MatchStore>((set, get) => ({
  state: null,
  view: null,
  humanLegal: [],
  aiThinking: false,
  seatPersonalities: [],
  handEnd: null,
  matchResult: null,
  paused: false,
  introDismissed: false,
  message: null,

  start(settings, seed, opponents) {
    pumpToken++;
    const token = pumpToken;
    handCounter = 0;

    let state = createMatch(settings, seed);

    // Seat the three opponents the player picked (seat 0 is always human).
    const chosen = completeOpponents(opponents ?? DEFAULT_OPPONENTS).map(personalityById);
    const seatPersonalities: SeatPersonality[] = [];
    ais = {};
    for (let seat = 1 as SeatIndex; seat < 4; seat = (seat + 1) as SeatIndex) {
      const personality = chosen[seat - 1];
      const difficulty = opponentDifficulty(personality, settings);
      state.players[seat].aiPersonalityId = personality.id;
      ais[seat] = createAI(personality, difficulty, (seed ?? 1) + seat);
      seatPersonalities.push({
        seat, id: personality.id, name: personality.name, tagline: personality.tagline,
        title: personality.title, tell: personality.tell, difficulty, special: personality.special,
      });
    }

    set({
      state,
      view: toPublicView(state, 0),
      humanLegal: [],
      aiThinking: false,
      seatPersonalities,
      handEnd: null,
      matchResult: null,
      paused: false,
      introDismissed: false,
      message: null,
    });

    // Kick the pump; it holds while the intro card is on screen.
    void pump(token, get, set);
  },

  humanAct(action) {
    const { state, paused, introDismissed } = get();
    if (!state || paused || !introDismissed) return;
    let next = applyAction(state, action);
    commit(next, set, get);
    // resume the pump after a human action
    const token = pumpToken;
    void pump(token, get, set);
  },

  advanceHand() {
    const { state } = get();
    if (!state) return;
    if (state.phase !== 'handOver') return;
    const next = nextHand(state);
    if (next.matchOver) {
      finalizeMatch(next, set);
      return;
    }
    set({ handEnd: null });
    commit(next, set, get);
    const token = pumpToken;
    void pump(token, get, set);
  },

  setPaused(paused) {
    if (get().paused === paused) return;
    set({ paused, aiThinking: false });
    if (paused) {
      // Invalidate every in-flight AI step: opening the menu stops the table.
      pumpToken++;
    } else {
      // Resume on a fresh token; the human is never mid-decision across a pause.
      const token = ++pumpToken;
      void pump(token, get, set);
    }
  },

  dismissIntro() {
    if (get().introDismissed) return;
    set({ introDismissed: true });
    const token = pumpToken;
    void pump(token, get, set);
  },

  reset() {
    pumpToken++;
    ais = {};
    set({
      state: null, view: null, humanLegal: [], aiThinking: false,
      seatPersonalities: [], handEnd: null, matchResult: null,
      paused: false, introDismissed: false, message: null,
    });
  },
}));

// --- internals -------------------------------------------------------------

function commit(next: GameState, set: (p: Partial<MatchStore>) => void, get: () => MatchStore) {
  // A clean state after a handled step clears any earlier engine-error notice.
  const humanLegal = safeLegal(next, 0);
  set({
    state: next,
    view: toPublicView(next, 0),
    humanLegal,
    message: null,
  });
}

/**
 * Legal actions for a seat right now.
 * `pendingSeats` only reports seats during an open CALL window; on a plain
 * draw/discard turn the seat to act is `state.turn`, so gate on phase too —
 * otherwise the loop never surfaces discard options and the table stalls.
 */
function safeLegal(state: GameState, seat: SeatIndex): LegalAction[] {
  try {
    if (state.phase === 'awaitingCalls') {
      if (!pendingSeats(state).includes(seat)) return [];
      return getLegalActions(state, seat);
    }
    if ((state.phase === 'awaitingDraw' || state.phase === 'awaitingDiscard') && state.turn === seat) {
      return getLegalActions(state, seat);
    }
    return [];
  } catch {
    return [];
  }
}

/** The async pump: advances AI seats until it's the human's turn or hand ends. */
async function pump(token: number, get: () => MatchStore, set: (p: Partial<MatchStore>) => void) {
  // Loop until we hand control to the human or the hand/match ends.
  // Each iteration handles exactly one pending decision.
  // Guarded so a throwing engine can't crash the app.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (token !== pumpToken) return; // superseded
    if (get().paused) return; // pause menu open: the table stays exactly as-is
    if (!get().introDismissed) return; // intro on screen: "Deal" starts play
    const state = get().state;
    if (!state) return;

    if (state.matchOver) { finalizeMatch(state, set); return; }
    if (state.phase === 'handOver') {
      set({ aiThinking: false, humanLegal: [] });
      showHandEnd(state, set);
      return;
    }

    // 1. An open call window: those seats act first (ron / pon / chi / kan / pass).
    let pend: SeatIndex[] = [];
    try { pend = pendingSeats(state); } catch { pend = []; }

    if (pend.length > 0) {
      if (pend.includes(0)) {
        // Hand control to the human for the call decision.
        set({ aiThinking: false, humanLegal: safeLegal(state, 0) });
        return;
      }
      const seat = pend[0];
      set({ aiThinking: true });
      await delay(randDelay());
      if (token !== pumpToken) return;
      const decided = decideAI(state, seat);
      await stepApply(token, get, set, seat, decided);
      continue;
    }

    // 2. No call window: the turn seat draws, then discards.
    const seat = state.turn;
    if (state.phase !== 'awaitingDraw' && state.phase !== 'awaitingDiscard') return;

    if (state.phase === 'awaitingDraw') {
      const draw = safeLegal(state, seat).find((l) => l.action.type === 'draw');
      if (!draw) return;
      if (seat !== 0) {
        set({ aiThinking: true });
        await delay(randDelay());
        if (token !== pumpToken) return;
      }
      await stepApply(token, get, set, seat, draw.action);
      continue;
    }

    // awaitingDiscard: human gets the buttons; AI decides.
    if (seat === 0) {
      set({ aiThinking: false, humanLegal: safeLegal(state, 0) });
      return;
    }
    set({ aiThinking: true });
    await delay(randDelay());
    if (token !== pumpToken) return;
    const decided = decideAI(state, seat);
    await stepApply(token, get, set, seat, decided);
  }
}

function decideAI(state: GameState, seat: SeatIndex): Action {
  const legal = safeLegal(state, seat);
  if (legal.length === 0) return { type: 'pass', seat };
  const ai = ais[seat];
  if (!ai) {
    // no AI wired: prefer pass, else draw, else first
    const pass = legal.find((l) => l.action.type === 'pass');
    const draw = legal.find((l) => l.action.type === 'draw');
    return (pass ?? draw ?? legal[0]).action;
  }
  try {
    const view = toPublicView(state, seat);
    const decision = ai.decide(view, legal);
    // validate the AI returned a legal action; else fall back
    const ok = legal.some((l) => sameAction(l.action, decision.action));
    if (ok) return decision.action;
  } catch {
    /* fall through to safe default */
  }
  const pass = legal.find((l) => l.action.type === 'pass');
  const draw = legal.find((l) => l.action.type === 'draw');
  const discard = legal.find((l) => l.action.type === 'discard');
  return (pass ?? draw ?? discard ?? legal[0]).action;
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

async function stepApply(
  token: number,
  get: () => MatchStore,
  set: (p: Partial<MatchStore>) => void,
  seat: SeatIndex,
  action: Action,
) {
  void seat;
  const state = get().state;
  if (!state) return;
  let next: GameState;
  try {
    next = applyAction(state, action);
  } catch {
    // Engine threw unexpectedly: stop the pump and surface it instead of
    // silently swallowing it. The pause menu is the way back to the menu.
    pumpToken++;
    set({
      aiThinking: false, humanLegal: [],
      message: 'Something went wrong in the rules engine — the hand is paused. Quit to the menu and start another match.',
    });
    return;
  }
  if (token !== pumpToken) return;
  commit(next, set, get);
  // brief settle so consecutive AI discards are legible
  await delay(90);
}

function showHandEnd(state: GameState, set: (p: Partial<MatchStore>) => void) {
  if (!state.handOver) return;
  set({ handEnd: { result: state.handOver, roundLabel: roundLabel(state) } });
}

function finalizeMatch(state: GameState, set: (p: Partial<MatchStore>) => void) {
  // Recompute an accurate ranking from accumulated points (fallback match
  // handsPlayed is 0; the summary uses the log anyway).
  const finalPoints: Record<number, number> = {};
  for (let s = 0; s < 4; s++) finalPoints[s] = state.players[s].points;
  const ranking = ([0, 1, 2, 3] as SeatIndex[]).sort((a, b) => finalPoints[b] - finalPoints[a]);
  const result: MatchResult = {
    ranking,
    finalPoints: finalPoints as Record<SeatIndex, number>,
    handsPlayed: state.matchOver?.handsPlayed ?? handCounter,
  };
  set({ matchResult: result, aiThinking: false, humanLegal: [], state, handEnd: null });
}
