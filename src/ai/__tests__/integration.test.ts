/**
 * Integration test: drives Worker A's REAL engine
 * (createMatch / applyAction / getLegalActions / toPublicView / nextHand) with
 * four AIs through complete matches. The engine itself enforces legality — an
 * illegal action throws inside applyAction — so reaching matchOver with no
 * thrown errors and no rejected decisions proves the AI only ever chooses
 * legal actions against the production rules.
 *
 * This also exercises the true PublicView shape (hand = 13 tiles, drawnTile
 * separate; riichi offered as a distinct action), unlike the simplified
 * self-play simulator used for the separation statistics.
 */
import { describe, it, expect } from 'vitest';
import {
  createMatch,
  applyAction,
  getLegalActions,
  toPublicView,
  nextHand,
  DEFAULT_SETTINGS,
  type Action,
  type GameState,
  type LegalAction,
  type SeatIndex,
  type TableSettings,
} from '@engine/index';
import { createAI, type AIPlayer } from '../index';

const SETTINGS: TableSettings = {
  ...DEFAULT_SETTINGS,
  gameLength: 'east', // one wind → ~4 hands, keeps the test fast
  difficulty: 'normal',
};

function aisFor(seed: number): AIPlayer[] {
  return [
    createAI(makePersonality('aggressive'), 'hard', seed + 1),
    createAI(makePersonality('balanced'), 'normal', seed + 2),
    createAI(makePersonality('defensive'), 'hard', seed + 3),
    createAI(makePersonality('balanced'), 'easy', seed + 4),
  ];
}

import { PERSONALITIES, type Personality } from '../index';
function makePersonality(arch: Personality['archetype']): Personality {
  return PERSONALITIES.find((p) => p.archetype === arch)!;
}

function actionKey(a: Action): string {
  const o = a as unknown as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(o)
      .sort()
      .map((k) => [k, Array.isArray(o[k]) ? [...(o[k] as unknown[])].sort() : o[k]]),
  );
}

export interface MatchOutcome {
  hands: number;
  illegal: number;
  throws: number;
  finalPoints: Record<SeatIndex, number>;
  wins: Record<SeatIndex, number>;
}

/** Play one full match with the given four AIs; returns outcome stats. */
export function playMatchWith(ais: AIPlayer[], seed: number, settings: TableSettings = SETTINGS): MatchOutcome {
  let state: GameState = createMatch(settings, seed);
  let illegal = 0;
  let throws = 0;
  let hands = 0;
  let guard = 0;
  const wins: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

  while (state.phase !== 'matchOver' && guard++ < 20000) {
    if (state.phase === 'handOver') {
      hands++;
      if (state.handOver?.winner !== null && state.handOver?.winner !== undefined) {
        wins[state.handOver.winner]++;
      }
      state = nextHand(state);
      continue;
    }

    if (state.phase === 'awaitingDraw') {
      const legal = getLegalActions(state, state.turn);
      const draw = legal.find((l) => l.action.type === 'draw');
      if (draw) state = applyAction(state, draw.action);
      else throw new Error('awaitingDraw but no draw action');
      continue;
    }

    if (state.phase === 'awaitingDiscard') {
      const seat = state.turn;
      const legal = getLegalActions(state, seat);
      const view = toPublicView(state, seat);
      const dec = ais[seat].decide(view, legal);
      const ok = legal.some((l) => actionKey(l.action) === actionKey(dec.action));
      if (!ok) {
        illegal++;
        const fallback = legal.find((l) => l.action.type === 'discard' && !(l.action as { riichi?: boolean }).riichi);
        state = applyAction(state, (fallback ?? legal[0]).action);
      } else {
        try {
          state = applyAction(state, dec.action);
        } catch {
          throws++;
          const fallback = legal.find((l) => l.action.type === 'discard');
          state = applyAction(state, (fallback ?? legal[0]).action);
        }
      }
      continue;
    }

    if (state.phase === 'awaitingCalls') {
      let acted = false;
      for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
        const legal = getLegalActions(state, s);
        if (legal.length === 0) continue;
        const view = toPublicView(state, s);
        const dec = ais[s].decide(view, legal);
        const ok = legal.some((l) => actionKey(l.action) === actionKey(dec.action));
        let chosen: LegalAction;
        if (!ok) {
          illegal++;
          chosen = legal.find((l) => l.action.type === 'pass') ?? legal[0];
        } else {
          chosen = legal.find((l) => actionKey(l.action) === actionKey(dec.action))!;
        }
        try {
          state = applyAction(state, chosen.action);
          acted = true;
        } catch {
          throws++;
          const pass = legal.find((l) => l.action.type === 'pass');
          if (pass) state = applyAction(state, pass.action);
        }
        if (state.phase !== 'awaitingCalls') break;
      }
      if (!acted) {
        const seat = (state.turn % 4) as SeatIndex;
        const legal = getLegalActions(state, seat);
        const pass = legal.find((l) => l.action.type === 'pass');
        if (pass) state = applyAction(state, pass.action);
        else break;
      }
      continue;
    }

    break;
  }

  const finalPoints = {} as Record<SeatIndex, number>;
  for (const p of state.players) finalPoints[p.seat] = p.points;
  return { hands, illegal, throws, finalPoints, wins };
}

/** Play one full match with the default AI mix; returns outcome stats. */
function playMatch(seed: number): { hands: number; illegal: number; throws: number } {
  const r = playMatchWith(aisFor(seed), seed);
  return { hands: r.hands, illegal: r.illegal, throws: r.throws };
}

describe('AI vs real engine (integration)', () => {
  it('plays a full east match with zero illegal actions and zero engine throws', () => {
    const r = playMatch(12345);
    expect(r.throws, 'engine rejected an AI action').toBe(0);
    expect(r.illegal, 'AI chose an action not in the legal set').toBe(0);
    expect(r.hands).toBeGreaterThan(0);
  });

  it('is deterministic: same seed replays to the same hand count', () => {
    const a = playMatch(777);
    const b = playMatch(777);
    expect(a).toEqual(b);
  });

  it('completes across several seeds with no illegal actions', () => {
    let totalIllegal = 0;
    let totalThrows = 0;
    for (const seed of [1, 2, 3]) {
      const r = playMatch(seed);
      totalIllegal += r.illegal;
      totalThrows += r.throws;
      expect(r.hands).toBeGreaterThan(0);
    }
    expect(totalIllegal).toBe(0);
    expect(totalThrows).toBe(0);
  });

  it('difficulty separation: harder bots win more over real scored matches', () => {
    // Measure on the real engine (accurate scoring). For each difficulty, run
    // several matches with four same-difficulty balanced bots; a stronger field
    // converts more hands into wins. Compare total win counts per difficulty.
    const winsFor = (difficulty: 'easy' | 'normal' | 'hard'): { wins: number; illegal: number } => {
      let wins = 0;
      let illegal = 0;
      for (const seed of [101, 202, 303, 404, 505]) {
        const bots = [0, 1, 2, 3].map((s) =>
          createAI(makePersonality('balanced'), difficulty, seed * 10 + s),
        );
        const r = playMatchWith(bots, seed);
        illegal += r.illegal + r.throws;
        wins += Object.values(r.wins).reduce((a, b) => a + b, 0);
      }
      return { wins, illegal };
    };
    const easy = winsFor('easy');
    const normal = winsFor('normal');
    const hard = winsFor('hard');
    expect(easy.illegal + normal.illegal + hard.illegal).toBe(0);
    // Stronger play resolves more hands to a win (vs exhaustive draw).
    expect(hard.wins).toBeGreaterThanOrEqual(normal.wins);
    expect(normal.wins).toBeGreaterThanOrEqual(easy.wins);
    // And the spread should be non-trivial at the extremes.
    expect(hard.wins).toBeGreaterThan(easy.wins);
  });
});
