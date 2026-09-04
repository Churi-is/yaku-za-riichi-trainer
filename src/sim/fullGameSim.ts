/**
 * sim/fullGameSim — the deep mode: play the rest of the hand out for real.
 *
 * This module lives outside `src/analysis` on purpose. Analysis is held to an
 * absolute rule — no file in it may even name `GameState` — and this module
 * has to build one. So the rule is not weakened; the code that needs an engine
 * state is moved to a layer of its own whose contract is narrower and
 * mechanically checked: PublicView in, simulated outcomes out, no access to
 * the live game state, no import from @state.
 *
 * PUBLIC-ONLY, and that constraint is what shapes the whole module. The quick
 * advisor (`yakuSim`) asks "could this hand get there?"; this one asks the
 * bigger question — "what actually happens from here?" — by determinizing the
 * position and playing it to the end with the real engine and the real AI
 * opponents, over and over.
 *
 * DETERMINIZATION. The viewer cannot see opponents' hands, so each run deals
 * them fresh from the unseen pool along with the wall and the dead wall. Every
 * run therefore faces a different plausible table that is consistent with
 * everything actually on display: melds, discards, dora, riichi, seat winds,
 * points, and how many tiles each seat is holding. Nothing hidden is read —
 * this module never receives a GameState, it BUILDS one from a PublicView.
 *
 * WHAT THE NUMBER MEANS. Unlike the quick mode, seat 0 is played by the same AI
 * as everyone else, so the result is not "if you commit" but "how these hands
 * finish": three opponents are racing you, folding, calling and winning first.
 * The frequencies are therefore much lower and mean something different —
 * "hands that finished with this yaku", not "yaku you could reach". The UI
 * labels the two modes differently for exactly this reason.
 */
import {
  applyAction, cloneState, createMatch, getLegalActions, kindOf, nextSeat,
  toPublicView, waits,
} from '@engine/index';
import type {
  Action, GameState, PlayerState, PublicView, SeatIndex, TileId, YakuId,
} from '@engine/types';
import { createAI, PERSONALITIES, personalityById, type AIPlayer } from '@ai/index';
import { createRng, nextInt, type Rng } from '@engine/rng';
import { unseenPool } from '@analysis/yakuSim';

export interface FullGameOptions {
  runs: number;
  seed: number;
  /** Called after each run, for progressive UI. */
  onProgress?: (done: number, total: number, partial: FullGameResult) => void;
}

export interface FullGameResult {
  runs: number;
  /** Hands seat 0 won. */
  wins: number;
  /** Hands seat 0 dealt into. */
  dealIns: number;
  /** Hands that ran out of wall. */
  draws: number;
  /** How often each yaku appeared in a hand seat 0 won. */
  yaku: { id: YakuId; hits: number }[];
  /** Mean points won by seat 0 across all runs (0 for hands it did not win). */
  meanPoints: number;
}

const SEATS: SeatIndex[] = [0, 1, 2, 3];

function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

/**
 * Build a playable GameState consistent with everything the viewer can see,
 * inventing only what they cannot. Starting from a real `createMatch` state
 * means no field is ever left undefined when the engine reaches for it.
 */
export function determinize(view: PublicView, rng: Rng): GameState | null {
  const pool = shuffled(unseenPool(view), rng);
  let at = 0;
  const take = (n: number): TileId[] => {
    const out = pool.slice(at, at + n);
    at += n;
    return out;
  };

  const need = SEATS.reduce<number>(
    (n, s) => n + (s === view.viewer ? 0 : view.seats[s].concealedCount), 0,
  ) + view.tilesRemaining;
  if (need > pool.length) return null; // inconsistent view; nothing to simulate

  const base = createMatch(view.settings, (rng() * 0x7fffffff) | 0);
  const players = SEATS.map((s): PlayerState => {
    const pv = view.seats[s];
    const mine = s === view.viewer;
    const hand = mine ? [...view.hand] : take(pv.concealedCount);
    return {
      ...base.players[s],
      seat: s,
      seatWind: pv.seatWind,
      hand,
      drawnTile: mine ? view.drawnTile : null,
      melds: pv.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
      river: pv.river.map((d) => ({ ...d })),
      points: pv.points,
      riichi: pv.riichi,
      doubleRiichi: false,
      riichiTurn: pv.riichiTurn,
      ippatsu: pv.ippatsu,
      furiten: false,
      temporaryFuriten: false,
      riichiFuriten: false,
      isClosed: pv.isClosed,
      forbiddenDiscards: [],
      aiPersonalityId: pv.aiPersonalityId,
    };
  }) as GameState['players'];

  // Own-discard furiten, which the engine would otherwise only notice on its
  // next refresh — getting this wrong would let a simulated seat ron illegally.
  for (const p of players) {
    const w = new Set(waits(p.drawnTile !== null ? p.hand : p.hand, p.melds));
    p.furiten = p.river.some((d) => w.has(kindOf(d.tile)));
  }

  const wall = take(view.tilesRemaining);
  // Whatever is left is the dead wall. The face-up indicators are real; the
  // rest (ura, replacements) are unknowable and so are drawn from the pool.
  const rest = pool.slice(at);
  const deadWall = [...view.doraIndicators, ...rest].slice(0, Math.max(14, view.doraIndicators.length));

  return {
    ...base,
    settings: view.settings,
    handNumber: base.handNumber,
    roundWind: view.roundWind,
    roundNumber: view.roundNumber,
    honba: view.honba,
    riichiSticks: view.riichiSticks,
    dealer: view.dealer,
    turn: view.turn,
    phase: view.phase,
    players,
    wall,
    deadWall,
    doraIndicators: [...view.doraIndicators],
    uraIndicators: rest.slice(-5),
    kanCount: SEATS.reduce<number>(
      (n, s) => n + view.seats[s].melds.filter((m) => m.type !== 'chi' && m.type !== 'pon').length, 0,
    ),
    turnNumber: SEATS.reduce<number>((n, s) => n + view.seats[s].river.length, 0),
    lastDiscard: null,
    callWindow: null,
    rinshanPending: false,
    chankanTile: null,
    paoSeat: null,
    handOver: null,
    matchOver: null,
  };
}

/** Four AIs matching the personalities actually at the table. */
function tableAIs(view: PublicView, seed: number): AIPlayer[] {
  return SEATS.map((s) => {
    const id = view.seats[s].aiPersonalityId;
    const personality = (id ? personalityById(id) : undefined)
      ?? PERSONALITIES[s % PERSONALITIES.length];
    return createAI(personality, view.settings.difficulty, seed + s * 977);
  });
}

/** Drive one determinized hand to its end. */
function playOut(state: GameState, ais: AIPlayer[], limit = 400): GameState {
  let s = state;
  for (let step = 0; step < limit && !s.handOver && !s.matchOver; step++) {
    let acted = false;
    // Seats are polled in turn order from whoever is on turn, so call windows
    // resolve in the same priority the live loop uses.
    let seat = s.turn;
    for (let i = 0; i < 4; i++) {
      const legal = getLegalActions(s, seat);
      if (legal.length > 0) {
        let action: Action;
        try {
          action = ais[seat].decide(toPublicView(s, seat), legal).action;
        } catch {
          action = legal[0].action;
        }
        try {
          s = applyAction(s, action);
        } catch {
          return s; // an inconsistent determinization: abandon this run
        }
        acted = true;
        break;
      }
      seat = nextSeat(seat);
    }
    if (!acted) break;
  }
  return s;
}

/**
 * Play the rest of the hand `runs` times from independently determinized
 * tables and report what actually happened.
 */
export function simulateFullGames(
  view: PublicView, opts: FullGameOptions,
): FullGameResult {
  const rng = createRng(opts.seed);
  const ais = tableAIs(view, opts.seed);
  const tally = new Map<YakuId, number>();
  const result: FullGameResult = {
    runs: 0, wins: 0, dealIns: 0, draws: 0, yaku: [], meanPoints: 0,
  };
  let points = 0;
  let completed = 0;

  for (let r = 0; r < opts.runs; r++) {
    const start = determinize(view, rng);
    if (!start) break;
    const done = playOut(cloneState(start), ais);
    completed++;
    const over = done.handOver;
    if (over) {
      if (over.winner === view.viewer && over.score) {
        result.wins++;
        points += over.score.points;
        for (const y of new Set(over.score.yaku.map((h) => h.id as YakuId))) {
          tally.set(y, (tally.get(y) ?? 0) + 1);
        }
      } else if (over.loser === view.viewer) {
        result.dealIns++;
      } else if (over.reason === 'exhaustiveDraw') {
        result.draws++;
      }
    }
    result.runs = completed;
    result.meanPoints = points / completed;
    result.yaku = [...tally.entries()]
      .map(([id, hits]) => ({ id, hits }))
      .sort((a, b) => b.hits - a.hits);
    opts.onProgress?.(completed, opts.runs, result);
  }
  return result;
}
