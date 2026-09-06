/**
 * Internal hand evaluation for the AI.
 *
 * PUBLIC-INFORMATION FIREWALL: this module is pure tile math. It reads only
 * tile ids handed to it by the decision layer, which itself gets tiles solely
 * from a PublicView. It never imports GameState and never touches another
 * seat's concealed tiles.
 *
 * Shanten / waits / ukeire use the shared engine implementations (re-exported
 * through the engine's public surface), so the AI and the game agree on hand
 * structure exactly. The extra logic here is what the engine does not expose
 * in a form the AI can ask cheaply mid-decision: yaku-path signals for calls,
 * and a coarse han proxy for riichi/call value (the engine's full `scoreHand`
 * scores a completed hand, not an in-progress one).
 */
import {
  shanten as engineShanten, waits as engineWaits, ukeire as engineUkeire,
  shantenFromCounts, ukeireTotal, waitingHandSize, countsFromIds, idsFromCounts,
  kindOf, isHonor, isSimple, isRed, suitOfKind as suitOf, doraKindForIndicator,
  yakuhaiKinds, KIND_COUNT,
} from '@engine/index';
import type { Meld, TileId, TileKind, Wind } from '@engine/types';

export {
  kindOf, isHonor, isDragon, doraKindForIndicator, yakuhaiKinds, KIND_COUNT, isRed,
  suitOfKind as suitOf, rankOfKind as rankOf, countsFromIds as countsOf, parseHand, shanten,
} from '@engine/index';

// ---------------------------------------------------------------------------
// Meld helpers
// ---------------------------------------------------------------------------

/** Total per-kind counts contributed by declared melds. */
export function meldCounts(melds: Meld[]): number[] {
  return countsFromIds(melds.flatMap((m) => m.tiles));
}

/** Number of fixed triplet/kan blocks (pon/kan) — chi melds are sequences. */
function meldTriplets(melds: Meld[]): number {
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
  // One representative id per kind. Prefer a NON-RED copy: ids are sorted and
  // a red five is copy zero, so taking the first id would throw the red five
  // every single time the policy decided to discard "a five".
  const tileOfKind = new Map<TileKind, TileId>();
  for (const t of hand) {
    const k = kindOf(t);
    const held = tileOfKind.get(k);
    if (held === undefined || (isRed(held) && !isRed(t))) tileOfKind.set(k, t);
  }

  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue;
    counts[k]--; // simulate discard
    const sh = shantenFromCounts(counts, meldCount);
    const acc = ukeireTotal(idsFromCounts(counts), melds, vis);
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

// ---------------------------------------------------------------------------
// Yaku-path & value signals (coarse heuristics, not win settlement)
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
    for (let k = 0; k < KIND_COUNT; k++) {
      if (total[k] === 0) continue;
      if (!isHonor(k)) suits.add(suitOf(k));
    }
    if (suits.size <= 1) return true; // honitsu/chinitsu/tsuuiisou direction
  }
  // Toitoi path: triplet blocks + convertible pairs.
  {
    let blocks = meldTriplets(melds);
    let pairs = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (c[k] >= 3) blocks++;
      else if (c[k] === 2) pairs++;
    }
    if (!melds.some((m) => m.type === 'chi') && prospective.length === 0 && blocks + pairs >= 4) return true;
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

interface ValueContext {
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
 * Coarse han estimate for AI policy tests and value comparisons. Counts easy
 * yaku + dora; ignores fu/payments. Use scoreHand for actual win settlement.
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
  const total = countsFromIds(hand.concat(melds.flatMap((m) => m.tiles)));
  let n = 0;
  for (const ind of doraIndicators) n += total[doraKindForIndicator(kindOf(ind))] ?? 0;
  if (redDora) {
    for (const id of hand) if (isRed(id)) n++;
    for (const m of melds) for (const t of m.tiles) if (isRed(t)) n++;
  }
  return n;
}
