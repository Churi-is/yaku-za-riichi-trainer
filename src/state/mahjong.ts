/**
 * Self-contained mahjong math used ONLY by the fallback engine (Worker D).
 *
 * This exists so the whole loop — deal, draw, discard, call, riichi, win,
 * exhaustive draw, scoring — is playable and testable before Worker A's engine
 * lands. When the real @engine is available, the adapter uses it instead and
 * none of this runs. It intentionally lives in src/state (Worker D's scope).
 *
 * Tile encoding matches the frozen contract: kind 0..33, id = kind*4+copy.
 */

export type Counts = number[]; // length 34, count per kind

export function kindOf(id: number): number {
  return Math.floor(id / 4);
}

export function toCounts(kinds: number[]): Counts {
  const c = new Array<number>(34).fill(0);
  for (const k of kinds) c[k]++;
  return c;
}

export function idsToCounts(ids: number[]): Counts {
  return toCounts(ids.map(kindOf));
}

const TERMINALS_HONORS = new Set([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
export function isTerminalOrHonor(kind: number): boolean {
  return TERMINALS_HONORS.has(kind);
}
export function isHonor(kind: number): boolean {
  return kind >= 27;
}
export function suitOf(kind: number): 0 | 1 | 2 | 3 {
  if (kind < 9) return 0;
  if (kind < 18) return 1;
  if (kind < 27) return 2;
  return 3;
}

// --- Standard-form shanten (4 melds + 1 pair over 34 counts) --------------

interface Decomp {
  melds: number;
  partials: number;
  pair: boolean;
}

// Melds and partials never span suits, so the best (melds, partials) for a full
// hand is the per-suit sum. Decomposing each 9-tile suit block (or 7-tile honor
// block) independently bounds the recursion to a tiny state space, and each
// block is memoized on its own count signature — turning a formerly exponential
// ukeire scan into microseconds.
const suitDecompMemo = new Map<string, { melds: number; partials: number }>();

/** Best (melds, partials) for a single suit slice of `counts` (length 7 or 9). */
function decomposeSlice(slice: number[], isHonor: boolean): { melds: number; partials: number } {
  const key = (isHonor ? 'h' : 's') + slice.join('');
  const cached = suitDecompMemo.get(key);
  if (cached) return cached;

  let bestMelds = -1;
  let bestPartials = -1;
  const n = slice.length;
  const c = [...slice];

  function rec(idx: number, melds: number, partials: number) {
    let i = idx;
    while (i < n && c[i] === 0) i++;
    if (i >= n) {
      if (melds > bestMelds || (melds === bestMelds && partials > bestPartials)) {
        bestMelds = melds;
        bestPartials = partials;
      }
      return;
    }
    // triplet
    if (c[i] >= 3) { c[i] -= 3; rec(i, melds + 1, partials); c[i] += 3; }
    // run (suits only)
    if (!isHonor && i <= n - 3 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; rec(i, melds + 1, partials); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    // pair partial
    if (c[i] >= 2) { c[i] -= 2; rec(i, melds, partials + 1); c[i] += 2; }
    // ryanmen/kanchan partial (suits only)
    if (!isHonor) {
      if (i <= n - 2 && c[i + 1] > 0) { c[i]--; c[i + 1]--; rec(i, melds, partials + 1); c[i]++; c[i + 1]++; }
      if (i <= n - 3 && c[i + 2] > 0) { c[i]--; c[i + 2]--; rec(i, melds, partials + 1); c[i]++; c[i + 2]++; }
    }
    // floater
    c[i]--; rec(i, melds, partials); c[i]++;
  }

  rec(0, 0, 0);
  const result = { melds: bestMelds, partials: bestPartials };
  if (suitDecompMemo.size > 100000) suitDecompMemo.clear();
  suitDecompMemo.set(key, result);
  return result;
}

/** Best (melds, partials) decomposition of a 34-count array (per-suit sum). */
function decompose(counts: Counts): { melds: number; partials: number }[] {
  let melds = 0;
  let partials = 0;
  for (let s = 0; s < 3; s++) {
    const r = decomposeSlice(counts.slice(s * 9, s * 9 + 9), false);
    melds += r.melds; partials += r.partials;
  }
  const h = decomposeSlice(counts.slice(27, 34), true);
  melds += h.melds; partials += h.partials;
  return [{ melds, partials }];
}

// Memo cache for shanten by (counts signature, meldCount). Grading probes many
// near-identical hands, so caching turns a multi-second replay into an instant
// one. Bounded to avoid unbounded growth across a long session.
const shantenMemo = new Map<string, number>();
function countsKey(counts: Counts, meldCount: number): string {
  // pack 34 small counts (0..4) into a compact string plus meldCount
  let k = meldCount + '|';
  for (let i = 0; i < 34; i++) k += counts[i];
  return k;
}

/** Standard shanten for a hand with `meldCount` already-called melds. */
export function standardShanten(counts: Counts, meldCount: number): number {
  let best = 8;
  // Try each kind as the pair (or no pair)
  const tryPair = (pairKind: number | null) => {
    const c = [...counts];
    let pair = 0;
    if (pairKind !== null) {
      if (c[pairKind] < 2) return;
      c[pairKind] -= 2;
      pair = 1;
    }
    const { melds, partials } = decompose(c)[0];
    const totalMelds = melds + meldCount;
    let p = partials;
    // can't use more partials than remaining meld slots
    const slots = 4 - totalMelds;
    if (p > slots) p = slots;
    const shan = (4 - totalMelds) * 2 - p - pair;
    if (shan < best) best = shan;
  };
  tryPair(null);
  for (let k = 0; k < 34; k++) if (counts[k] >= 2) tryPair(k);
  return best;
}

export function chiitoiShanten(counts: Counts): number {
  let pairs = 0;
  let kinds = 0;
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 1) kinds++;
    if (counts[k] >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

export function kokushiShanten(counts: Counts): number {
  let types = 0;
  let hasPair = false;
  for (const k of TERMINALS_HONORS) {
    if (counts[k] >= 1) types++;
    if (counts[k] >= 2) hasPair = true;
  }
  return 13 - types - (hasPair ? 1 : 0);
}

/** Overall shanten. -1 = complete, 0 = tenpai. */
export function shantenCounts(counts: Counts, meldCount: number): number {
  const key = countsKey(counts, meldCount);
  const cached = shantenMemo.get(key);
  if (cached !== undefined) return cached;
  let s = standardShanten(counts, meldCount);
  if (meldCount === 0) {
    s = Math.min(s, chiitoiShanten(counts), kokushiShanten(counts));
  }
  if (shantenMemo.size > 200000) shantenMemo.clear();
  shantenMemo.set(key, s);
  return s;
}

export function shantenIds(handIds: number[], meldCount: number): number {
  return shantenCounts(idsToCounts(handIds), meldCount);
}

/** Winning tile kinds for a 13-tile (or 13 - 3*melds) hand. */
export function waitsCounts(counts: Counts, meldCount: number): number[] {
  const result: number[] = [];
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 4) continue;
    const c = [...counts];
    c[k]++;
    if (shantenCounts(c, meldCount) === -1) result.push(k);
  }
  return result;
}

export function waitsIds(handIds: number[], meldCount: number): number[] {
  return waitsCounts(idsToCounts(handIds), meldCount);
}

/** Ukeire: tiles that reduce shanten, weighted by remaining copies. */
export function ukeireCounts(
  counts: Counts, meldCount: number, visibleCounts: number[],
): { kind: number; count: number }[] {
  const base = shantenCounts(counts, meldCount);
  const out: { kind: number; count: number }[] = [];
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 4) continue;
    const c = [...counts];
    c[k]++;
    if (shantenCounts(c, meldCount) < base) {
      const seen = visibleCounts[k] ?? 0;
      const remaining = Math.max(0, 4 - seen);
      if (remaining > 0) out.push({ kind: k, count: remaining });
    }
  }
  return out;
}

export function isCompleteStandard(counts: Counts, meldCount: number): boolean {
  return standardShanten(counts, meldCount) === -1;
}

export function isWinningHand(counts: Counts, meldCount: number): boolean {
  return shantenCounts(counts, meldCount) === -1;
}
