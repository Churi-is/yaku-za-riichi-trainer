/**
 * Match game loop (Worker D). Drives one match: deal → turns → calls → hand end
 * → next hand → match over, while recording the replay log and running the AI.
 *
 * Design goals from the brief:
 *  - AI seats decide from ONLY toPublicView(state, seat) + getLegalActions.
 *  - Every action is logged; human actions carry viewBefore = human public view.
 *  - AI turns are paced with a short delay; the UI thread never blocks.
 *  - The loop is guarded against a throwing engine (the adapter handles that).
 *  - Human seat (0) surfaces legal actions as UI options and waits.
 *
 * Exposed as a zustand store so the MatchScreen can render reactively; the
 * async pump lives here, off React's render path.
 */
import { create } from 'zustand';
import {
  createAI, PERSONALITIES, type AIPlayer,
} from '@ai/index';
import type {
  Action, GameState, HandResult, LegalAction, MatchResult, PublicView,
  SeatIndex, TableSettings, TileId, TileKind,
} from '@engine/types';
import {
  applyAction, createMatch, getLegalActions, nextHand, pendingSeats, toPublicView,
} from './engineAdapter';
import { resolveWaitGuesses } from './analysisAdapter';
import { MatchLogBuilder } from '@replay/log';
import type { WaitGuessRecord } from '@analysis/types';
import { kindOf, waitsIds } from './mahjong';

export interface SeatPersonality {
  seat: SeatIndex;
  id: string;
  name: string;
  tagline: string;
}

export interface HandEndBanner {
  result: HandResult;
  roundLabel: string;
}

export interface WaitPracticePrompt {
  seat: SeatIndex;
  /** Deadline: resolve before this opponent's next discard. */
  active: boolean;
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
  /** Practice-mode: pending wait-guess prompts by seat. */
  practicePrompts: WaitPracticePrompt[];
  /** Recorded wait guesses this match (live, before resolution). */
  waitGuesses: WaitGuessRecord[];
  message: string | null;

  // actions
  start: (settings: TableSettings, seed?: number) => void;
  humanAct: (action: Action) => void;
  advanceHand: () => void;
  submitWaitGuess: (seat: SeatIndex, kinds: TileKind[]) => void;
  dismissPractice: (seat: SeatIndex) => void;
  finish: () => void; // finalize -> returns log via getter
  reset: () => void;
}

const AI_MIN_DELAY = 420;
const AI_MAX_DELAY = 780;

// Module-scoped, non-reactive controller data (avoids re-render churn).
let ais: Record<number, AIPlayer> = {};
let logBuilder: MatchLogBuilder | null = null;
let pumpToken = 0; // invalidates in-flight timers when we reset/restart
let handCounter = 0;
let riichiSeen: Set<number> = new Set();

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

export const getLogBuilder = (): MatchLogBuilder | null => logBuilder;

export const useMatch = create<MatchStore>((set, get) => ({
  state: null,
  view: null,
  humanLegal: [],
  aiThinking: false,
  seatPersonalities: [],
  handEnd: null,
  matchResult: null,
  practicePrompts: [],
  waitGuesses: [],
  message: null,

  start(settings, seed) {
    pumpToken++;
    const token = pumpToken;
    handCounter = 0;
    riichiSeen = new Set();
    logBuilder = new MatchLogBuilder(settings);

    let state = createMatch(settings, seed);

    // Assign personalities to seats 1..3 (seat 0 is always human).
    const seatPersonalities: SeatPersonality[] = [];
    ais = {};
    for (let seat = 1 as SeatIndex; seat < 4; seat = (seat + 1) as SeatIndex) {
      const personality = PERSONALITIES[(seat - 1) % PERSONALITIES.length];
      state.players[seat].aiPersonalityId = personality.id;
      ais[seat] = createAI(personality, settings.difficulty, (seed ?? 1) + seat);
      seatPersonalities.push({ seat, id: personality.id, name: personality.name, tagline: personality.tagline });
    }

    beginHandLog(state);

    set({
      state,
      view: toPublicView(state, 0),
      humanLegal: [],
      aiThinking: false,
      seatPersonalities,
      handEnd: null,
      matchResult: null,
      practicePrompts: [],
      waitGuesses: [],
      message: null,
    });

    // Kick the pump.
    void pump(token, get, set);
  },

  humanAct(action) {
    const { state } = get();
    if (!state) return;
    const view = toPublicView(state, 0);
    let next = applyAction(state, action);
    logBuilder?.record(0, action, view);
    afterApply(next, action);
    commit(next, set, get);
    // resume the pump after a human action
    const token = pumpToken;
    void pump(token, get, set);
  },

  advanceHand() {
    const { state } = get();
    if (!state) return;
    if (state.phase !== 'handOver') return;
    // finalize wait guesses for the just-finished hand using revealed hands
    resolveHandWaitGuesses(state.handOver, set, get);
    let next = nextHand(state);
    if (next.matchOver) {
      finalizeMatch(next, set);
      return;
    }
    beginHandLog(next);
    set({ handEnd: null, practicePrompts: [] });
    commit(next, set, get);
    const token = pumpToken;
    void pump(token, get, set);
  },

  submitWaitGuess(seat, kinds) {
    const { state } = get();
    if (!state) return;
    const record: WaitGuessRecord = {
      handId: handCounter,
      seat,
      submittedKinds: kinds,
      actualWaits: null,
      correct: null,
    };
    logBuilder?.addWaitGuess(record);
    set((st) => ({
      waitGuesses: [...st.waitGuesses, record],
      practicePrompts: st.practicePrompts.map((p) => (p.seat === seat ? { ...p, active: false } : p)),
    }));
  },

  dismissPractice(seat) {
    set((st) => ({ practicePrompts: st.practicePrompts.map((p) => (p.seat === seat ? { ...p, active: false } : p)) }));
  },

  finish() {
    const { state } = get();
    if (state && !state.matchOver) {
      // finalize whatever we have
      logBuilder?.setWaitGuesses(get().waitGuesses);
    }
  },

  reset() {
    pumpToken++;
    ais = {};
    logBuilder = null;
    set({
      state: null, view: null, humanLegal: [], aiThinking: false,
      seatPersonalities: [], handEnd: null, matchResult: null,
      practicePrompts: [], waitGuesses: [], message: null,
    });
  },
}));

// --- internals -------------------------------------------------------------

function beginHandLog(state: GameState) {
  handCounter += 1;
  logBuilder?.beginHand({
    handId: handCounter,
    roundWind: state.roundWind,
    roundNumber: state.roundNumber,
    honba: state.honba,
    dealer: state.dealer,
  });
}

function commit(next: GameState, set: (p: Partial<MatchStore>) => void, get: () => MatchStore) {
  const humanLegal = safeLegal(next, 0);
  set({
    state: next,
    view: toPublicView(next, 0),
    humanLegal,
  });
  detectRiichiForPractice(next, set, get);
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

function afterApply(state: GameState, _action: Action) {
  if (state.phase === 'handOver' && state.handOver) {
    logBuilder?.endHand(state.handOver);
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
      await stepApply(token, get, set, seat, decided, null);
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
      await stepApply(token, get, set, seat, draw.action, null);
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
    await stepApply(token, get, set, seat, decided, null);
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
  _viewOverride: PublicView | null,
) {
  const state = get().state;
  if (!state) return;
  // Snapshot human view before the action for the log (grading needs it).
  const humanViewBefore = toPublicView(state, 0);
  let next: GameState;
  try {
    next = applyAction(state, action);
  } catch {
    // engine threw unexpectedly: end the pump gracefully
    set({ aiThinking: false, message: 'The engine hit an error; pausing the hand.' });
    return;
  }
  logBuilder?.record(seat, action, seat === 0 ? humanViewBefore : humanViewBefore);
  afterApply(next, action);
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
    handsPlayed: logBuilder?.getHands().length ?? state.matchOver?.handsPlayed ?? 0,
  };
  logBuilder?.setWaitGuesses(useMatch.getState().waitGuesses);
  set({ matchResult: result, aiThinking: false, humanLegal: [], state, handEnd: null });
}

// --- practice-mode wait guessing ------------------------------------------

function detectRiichiForPractice(state: GameState, set: (p: Partial<MatchStore>) => void, get: () => MatchStore) {
  // When an opponent newly declares riichi, and practice mode is active (the UI
  // decides whether to surface it), create a prompt to guess before their next
  // discard. We record the "newly riichi" fact; the panel reads practicePrompts.
  const prompts = get().practicePrompts;
  const updated = [...prompts];
  for (let seat = 1 as SeatIndex; seat < 4; seat = (seat + 1) as SeatIndex) {
    const p = state.players[seat];
    if (p.riichi && !riichiSeen.has(seat)) {
      riichiSeen.add(seat);
      if (!updated.some((x) => x.seat === seat)) {
        updated.push({ seat, active: true });
      }
    }
  }
  if (updated.length !== prompts.length) set({ practicePrompts: updated });
}

function resolveHandWaitGuesses(handOver: HandResult | null, set: (p: Partial<MatchStore>) => void, get: () => MatchStore) {
  if (!handOver) return;
  const guesses = get().waitGuesses;
  if (guesses.length === 0) return;
  const revealed = handOver.revealedHands;
  const updated = guesses.map((g) => {
    if (g.correct !== null) return g;
    const hand = revealed[g.seat];
    if (!hand) return g;
    // compute true waits from the revealed concealed hand (public at reveal time)
    // account for melds: we don't have them here, assume 0 for reveal simplicity
    const actual = computeActualWaits(hand);
    const correct = actual.length > 0 && g.submittedKinds.some((k) => actual.includes(k));
    return { ...g, actualWaits: actual, correct: actual.length ? correct : null };
  });
  set({ waitGuesses: updated });
  logBuilder?.setWaitGuesses(updated);
}

function computeActualWaits(hand: TileId[]): TileKind[] {
  // Determine tenpai waits from a concealed hand of length 13 (or 13-3*melds).
  // We approximate meld count from hand length: (13 - len)/3 assuming standard.
  const meldCount = Math.max(0, Math.round((13 - hand.length) / 3));
  try {
    return waitsIds(hand, meldCount);
  } catch {
    return [];
  }
}

// silence unused import in some build modes
void kindOf;
export type { TileId };
