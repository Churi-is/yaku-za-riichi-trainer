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
  type Difficulty,
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

  it('difficulty separation: the same seat plays better on hard than on easy', () => {
    // The original version compared how many hands each same-strength FIELD
    // resolved to a win, which is not a strength measure at all: a stronger
    // player folds more, so a strong field draws MORE hands. It sat one win
    // from failing and finally did.
    //
    // This is a paired experiment instead. The field is three normal bots and
    // the wall comes from the same seeds in both arms; the only thing that
    // changes between arm A and arm B is seat 0's difficulty. Placement is the
    // measure rather than raw points, because points in mahjong have a tail
    // that a small sample cannot see past.
    const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 132, 143, 154, 165, 176, 187, 198];

    const meanPlacement = (seatDiff: Difficulty): number => {
      let total = 0;
      let illegal = 0;
      for (const seed of SEEDS) {
        const bots = [0, 1, 2, 3].map((s) =>
          createAI(makePersonality('balanced'), s === 0 ? seatDiff : 'normal', seed * 10 + s));
        const r = playMatchWith(bots, seed);
        illegal += r.illegal + r.throws;
        const mine = r.finalPoints[0];
        // 1st = 1, 4th = 4.
        const place = 1 + ([1, 2, 3] as SeatIndex[]).filter((s) => r.finalPoints[s] > mine).length;
        total += place;
      }
      expect(illegal).toBe(0);
      return total / SEEDS.length;
    };

    const hard = meanPlacement('hard');
    const easy = meanPlacement('easy');
    // eslint-disable-next-line no-console
    console.log(`mean placement in a normal field — hard seat ${hard.toFixed(2)}, easy seat ${easy.toFixed(2)}`);
    // Lower placement is better. The gap is generous because eighteen matches
    // is still a small sample, but the sign has to be right.
    expect(hard).toBeLessThan(easy);
  }, 180_000);
});
