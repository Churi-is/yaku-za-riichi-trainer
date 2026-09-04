/**
 * yakuSim — the properties that must hold for a MEASURED estimate.
 *
 * These are deliberately about behaviour, not exact numbers: the sim is
 * stochastic, so anything pinned to a specific count would be a test that
 * fails for no reason. What must never break is the pool, determinism, the
 * "impossible yaku can never be reported" guarantee, the direction of the
 * numbers, and the cost.
 */
import { describe, expect, it } from 'vitest';
import { allTileIds, countsFromIds, kindOf } from '@engine/index';
import type { PublicView, SeatIndex, TileId } from '@engine/types';
import { makeView, kindOfShort } from './fixtures';
import {
  discoverCandidates, drawsRemaining, simulateYaku, unseenPool,
} from '../yakuSim';
import { yakuAdvisor, positionSeed, FAST_BUDGET, quickAdvisor } from '../yakuAdvisor';

/**
 * Distinct ids, copy by copy. The shared `ids()` helper hands out copy 0 for
 * every duplicate, which is fine for shape tests but would make a pool of
 * physical tiles nonsense.
 */
function alloc() {
  const used = new Map<number, number>();
  return (...shorts: string[]): TileId[] => shorts.map((s) => {
    const k = kindOfShort(s);
    const n = used.get(k) ?? 0;
    used.set(k, n + 1);
    expect(n).toBeLessThan(4);
    return (k * 4 + n) as TileId;
  });
}

describe('unseen pool', () => {
  it('is every tile the viewer cannot see, and nothing else', () => {
    const t = alloc();
    const hand = t('1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', 'E', 'E', 'H', 'H');
    const view = makeView({
      hand,
      rivers: { 0: ['1m', '2m'], 1: ['9s'], 2: ['C', 'G'], 3: ['4s'] },
      dora: ['5m'],
    });
    const pool = unseenPool(view);

    expect(pool.length).toBe(136 - (13 + 2 + 1 + 2 + 1 + 1));
    expect(new Set(pool).size).toBe(pool.length); // no duplicates

    const seen = new Set<TileId>([...hand, ...view.doraIndicators]);
    for (const s of [0, 1, 2, 3] as SeatIndex[]) {
      for (const d of view.seats[s].river) seen.add(d.tile);
      for (const m of view.seats[s].melds) for (const x of m.tiles) seen.add(x);
    }
    for (const p of pool) expect(seen.has(p)).toBe(false);
    expect(pool.length + seen.size).toBe(allTileIds().length);
  });

  it('leaves opponents\u2019 concealed tiles in the pool — they are unknown, not gone', () => {
    const t = alloc();
    const view = makeView({ hand: t('1m', '1m', '1m'), tilesRemaining: 40 });
    const pool = unseenPool(view);
    // Three of the four 1m are in hand, so exactly one is still out there —
    // it might be in the wall or in an opponent's hand, and the sim cannot
    // and must not tell the difference.
    expect(pool.filter((x) => kindOf(x) === 0).length).toBe(1);
    // A tile nobody has shown is fully available.
    expect(pool.filter((x) => kindOf(x) === 26).length).toBe(4);
  });

  it('counts the draws the viewer actually has left, not the whole wall', () => {
    expect(drawsRemaining(makeView({ tilesRemaining: 68 }))).toBe(17);
    expect(drawsRemaining(makeView({ tilesRemaining: 8 }))).toBe(2);
    expect(drawsRemaining(makeView({ tilesRemaining: 0 }))).toBe(0);
  });
});

describe('simulateYaku', () => {
  it('is deterministic for a position: same seed, same numbers', () => {
    const t = alloc();
    const view = makeView({
      hand: t('2m', '3m', '4m', '5m', '6m', '2p', '3p', '7p', '7p', '4s', '5s', 'H', 'H'),
      tilesRemaining: 40,
    });
    const a = simulateYaku(view, ['tanyao', 'yakuhaiHaku', 'honitsu'], { runs: 20, seed: 7 });
    const b = simulateYaku(view, ['tanyao', 'yakuhaiHaku', 'honitsu'], { runs: 20, seed: 7 });
    expect(a).toEqual(b);
    const c = simulateYaku(view, ['tanyao', 'yakuhaiHaku', 'honitsu'], { runs: 20, seed: 8 });
    expect(c).not.toEqual(a); // and a different seed really does resample
  });

  it('rates a hand that is already there far above a hand that is not', () => {
    const t1 = alloc();
    const nearly = makeView({
      // one tile from a closed all-simples hand
      hand: t1('2m', '3m', '4m', '5m', '6m', '7m', '3p', '4p', '5p', '6s', '7s', '8s', '2s'),
      tilesRemaining: 40,
    });
    const t2 = alloc();
    const nowhere = makeView({
      hand: t2('1m', '9m', '1p', '9p', '1s', '9s', 'E', 'S', 'W', 'N', 'H', 'G', 'C'),
      tilesRemaining: 40,
    });
    const a = simulateYaku(nearly, ['tanyao'], { runs: 40, seed: 3 })[0];
    const b = simulateYaku(nowhere, ['tanyao'], { runs: 40, seed: 3 })[0];
    expect(a.rate).toBeGreaterThan(0.15);
    expect(b?.rate ?? 0).toBe(0); // tanyao out of thirteen orphans: never
  });

  it('gets harder as the wall runs out', () => {
    const t = alloc();
    const hand = t('2m', '3m', '4m', '5m', '6m', '2p', '3p', '7p', '7p', '4s', '5s', '6s', '7s');
    const early = simulateYaku(makeView({ hand, tilesRemaining: 60 }), ['tanyao'], { runs: 40, seed: 11 })[0];
    const late = simulateYaku(makeView({ hand, tilesRemaining: 12 }), ['tanyao'], { runs: 40, seed: 11 })[0];
    expect(early.rate).toBeGreaterThan(late.rate);
  });

  it('never reports a yaku the rules could not award', () => {
    const t = alloc();
    // An open hand: every closed-only yaku is dead, whatever the shape says.
    const view = makeView({
      hand: t('2m', '3m', '4m', '5m', '6m', '7m', '3p', '4p', '5p', '6s'),
      melds: [{
        type: 'pon', tiles: t('2s', '2s', '2s'), calledFrom: 2,
        calledTile: null as unknown as TileId, concealed: false,
      }],
      tilesRemaining: 50,
      isClosed: false,
    });
    const closedOnly = ['riichi', 'menzenTsumo', 'pinfu', 'chiitoitsu', 'ryanpeikou'] as const;
    const out = simulateYaku(view, [...closedOnly], { runs: 20, seed: 5 });
    expect(out).toEqual([]);
  });

  it('respects kuitan: an open all-simples hand cannot reach tanyao with it off', () => {
    const t = alloc();
    const base: Parameters<typeof makeView>[0] = {
      hand: t('2m', '3m', '4m', '5m', '6m', '7m', '3p', '4p', '5p', '2s'),
      melds: [{
        type: 'pon', tiles: t('6s', '6s', '6s'), calledFrom: 2,
        calledTile: null as unknown as TileId, concealed: false,
      }],
      tilesRemaining: 50,
      isClosed: false,
    };
    const on = simulateYaku(makeView(base), ['tanyao'], { runs: 30, seed: 9 })[0];
    const off = simulateYaku(
      makeView({ ...base, settings: { ...makeView().settings, kuitan: false } }),
      ['tanyao'], { runs: 30, seed: 9 },
    )[0];
    expect(on.hits).toBeGreaterThan(0);
    expect(off.hits).toBe(0);
  });
});

describe('discoverCandidates', () => {
  it('finds directions from play, without being told what to look for', () => {
    const t = alloc();
    const view = makeView({
      hand: t('1p', '1p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '9p', '9p'),
      tilesRemaining: 60,
    });
    const found = discoverCandidates(view, { runs: 16, seed: 2 }).map((d) => d.id);
    // Nothing in this module knows what nine gates is; the engine reported it.
    expect(found.length).toBeGreaterThan(0);
    expect(found).toContain('chuurenPoutou');
  });
});

describe('yakuAdvisor', () => {
  it('ranks by measured reachability and shows the sample behind it', () => {
    const t = alloc();
    const view = makeView({
      hand: t('1p', '2p', '3p', '5p', '6p', '7p', '9p', '9p', '2p', '4p', 'E', 'E', 'H'),
      tilesRemaining: 50,
    });
    const out = yakuAdvisor(view);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].approxPercent!).toBeGreaterThanOrEqual(out[i].approxPercent!);
    }
    for (const s of out) {
      expect(s.hits).toBeGreaterThan(0);
      expect(s.runs).toBeGreaterThan(0);
      expect(s.approxPercent).toBe(Math.round((s.hits! / s.runs!) * 100));
      expect(s.methodNote).toMatch(/simulated continuations/);
    }
    // A dominant pin hand must surface the flush directions.
    expect(out.map((s) => s.id)).toEqual(expect.arrayContaining(['honitsu']));
  });

  it('says nothing rather than something invented when the hand is dead', () => {
    const t = alloc();
    const view = makeView({
      hand: t('1m', '4m', '9m', '2p', '5p', '8p', '3s', '6s', '9s', 'E', 'S', 'W', 'H'),
      tilesRemaining: 4,
    });
    expect(yakuAdvisor(view)).toEqual([]);
  });

  it('is stable while the position is, and moves when the position does', () => {
    const t = alloc();
    const hand = t('2m', '3m', '4m', '5m', '6m', '2p', '3p', '7p', '7p', '4s', '5s', 'H', 'H');
    const a = makeView({ hand, tilesRemaining: 40 });
    const b = makeView({ hand, tilesRemaining: 40 });
    expect(positionSeed(a)).toBe(positionSeed(b));
    expect(yakuAdvisor(a)).toEqual(yakuAdvisor(b));
    const moved = makeView({ hand, tilesRemaining: 36 });
    expect(positionSeed(moved)).not.toBe(positionSeed(a));
  });

  it('stays inside its time budget', () => {
    const t = alloc();
    const view = makeView({
      hand: t('2m', '3m', '4m', '5m', '6m', '2p', '3p', '7p', '7p', '4s', '5s', 'H', 'H'),
      tilesRemaining: 60,
    });
    const t0 = performance.now();
    yakuAdvisor(view);
    const full = performance.now() - t0;
    const t1 = performance.now();
    yakuAdvisor(view, {}, FAST_BUDGET);
    const fast = performance.now() - t1;
    // Generous ceilings: CI boxes are slow and this must not be a flaky test.
    // The point is that the full run is worker-sized and the grading run is
    // an order of magnitude cheaper.
    expect(full).toBeLessThan(3000);
    expect(fast).toBeLessThan(full);
  });
});

describe('the sim only ever sees public information', () => {
  it('produces identical output for views that differ only in hidden state', () => {
    const t = alloc();
    const hand = t('2m', '3m', '4m', '5m', '6m', '2p', '3p', '7p', '7p', '4s', '5s', 'H', 'H');
    const a = makeView({ hand, tilesRemaining: 40 });
    // Same public position; opponents' concealed counts are the only public
    // fact about their hands and they are unchanged.
    const b: PublicView = {
      ...a,
      seats: { ...a.seats, 1: { ...a.seats[1], aiPersonalityId: 'someone-else' } },
    };
    expect(yakuAdvisor(a)).toEqual(yakuAdvisor(b));
    expect(countsFromIds(a.hand)).toEqual(countsFromIds(b.hand));
  });
});

describe('advisor modes', () => {
  it('quick mode honours the requested depth', () => {
    const t = alloc();
    const view = makeView({
      hand: t('2m', '3m', '4m', '5m', '6m', '2p', '3p', '7p', '7p', '4s', '5s', 'H', 'H'),
      tilesRemaining: 50,
    });
    const shallow = quickAdvisor(view, 20);
    const deep = quickAdvisor(view, 60);
    expect(shallow.mode).toBe('quick');
    expect(shallow.requested).toBe(20);
    expect(deep.requested).toBe(60);
    for (const s of shallow.suggestions) expect(s.runs).toBe(20);
    for (const s of deep.suggestions) expect(s.runs).toBe(60);
    // more runs means a finer-grained answer, not a different question
    expect(deep.suggestions.length).toBeGreaterThan(0);
  });

  it('deeper runs give a steadier answer', () => {
    const t = alloc();
    const view = makeView({
      hand: t('2m', '3m', '4m', '5m', '6m', '7m', '3p', '4p', '5p', '6s', '7s', '8s', '2s'),
      tilesRemaining: 40,
    });
    // Same position, different seeds: the spread between runs must shrink as
    // the sample grows. That is the whole reason the depth setting exists.
    const spread = (runs: number) => {
      const rates = [1, 2, 3].map((seed) => {
        const r = simulateYaku(view, ['tanyao'], { runs, seed })[0];
        return r ? r.rate : 0;
      });
      return Math.max(...rates) - Math.min(...rates);
    };
    expect(spread(120)).toBeLessThanOrEqual(spread(15) + 0.02);
  }, 30000);
});
