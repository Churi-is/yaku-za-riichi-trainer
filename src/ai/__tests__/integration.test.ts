/** Full-match AI integration, using the same strict engine driver as the benchmarks. */
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '@engine/index';
import type { Difficulty, TableSettings } from '@engine/types';
import { createAI, PERSONALITIES, SPECIAL_PERSONALITIES, type AIPlayer, type Personality } from '../index';
import { playMatch as playMatchWith } from './selfplay';

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

function makePersonality(arch: Personality['archetype']): Personality {
  return PERSONALITIES.find((p) => p.archetype === arch)!;
}

function playMatch(seed: number) {
  return playMatchWith(aisFor(seed), seed);
}

describe('AI vs real engine (integration)', () => {
  it('plays a full east match with zero illegal actions and zero engine throws', () => {
    const r = playMatch(12345);
    expect(r.ranking).toHaveLength(4);
    expect(r.handsPlayed).toBeGreaterThan(0);
  });

  it('plays every named character at native strength through real matches and rule variants', () => {
    for (let offset = 0; offset < PERSONALITIES.length; offset += 4) {
      const bots = Array.from({ length: 4 }, (_, seat) => {
        const p = PERSONALITIES[(offset + seat) % PERSONALITIES.length];
        return createAI(p, p.difficulty, 600 + offset + seat);
      });
      const result = playMatchWith(bots, 600 + offset, {
        ...SETTINGS, redDora: offset % 8 === 0, kuitan: offset % 8 !== 0,
        twoHanMinimum: offset === 8,
      });
      expect(result.ranking, `roster group ${offset}: completed match`).toHaveLength(4);
      expect(result.handsPlayed).toBeGreaterThan(0);
    }
  }, 120_000);

  it('completes all-Special tables, including legal declined wins, under both rule variants', () => {
    for (const strict of [false, true]) {
      const bots = SPECIAL_PERSONALITIES.map((p, i) => createAI(p, p.difficulty, 871 + i));
      const result = playMatchWith(bots, strict ? 882 : 881, {
        ...SETTINGS, kuitan: !strict, redDora: !strict, twoHanMinimum: strict,
      });
      expect(result.ranking).toHaveLength(4);
      expect(result.handsPlayed).toBeGreaterThan(0);
      expect(result.wins[0]).toBe(0); // Nugget never voluntarily accepts a win.
    }
  }, 120_000);

  it('is deterministic: same seed replays to the same complete result', () => {
    const a = playMatch(777);
    const b = playMatch(777);
    expect(a).toEqual(b);
  });

  it('completes across several seeds with no illegal actions', () => {
    for (const seed of [1, 2, 3]) {
      const r = playMatch(seed);
      expect(r.ranking).toHaveLength(4);
      expect(r.handsPlayed).toBeGreaterThan(0);
    }
  });

  it('difficulty separation: the same seat plays better on hard than on easy', () => {
    // Paired experiment: three normal opponents and the same wall seeds in
    // both arms; only seat 0's difficulty changes. All-Hard vs all-Easy table
    // win counts confound defense with strength. Placement also avoids the
    // heavy-tailed payouts that make raw points unreliable in a small sample.
    const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 132, 143, 154, 165, 176, 187, 198];

    const meanPlacement = (seatDiff: Difficulty): number => {
      let total = 0;
      for (const seed of SEEDS) {
        const bots = [0, 1, 2, 3].map((s) =>
          createAI(makePersonality('balanced'), s === 0 ? seatDiff : 'normal', seed * 10 + s));
        const r = playMatchWith(bots, seed);
        // The engine owns ranking, including seat-order tie breaks.
        const place = r.ranking.indexOf(0) + 1;
        total += place;
      }
      return total / SEEDS.length;
    };

    const hard = meanPlacement('hard');
    const easy = meanPlacement('easy');
    console.log(`mean placement in a normal field — hard seat ${hard.toFixed(2)}, easy seat ${easy.toFixed(2)}`);
    // Lower placement is better. The gap is generous because eighteen matches
    // is still a small sample, but the sign has to be right.
    expect(hard).toBeLessThan(easy);
  }, 180_000);
});
