/**
 * Internal hand evaluation for the AI.
 *
 * PUBLIC-INFORMATION FIREWALL: this module is pure tile math. It reads only
 * tile ids handed to it by the decision layer, which itself gets tiles solely
 * from a PublicView. It never imports GameState and never touches another
 * seat's concealed tiles.
 *
 * Shanten / waits / ukeire are Worker A's engine implementations (re-exported
 * through the engine's public surface), so the AI and the game agree on hand
 * structure exactly. The extra logic here is what the engine does not expose
 * in a form the AI can ask cheaply mid-decision: yaku-path signals for calls,
 * and a coarse han proxy for riichi/call value (the engine's full `scoreHand`
 * scores a completed hand, not an in-progress one).
 */
import {
  shanten as engineShanten,
  waits as engineWaits,
  ukeire as engineUkeire,
  shantenFromCounts,
  ukeireTotal,
  isAgari,
  isTenpai,
  waitingHandSize,
  countsFromIds,
  kindOf,
  isHonor,
  isTerminal,
  isSimple,
  isTerminalOrHonor,
  isDragon,
  isWind,
  doraKindForIndicator,
  yakuhaiKinds,
  kindOfWind,
  RED_FIVE_IDS,
  KIND_COUNT,
} from '@engine/index';
import type { Meld, TileId, TileKind, Wind } from '@engine/types';

export {
  kindOf,
  isHonor,
  isTerminal,
  isSimple,
  isTerminalOrHonor,
  isDragon,
  isWind,
  doraKindForIndicator,
  yakuhaiKinds,
  kindOfWind,
  countsFromIds,
  isAgari,
  isTenpai,
  KIND_COUNT,
};

// ---------------------------------------------------------------------------
// Basic helpers
// ---------------------------------------------------------------------------

/** Suit of a TileKind (engine's suitOf takes an id; this is kind-based). */
export function suitOf(kind: TileKind): 'm' | 'p' | 's' | 'z' {
  return kind < 9 ? 'm' : kind < 18 ? 'p' : kind < 27 ? 's' : 'z';
}
/** Rank (1-9 suited, 1-7 honors) of a TileKind. */
export function rankOf(kind: TileKind): number {
  return kind < 27 ? (kind % 9) + 1 : kind - 26;
}
/** Red-five convention (Worker A): copy index 0 of m5/p5/s5 — ids 16/52/88. */
export function isRed(id: TileId): boolean {
  return id === 16 || id === 52 || id === 88;
}
export const RED_FIVE_KINDS: TileKind[] = [4, 13, 22];
export { RED_FIVE_IDS };

/** Parse compact notation ("123m456p EEEE") into sorted tile ids.
 *  Mirrors the engine test helper so fixtures read the same way. */
export function parseHand(str: string): TileId[] {
  const HONOR_CHARS: Record<string, number> = {
    E: 27, S: 28, W: 29, N: 30, P: 31, F: 32, C: 33,
  };
  const SUIT_BASE: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 };
  const ids: TileId[] = [];
  const next = new Array<number>(KIND_COUNT).fill(0);
  const taken = new Set<TileId>();
  let digits = '';
  const push = (kind: TileKind, red: boolean): void => {
    let copy = red ? 0 : next[kind];
    if (!red && copy === 0 && RED_FIVE_KINDS.includes(kind)) copy = 1;
    while (taken.has(kind * 4 + copy)) copy++;
    taken.add(kind * 4 + copy);
    ids.push(kind * 4 + copy);
    next[kind] = copy + 1;
  };
  for (const ch of str.replace(/\s+/g, '')) {
    if (/[0-9]/.test(ch)) {
      digits += ch;
      continue;
    }
    const honor = HONOR_CHARS[ch];
    if (honor !== undefined) {
      push(honor, false);
      digits = '';
      continue;
    }
    const base = SUIT_BASE[ch];
    if (base === undefined) throw new Error(`bad tile char: ${ch}`);
    for (const d of digits) {
      const rank = Number(d);
      if (ch === 'z') push(27 + rank - 1, false);
      else push(base + (rank === 0 ? 4 : rank - 1), rank === 0);
    }
    digits = '';
  }
  return ids.sort((a, b) => a - b);
}

/** Count each tile kind (length 34) from tile ids. */
export function countsOf(ids: TileId[]): number[] {
  return countsFromIds(ids);
}

// ---------------------------------------------------------------------------
// Meld helpers
// ---------------------------------------------------------------------------

/** Kinds contributed by declared melds. */
export function meldKinds(melds: Meld[]): TileKind[] {
  const out: TileKind[] = [];
  for (const m of melds) for (const t of m.tiles) out.push(kindOf(t));
  return out;
}

/** Total per-kind counts contributed by declared melds. */
export function meldCounts(melds: Meld[]): number[] {
  return countsFromIds(meldKinds(melds));
}

/** Number of fixed triplet/kan blocks (pon/kan) — chi melds are sequences. */
export function meldTriplets(melds: Meld[]): number {
  return melds.filter((m) => m.type !== 'chi').length;
}

/** Whether the seat's hand is closed (no open melds). Ankan counts as closed. */
export function isHandClosed(melds: Meld[]): boolean {
  return melds.every((m) => m.concealed);
}

// ---------------------------------------------------------------------------
// PublicView tile access
// ---------------------------------------------------------------------------

/**
 * The viewer's full concealed tile pool as exposed by a PublicView: the 13-tile
 * hand PLUS the just-drawn tile (which the engine keeps separate in
 * `drawnTile`). On a discard decision this is the 14-tile post-draw set; during
 * a call window `drawnTile` is null and this is just the waiting hand.
 */
export function ownTiles(view: { hand: TileId[]; drawnTile: TileId | null }): TileId[] {
  return view.drawnTile !== null ? [...view.hand, view.drawnTile] : view.hand;
}

// ---------------------------------------------------------------------------
// Shanten / waits / ukeire (engine-backed, waiting-size aware)
// ---------------------------------------------------------------------------

/** Shanten for any concealed-tile count + melds. -1 complete, 0 tenpai. */
export function shanten(hand: TileId[], melds: Meld[] = []): number {
  return engineShanten(hand, melds);
}

/** Reduce a hand to its waiting size so waits/ukeire are well-defined. */
function toWaitingSize(hand: TileId[], melds: Meld[]): TileId[] {
  const target = waitingHandSize(melds.length);
  if (hand.length === target) return hand;
  if (hand.length < target) return hand;
  // One tile over (the usual just-drawn case): drop the tile whose removal
  // leaves the lowest shanten, i.e. the structurally best 13-tile shape.
  let bestHand = hand.slice(0, target);
  let bestSh = 99;
  for (let i = 0; i < hand.length; i++) {
    const trial = hand.filter((_, j) => j !== i);
    const s = engineShanten(trial, melds);
    if (s < bestSh) {
      bestSh = s;
      bestHand = trial;
    }
  }
  return bestHand;
}

/** Winning tile kinds for a tenpai hand (empty if not tenpai). */
export function waits(hand: TileId[], melds: Meld[] = []): TileKind[] {
  return engineWaits(toWaitingSize(hand, melds), melds);
}

/** Ukeire kinds + remaining copy counts for a waiting hand. */
export function ukeire(
  hand: TileId[],
  melds: Meld[] = [],
  visibleCounts?: number[],
): { kind: TileKind; count: number }[] {
  const vis = visibleCounts ?? new Array<number>(KIND_COUNT).fill(0);
  return engineUkeire(toWaitingSize(hand, melds), melds, vis);
}

/** Total ukeire acceptance in tiles and kinds. */
export function ukeireAcceptance(
  hand: TileId[],
  melds: Meld[],
  visibleCounts?: number[],
): { kinds: number; tiles: number } {
  const vis = visibleCounts ?? new Array<number>(KIND_COUNT).fill(0);
  return ukeireTotal(toWaitingSize(hand, melds), melds, vis);
}

export interface DiscardEval {
  tile: TileId;
  kind: TileKind;
  /** Shanten of the hand after discarding this tile. */
  shanten: number;
  /** Ukeire acceptance (tiles) after discarding. */
  acceptance: number;
  /** Ukeire kinds after discarding. */
  acceptKinds: number;
}

/**
 * Evaluate every distinct discard candidate in a (post-draw) hand.
 * Returns candidates sorted best-first (lowest shanten, then most acceptance).
 * Works on per-kind counts: after discarding one copy of kind `k` the hand is
 * at waiting size, so shantenFromCounts + ukeireTotal are exact and fast.
 */
export function evaluateDiscards(
  hand: TileId[],
  melds: Meld[],
  visibleCounts?: number[],
): DiscardEval[] {
  const vis = visibleCounts ?? new Array<number>(KIND_COUNT).fill(0);
  const counts = countsFromIds(hand);
  const meldCount = melds.length;
  const evals: DiscardEval[] = [];
  const tileOfKind = new Map<TileKind, TileId>();
  for (const t of hand) {
    const k = kindOf(t);
    if (!tileOfKind.has(k)) tileOfKind.set(k, t);
  }

  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue;
    counts[k]--; // simulate discard
    const sh = shantenFromCounts(counts, meldCount);
    const acc = ukeireTotal(countsToIds(counts), melds, vis);
    counts[k]++;
    evals.push({
      tile: tileOfKind.get(k)!,
      kind: k,
      shanten: sh,
      acceptance: acc.tiles,
      acceptKinds: acc.kinds,
    });
  }
  evals.sort((a, b) =>
    a.shanten - b.shanten ||
    b.acceptance - a.acceptance ||
    b.acceptKinds - a.acceptKinds ||
    a.kind - b.kind,
  );
  return evals;
}

/** Expand a count array into a tile-id array (lowest copies first). */
function countsToIds(counts: readonly number[]): TileId[] {
  const ids: TileId[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    for (let c = 0; c < counts[k]; c++) ids.push(k * 4 + c);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Yaku-path & value signals (coarse; scoreHand replaces these when it lands)
// ---------------------------------------------------------------------------

function allSimples(c: readonly number[]): boolean {
  for (let k = 0; k < KIND_COUNT; k++) {
    if (c[k] > 0 && !isSimple(k)) return false;
  }
  return true;
}

/**
 * Whether an OPEN hand can still plausibly end with a yaku (atozuke allowed,
 * tanyao only when kuitan). Used to avoid calls that strand a no-yaku hand.
 */
export function hasOpenYakuPath(
  hand: TileId[],
  melds: Meld[],
  seatWind: Wind,
  roundWind: Wind,
  kuitan: boolean,
  /**
   * Tiles contributed by a call being considered (the called tile + the tiles
   * we add). The meld is NOT yet in `melds` or `hand`, so tanyao/honitsu checks
   * that depend on the whole hand must count it. Pass the prospective meld's
   * tiles here when evaluating a call; omit otherwise.
   */
  prospective: TileId[] = [],
): boolean {
  const c = countsFromIds(hand);
  const mc = meldCounts(melds);
  const pc = countsFromIds(prospective);
  const total = c.map((v, k) => v + mc[k] + pc[k]);
  const valueKinds = new Set(yakuhaiKinds(seatWind, roundWind));

  // Existing melded (or prospective) value-honor triplet → yakuhai, counting
  // the prospective call too (a yakuhai pon IS the yaku).
  for (const m of melds) {
    if (m.type === 'chi') continue;
    if (valueKinds.has(kindOf(m.tiles[0]))) return true;
  }
  // A value-honor triplet anywhere in the complete hand (incl. prospective
  // meld + concealed) locks yakuhai.
  for (const k of valueKinds) {
    if (total[k] >= 3) return true;
  }
  // Concealed value-honor pair (atozuke: can pon it later).
  for (const k of valueKinds) {
    if (c[k] === 2) return true;
  }
  // Tanyao path (open only with kuitan).
  if (kuitan && allSimples(total)) return true;
  // Single-suit path: honitsu (suit + honors) or chinitsu (suit only).
  {
    const suits = new Set<string>();
    let hasHonor = false;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (total[k] === 0) continue;
      if (isHonor(k)) hasHonor = true;
      else suits.add(suitOf(k));
    }
    if (suits.size <= 1) return true; // honitsu/chinitsu/tsuuiisou direction
    void hasHonor;
  }
  // Toitoi path: triplet blocks + convertible pairs.
  {
    let blocks = meldTriplets(melds);
    let pairs = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (c[k] >= 3) blocks++;
      else if (c[k] === 2) pairs++;
    }
    if (blocks + pairs >= 4) return true;
  }
  // Honroutou path: only terminals & honors.
  {
    let onlyTH = true;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (total[k] > 0 && isSimple(k)) { onlyTH = false; break; }
    }
    if (onlyTH) return true;
  }
  return false;
}

export interface ValueContext {
  seatWind: Wind;
  roundWind: Wind;
  kuitan: boolean;
  riichi: boolean;
  doubleRiichi: boolean;
  tsumo: boolean;
  doraIndicators: TileId[];
  redDora: boolean;
}

/**
 * Coarse han estimate of a completed hand — a monotone proxy for value until
 * the engine's scoreHand lands. Counts easy yaku + dora; ignores fu/payments.
 */
export function estimateHan(hand: TileId[], melds: Meld[], ctx: ValueContext): number {
  const c = countsFromIds(hand);
  const mc = meldCounts(melds);
  const total = c.map((v, k) => v + mc[k]);
  const closed = isHandClosed(melds);
  const valueKinds = new Set(yakuhaiKinds(ctx.seatWind, ctx.roundWind));
  let han = 0;

  if (ctx.doubleRiichi) han += 2;
  else if (ctx.riichi) han += 1;
  if (ctx.tsumo && closed) han += 1;

  for (const k of valueKinds) if (total[k] >= 3) han += 1;

  let allSimple = true;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (total[k] > 0 && !isSimple(k)) { allSimple = false; break; }
  }
  if (allSimple && (closed || ctx.kuitan)) han += 1;

  let triplets = meldTriplets(melds);
  for (let k = 0; k < KIND_COUNT; k++) if (c[k] >= 3) triplets++;
  if (triplets >= 4) han += 2; // toitoi

  if (closed) {
    let pairs = 0;
    for (let k = 0; k < KIND_COUNT; k++) if (c[k] >= 2) pairs++;
    if (pairs === 7) han += 2; // chiitoitsu
  }

  {
    const suits = new Set<string>();
    let hasHonor = false;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (total[k] === 0) continue;
      if (isHonor(k)) hasHonor = true;
      else suits.add(suitOf(k));
    }
    if (suits.size === 1) han += hasHonor ? (closed ? 3 : 2) : (closed ? 6 : 5);
  }

  for (const ind of ctx.doraIndicators) han += total[doraKindForIndicator(kindOf(ind))] ?? 0;
  if (ctx.redDora) {
    for (const id of hand) if (isRed(id)) han += 1;
    for (const m of melds) for (const t of m.tiles) if (isRed(t)) han += 1;
  }
  return han;
}

/** Count dora (incl. red) tiles held in hand + melds. */
export function doraCount(
  hand: TileId[],
  melds: Meld[],
  doraIndicators: TileId[],
  redDora: boolean,
): number {
  const total = countsFromIds(hand.concat(meldKinds(melds)));
  let n = 0;
  for (const ind of doraIndicators) n += total[doraKindForIndicator(kindOf(ind))] ?? 0;
  if (redDora) {
    for (const id of hand) if (isRed(id)) n++;
    for (const m of melds) for (const t of m.tiles) if (isRed(t)) n++;
  }
  return n;
}
