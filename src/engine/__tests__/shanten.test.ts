/**
 * engine/shanten tests — reference hands + property tests.
 *
 * Every expected shanten/wait below was worked out by hand against the
 * standard formula: shanten = 2*(4 - melds - sets) - partials - pair.
 */
import { describe, it, expect } from 'vitest';
import { shanten, shantenFromCounts, waits, ukeire, ukeireTotal, isTenpai, isAgari } from '../shanten';
import { parse, meld, parseCounts } from './helpers';
import { createRng } from '../rng';
import { idOf } from '../tiles';

const noMelds: never[] = [];

describe('shanten — reference hands', () => {
  it('recognises a complete standard hand as -1', () => {
    expect(shanten(parse('123m456m789m11p123s'), noMelds)).toBe(-1);
  });

  it('recognises chiitoitsu as -1', () => {
    expect(shanten(parse('11223344556677m'), noMelds)).toBe(-1);
  });

  it('recognises kokushi musou as -1', () => {
    // 14 tiles: all thirteen orphans plus a pair of one of them.
    expect(shanten(parse('19m19p19sESWNPFCF'), noMelds)).toBe(-1);
    expect(shanten(parse('19m19p19sESWNPFC1m'), noMelds)).toBe(-1);
  });

  it('ryanmen tenpai waits on both ends', () => {
    const hand = parse('234m567p123s78s99s');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([23, 26]); // 6s, 9s
  });

  it('kanchan tenpai waits on the middle only', () => {
    const hand = parse('234m567p123s46s99s');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([22]); // 5s
  });

  it('tanki tenpai waits on the pair tile', () => {
    const hand = parse('123m456m789m111p2s');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([19]); // 2s
  });

  it('shanpon tenpai waits on both pairs', () => {
    const hand = parse('123m456m789m11p22s');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([9, 19]); // 1p, 2s
  });

  it('penchan tenpai waits on the 3', () => {
    const hand = parse('123m456m789m11p12s');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([20]); // 3s
  });

  it('counts a missing pair as one exchange (1-shanten)', () => {
    expect(shanten(parse('123m456m789m1p23s'), noMelds)).toBe(1);
  });

  it('3 sets + 2 partials and no pair is 1-shanten', () => {
    // 123m 456m 789m | 23s 56s : room for one more set, so one partial is
    // wasted and the head still has to be found.
    expect(shanten(parse('123m456m789m23s56s'), noMelds)).toBe(1);
  });

  it('3 sets + pair + floating tile is 1-shanten', () => {
    expect(shanten(parse('123m456m789m11p5s9s'), noMelds)).toBe(1);
  });

  it('thirteen orphans with a pair waits on the missing honor', () => {
    const hand = parse('19m19p19sESWNPFF');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([33]); // Chun
  });

  it('thirteen orphans with thirteen uniques waits on all thirteen', () => {
    const hand = parse('19m19p19sESWNPFC');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toHaveLength(13);
  });

  it('chiitoitsu tenpai waits on the odd tile', () => {
    const hand = parse('112233445566m9p');
    expect(shanten(hand, noMelds)).toBe(0);
    expect(waits(hand, noMelds)).toEqual([17]); // 9p = kind 17
  });

  it('four of a kind caps chiitoitsu pairs, so the normal shape wins', () => {
    // 1111m 22m 33m 44m 55m 9p. Chiitoi reads 6-5+(7-6) = 2, but the normal
    // shape (111m + 234m + 234m + 55m head + 1m/9p float) is 1-shanten.
    expect(shanten(parse('1111m22m33m44m55m9p'), noMelds)).toBe(1);
  });

  it('excludes kokushi and chiitoitsu from the count once a meld exists', () => {
    // 11 orphans material: counted as kokushi it is 2-shanten; as a normal
    // hand (eleven isolated tiles, target 3 sets) it is 6-shanten.
    const kokushiShape = parseCounts('19m19p19sESWNP');
    expect(shantenFromCounts(kokushiShape, 0)).toBe(2);
    expect(shantenFromCounts(kokushiShape, 1)).toBe(6);

    // 6 pairs + East: chiitoi tenpai closed, but only 2-shanten with a meld.
    const chiitoiShape = parseCounts('1199m1199p1199sE');
    expect(shantenFromCounts(chiitoiShape, 0)).toBe(0);
    expect(shantenFromCounts(chiitoiShape, 1)).toBe(2);
  });

  it('handles an open hand: 10 concealed tiles with one meld', () => {
    const melds = [meld('pon', '111m')];
    const hand = parse('234m567m99p23s');
    expect(shanten(hand, melds)).toBe(0);
    expect(waits(hand, melds)).toEqual([18, 21]); // 1s, 4s
  });

  it('handles four melds: tanki tenpai then agari', () => {
    const melds = [
      meld('pon', '111m'), meld('chi', '234m'), meld('pon', '999p'), meld('chi', '123s'),
    ];
    expect(shanten(parse('5s'), melds)).toBe(0);
    expect(waits(parse('5s'), melds)).toEqual([22]);
    expect(shanten(parse('55s'), melds)).toBe(-1);
  });

  it('counts a kan as one meld for hand-size purposes', () => {
    const melds = [meld('ankan', '1111m')];
    const hand = parse('234m567m99p23s'); // 10 concealed tiles
    expect(shanten(hand, melds)).toBe(0);
    expect(waits(hand, melds)).toEqual([18, 21]);
  });

  it('refuses to report waits for a 14-tile hand (draw already taken)', () => {
    expect(waits(parse('123m456m789m11p123s'), noMelds)).toEqual([]);
  });

  it('reports no waits when the hand is not tenpai', () => {
    expect(waits(parse('123m456m789m1p23s'), noMelds)).toEqual([]);
  });
});

describe('ukeire', () => {
  it('weights each improving kind by unseen copies', () => {
    const hand = parse('234m567p123s78s99s');
    const visible = parseCounts('234m567p123s78s99s');
    const u = ukeire(hand, noMelds, visible);
    expect(u).toEqual([
      { kind: 23, count: 4 }, // 6s: none seen
      { kind: 26, count: 2 }, // 9s: two in hand
    ]);
    expect(ukeireTotal(hand, noMelds, visible)).toEqual({ kinds: 2, tiles: 6 });
  });

  it('lists every kind that advances shanten, not just winning tiles', () => {
    const hand = parse('123456789m1p23s5s'); // 1-shanten: 3 sets, 23s, two floats
    const visible = new Array(34).fill(0);
    const kinds = ukeire(hand, noMelds, visible).map((e) => e.kind);
    expect(kinds).toContain(9); // 1p pairs the head
    expect(kinds).toContain(22); // 5s pairs the head
    expect(kinds).toContain(18); // 1s completes 23s into a fourth set
    expect(kinds).toContain(21); // 4s completes 23s into a fourth set
    expect(kinds).not.toContain(13); // 5p floats, changes nothing
    // 2s does help: it pairs 22s and leaves 3s-5s as a kanchan.
    expect(kinds).toContain(19);
    expect(kinds).toEqual([9, 18, 19, 21, 22]);
  });

  it('returns nothing when handed a 14-tile shape', () => {
    expect(ukeire(parse('123m456m789m11p123s'), noMelds, new Array(34).fill(0))).toEqual([]);
  });
});

describe('shanten — properties', () => {
  const rng = createRng(20260903);

  function randomHand(): number[] {
    const counts = new Array(34).fill(0);
    let placed = 0;
    let guard = 0;
    while (placed < 13 && guard++ < 1000) {
      const k = Math.floor(rng() * 34);
      if (counts[k] < 4) {
        counts[k]++;
        placed++;
      }
    }
    return counts;
  }

  const countsToIds = (counts: number[]): number[] => {
    const ids: number[] = [];
    counts.forEach((c, k) => {
      for (let i = 0; i < c; i++) ids.push(idOf(k, i));
    });
    return ids;
  };

  it('is never below -1 and never above 8 over 3000 random hands', () => {
    for (let i = 0; i < 3000; i++) {
      const s = shanten(countsToIds(randomHand()), noMelds);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(8);
    }
  });

  it('is monotone: adding a tile never increases shanten', () => {
    for (let i = 0; i < 3000; i++) {
      const counts = randomHand();
      const base = shanten(countsToIds(counts), noMelds);
      for (let k = 0; k < 34; k++) {
        if (counts[k] >= 4) continue;
        counts[k]++;
        const after = shanten(countsToIds(counts), noMelds);
        expect(after).toBeLessThanOrEqual(base);
        counts[k]--;
      }
    }
  });

  it('is monotone: removing a tile never decreases shanten', () => {
    for (let i = 0; i < 1000; i++) {
      const counts = randomHand();
      const base = shanten(countsToIds(counts), noMelds);
      for (let k = 0; k < 34; k++) {
        if (counts[k] === 0) continue;
        counts[k]--;
        const after = shanten(countsToIds(counts), noMelds);
        expect(after).toBeGreaterThanOrEqual(base);
        counts[k]++;
      }
    }
  });

  /**
   * Independent agari checker: plain backtracking over pair/triplet/run, no
   * shanten formula involved. Used as the reference `waits` is graded against.
   */
  function agariBrute(ids: number[]): boolean {
    const counts = new Array(34).fill(0);
    for (const id of ids) counts[Math.floor(id / 4)]++;
    const total = ids.length;
    const yao = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    if (total === 14) {
      const yaoTotal = yao.reduce((a, k) => a + counts[k], 0);
      if (yaoTotal === 14 && yao.every((k) => counts[k] >= 1) && yao.some((k) => counts[k] >= 2)) {
        return true; // kokushi
      }
      if (counts.filter((c) => c === 2).length === 7) return true; // chiitoitsu
    }
    const rec = (pos: number, sets: number, pairUsed: boolean): boolean => {
      while (pos < 34 && counts[pos] === 0) pos++;
      if (pos >= 34) return sets === 4 && pairUsed;
      if (!pairUsed && counts[pos] >= 2) {
        counts[pos] -= 2;
        const ok = rec(pos, sets, true);
        counts[pos] += 2;
        if (ok) return true;
      }
      if (counts[pos] >= 3) {
        counts[pos] -= 3;
        const ok = rec(pos, sets + 1, pairUsed);
        counts[pos] += 3;
        if (ok) return true;
      }
      if (pos < 27 && pos % 9 <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
        counts[pos]--; counts[pos + 1]--; counts[pos + 2]--;
        const ok = rec(pos, sets + 1, pairUsed);
        counts[pos]++; counts[pos + 1]++; counts[pos + 2]++;
        if (ok) return true;
      }
      return false;
    };
    return rec(0, 0, false);
  }

  /**
   * Random hands are almost never tenpai, so also build tenpai hands directly:
   * 3 sets + 1 partial + 1 pair = 13 tiles, tenpai by construction (a 13-tile
   * hand can never be complete, so shanten must be exactly 0).
   */
  function tenpaiHand(): number[] {
    const pickSet = (): number[] => {
      if (rng() < 0.5) {
        const k = Math.floor(rng() * 34);
        return [k, k, k];
      }
      const suit = Math.floor(rng() * 3) * 9;
      const r = Math.floor(rng() * 7);
      return [suit + r, suit + r + 1, suit + r + 2];
    };
    const pickPartial = (): number[] => {
      const t = rng();
      const suit = Math.floor(rng() * 3) * 9;
      if (t < 0.4) {
        const r = Math.floor(rng() * 8);
        return [suit + r, suit + r + 1];
      }
      if (t < 0.7) {
        const r = Math.floor(rng() * 7);
        return [suit + r, suit + r + 2];
      }
      const k = Math.floor(rng() * 34);
      return [k, k];
    };
    for (let attempt = 0; attempt < 200; attempt++) {
      const counts = new Array(34).fill(0);
      const headKind = Math.floor(rng() * 34);
      counts[headKind] = 2;
      const groups = [pickSet(), pickSet(), pickSet(), pickPartial()];
      let ok = true;
      for (const g of groups) {
        for (const k of g) {
          if (counts[k] >= 4) ok = false;
          counts[k]++;
        }
      }
      if (ok) return counts;
    }
    return parseCounts('123m456m789m11p23s');
  }

  function assertWaitsMatchBruteForce(counts: number[]): void {
    const hand = countsToIds(counts);
    const reported = waits(hand, noMelds);
    const expected: number[] = [];
    for (let k = 0; k < 34; k++) {
      if (counts[k] >= 4) continue;
      counts[k]++;
      if (agariBrute(countsToIds(counts))) expected.push(k);
      counts[k]--;
    }
    expect(reported).toEqual(expected);
    // Having a wait implies tenpai. The converse can fail legitimately:
    // `shanten` is structural, while `waits` respects the four-copy limit, so
    // a hand can be structurally tenpai with every winning tile already dead.
    if (reported.length > 0) expect(shanten(hand, noMelds)).toBe(0);
    for (const k of expected) {
      counts[k]++;
      expect(shanten(countsToIds(counts), noMelds)).toBe(-1);
      counts[k]--;
    }
  }

  it('waits() matches an independent agari checker on constructed tenpai hands', () => {
    let withWaits = 0;
    for (let i = 0; i < 400; i++) {
      const counts = tenpaiHand();
      expect(shanten(countsToIds(counts), noMelds)).toBe(0);
      assertWaitsMatchBruteForce(counts);
      withWaits++;
    }
    expect(withWaits).toBe(400);
  });

  it('waits() matches an independent agari checker on random hands', () => {
    for (let i = 0; i < 1500; i++) assertWaitsMatchBruteForce(randomHand());
  });

  it('isTenpai / isAgari agree with the raw number', () => {
    expect(isTenpai(parse('123m456m789m11p23s'), noMelds)).toBe(true);
    expect(isTenpai(parse('123m456m789m1p23s'), noMelds)).toBe(false);
    expect(isAgari(parse('123m456m789m11p123s'), noMelds)).toBe(true);
    expect(isAgari(parse('123m456m789m11p23s'), noMelds)).toBe(false);
  });

  it('is deterministic across repeated calls (cache never lies)', () => {
    const hand = parse('1234567m2345678s');
    const first = shanten(hand, noMelds);
    for (let i = 0; i < 5; i++) expect(shanten(hand, noMelds)).toBe(first);
  });
});
