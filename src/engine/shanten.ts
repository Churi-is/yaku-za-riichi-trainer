/**
 * engine/shanten — shanten, waits, ukeire. Owned by Worker A.
 *
 * These run in tight loops (the AI scores candidate discards with them every
 * turn), so they allocate nothing on the hot path and prune aggressively.
 *
 * Semantics, so callers never have to guess:
 *   shanten  -1 = complete (agari), 0 = tenpai, n = n useful exchanges away.
 *   waits / ukeire expect a WAITING hand: exactly `13 - 3 * melds` concealed
 *   tiles. Hand them a 14-tile hand (one just drawn) and they return empty —
 *   that is deliberate, not a bug. Ask for the waits of the 13-tile shape.
 */
import { countsFromIds, KIND_COUNT } from './tiles';
import type { Meld, TileId, TileKind } from './types';

/** The 13 terminal + honor kinds (kokushi material). */
export const YAOCHUU_KINDS: TileKind[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

// --- scratch state (module-level; every entry point restores it) -----------
const buf = new Int8Array(KIND_COUNT);
let targetSets = 4;
let best = 8;

function dfs(pos: number, mentsu: number, tatsu: number, jantai: number, remaining: number): void {
  if (best <= -1) return;
  while (pos < KIND_COUNT && buf[pos] === 0) pos++;
  if (pos >= KIND_COUNT) {
    const room = targetSets - mentsu;
    let t = tatsu;
    if (t > room) t = room;
    const s = room * 2 - t - jantai;
    if (s < best) best = s;
    return;
  }

  const room = targetSets - mentsu;
  const cur = room * 2 - tatsu - jantai;
  // Upper bound on how much more extraction can still reduce the value.
  // Tile budget: a completed set buys 2 for 3 tiles, a partial or the pair
  // buys 1 for 2, so 2-per-3 plus a leftover pair is the best rate available.
  // Structural budget: `room` more sets at 2 each, plus the pair if unclaimed.
  const byTiles = ((remaining / 3) | 0) * 2 + (remaining % 3 >= 2 ? 1 : 0);
  const byStructure = room * 2 + (jantai ? 0 : 1);
  const maxAdd = Math.min(byTiles, byStructure);
  if (cur - maxAdd >= best) return; // even the best continuation cannot beat `best`

  const c = buf[pos];
  const morePartials = mentsu + tatsu < targetSets;
  // Runs must stay inside one suit: rank 1-7 can start a run, 1-8 a partial.
  const rank = pos % 9;
  const canRun = pos < 27 && rank <= 6;
  const canPairRun = pos < 27 && rank <= 7;

  // Complete sets.
  if (c >= 3) {
    buf[pos] -= 3;
    dfs(pos, mentsu + 1, tatsu, jantai, remaining - 3);
    buf[pos] += 3;
  }
  if (canRun && buf[pos + 1] > 0 && buf[pos + 2] > 0) {
    buf[pos]--; buf[pos + 1]--; buf[pos + 2]--;
    dfs(pos, mentsu + 1, tatsu, jantai, remaining - 3);
    buf[pos]++; buf[pos + 1]++; buf[pos + 2]++;
  }
  // Pair: as the head, or as a partial (shanpon).
  if (c >= 2) {
    buf[pos] -= 2;
    if (!jantai) dfs(pos, mentsu, tatsu, 1, remaining - 2);
    if (morePartials) dfs(pos, mentsu, tatsu + 1, jantai, remaining - 2);
    buf[pos] += 2;
  }
  // Open-ended / edge and closed partials.
  if (morePartials) {
    if (canPairRun && buf[pos + 1] > 0) {
      buf[pos]--; buf[pos + 1]--;
      dfs(pos, mentsu, tatsu + 1, jantai, remaining - 2);
      buf[pos]++; buf[pos + 1]++;
    }
    if (canRun && buf[pos + 2] > 0) {
      buf[pos]--; buf[pos + 2]--;
      dfs(pos, mentsu, tatsu + 1, jantai, remaining - 2);
      buf[pos]++; buf[pos + 2]++;
    }
  }
  // Leave one tile here floating and move on.
  buf[pos]--;
  dfs(pos, mentsu, tatsu, jantai, remaining - 1);
  buf[pos]++;
}

function chiitoiShanten(counts: readonly number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 1) kinds++;
    if (counts[k] >= 2) pairs++;
  }
  let s = 6 - pairs;
  if (kinds < 7) s += 7 - kinds;
  return s;
}

function kokushiShanten(counts: readonly number[]): number {
  let unique = 0;
  let hasPair = false;
  for (const k of YAOCHUU_KINDS) {
    if (counts[k] >= 1) unique++;
    if (counts[k] >= 2) hasPair = true;
  }
  return 13 - unique - (hasPair ? 1 : 0);
}

/**
 * Shanten from a 34-slot count array. `meldCount` is the number of already
 * formed melds (chi/pon/kan all count as one).
 */
export function shantenFromCounts(counts: readonly number[], meldCount = 0): number {
  let total = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    buf[k] = counts[k] > 4 ? 4 : counts[k];
    total += buf[k];
  }
  targetSets = 4 - meldCount;
  best = targetSets * 2;
  dfs(0, 0, 0, 0, total);
  for (let k = 0; k < KIND_COUNT; k++) buf[k] = 0;

  let result = best;
  if (meldCount === 0) {
    const chi = chiitoiShanten(counts);
    if (chi < result) result = chi;
    const koku = kokushiShanten(counts);
    if (koku < result) result = koku;
  }
  return result < -1 ? -1 : result;
}

// --- result cache ----------------------------------------------------------
const CACHE_LIMIT = 40000;
const cache = new Map<string, number>();

function cacheKey(counts: readonly number[], meldCount: number): string {
  let key = `${meldCount}:`;
  for (let k = 0; k < KIND_COUNT; k++) key += counts[k];
  return key;
}

/** Shanten number. 0 = tenpai, -1 = complete. */
export function shanten(hand: TileId[], melds: Meld[]): number {
  const counts = countsFromIds(hand);
  const meldCount = melds.length;
  const key = cacheKey(counts, meldCount);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = shantenFromCounts(counts, meldCount);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

/** Concealed tile count a waiting hand with this many melds should have. */
export function waitingHandSize(meldCount: number): number {
  return 13 - 3 * meldCount;
}

/** True when the hand is exactly one tile from complete. */
export function isTenpai(hand: TileId[], melds: Meld[]): boolean {
  return shanten(hand, melds) === 0;
}

/** True when the hand is complete (agari shape). */
export function isAgari(hand: TileId[], melds: Meld[]): boolean {
  return shanten(hand, melds) === -1;
}

function isWaitingShape(hand: TileId[], melds: Meld[]): boolean {
  return hand.length === waitingHandSize(melds.length);
}

/** Winning tile kinds for a tenpai hand (empty if not tenpai). */
export function waits(hand: TileId[], melds: Meld[]): TileKind[] {
  if (!isWaitingShape(hand, melds)) return [];
  const base = shanten(hand, melds);
  if (base !== 0) return [];
  const counts = countsFromIds(hand);
  const out: TileKind[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 4) continue;
    counts[k]++;
    if (shantenFromCounts(counts, melds.length) === -1) out.push(k);
    counts[k]--;
  }
  return out;
}

/** Kinds that reduce shanten at all (for tenpai hands, these are the waits). */
export function improvingKinds(hand: TileId[], melds: Meld[]): TileKind[] {
  if (!isWaitingShape(hand, melds)) return [];
  const base = shanten(hand, melds);
  const counts = countsFromIds(hand);
  const out: TileKind[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 4) continue;
    counts[k]++;
    if (shantenFromCounts(counts, melds.length) < base) out.push(k);
    counts[k]--;
  }
  return out;
}

/** Tiles that improve shanten (ukeire), with remaining-count weights. */
export function ukeire(
  hand: TileId[], melds: Meld[], visibleCounts: number[],
): { kind: TileKind; count: number }[] {
  const kinds = improvingKinds(hand, melds);
  const out: { kind: TileKind; count: number }[] = [];
  for (const kind of kinds) {
    const seen = visibleCounts && visibleCounts[kind] !== undefined ? visibleCounts[kind] : 0;
    const count = 4 - seen;
    if (count > 0) out.push({ kind, count });
  }
  return out;
}

/** Sum of the `count` weights — the classic "N tiles, M accepted" figure. */
export function ukeireTotal(
  hand: TileId[], melds: Meld[], visibleCounts: number[],
): { kinds: number; tiles: number } {
  const list = ukeire(hand, melds, visibleCounts);
  let tiles = 0;
  for (const entry of list) tiles += entry.count;
  return { kinds: list.length, tiles };
}

/** Drop the cache (tests use this to keep memory bounded across long runs). */
export function clearShantenCache(): void {
  cache.clear();
}
