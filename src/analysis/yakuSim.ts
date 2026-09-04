/**
 * analysis/yakuSim — Monte-Carlo yaku reachability. Owned by Worker C.
 *
 * PUBLIC-ONLY. Replaces the old hand-tuned score table, whose "probabilities"
 * were hard-coded constants divided by five. Every number this module produces
 * is a measured frequency: `hits / runs` over simulated continuations of the
 * current hand.
 *
 * WHAT THE NUMBER MEANS — commit-conditional reachability:
 *
 *   "If you commit to this yaku from right now and play every remaining draw
 *    for it, in this fraction of simulated continuations you complete a hand
 *    that the engine scores as containing it."
 *
 * It is NOT the probability that you win the hand. Deliberately (a product
 * decision): no opponent is modelled, so nobody wins first, nobody folds and
 * nobody deals in. Pure reachability keeps the number answering exactly one
 * question — "is this direction worth chasing?" — and keeps it explainable.
 *
 * METHOD
 *
 *  1. Unseen pool: all 136 tiles minus everything the viewer can see (own hand
 *     and drawn tile, every seat's melds, every discard, the dora indicators).
 *     Opponents' concealed tiles and the dead wall are therefore IN the pool —
 *     a public-information estimator cannot know where they are, and treating
 *     them as available is the standard assumption.
 *  2. Each run shuffles that pool into a fresh timeline and walks it. Position
 *     i mod 4 is the seat that receives tile i, so one in four is your draw and
 *     you get ceil(tilesRemaining / 4) of them — the real number of turns left.
 *  3. Your draws are kept or discarded by the plan for the target yaku. Tiles
 *     that go to other seats can still reach you two ways:
 *       - RON, if the tile completes your hand and you are not furiten,
 *         taken with probability `ronRate`;
 *       - a CALL (pon/kan from anyone, chi from your left) that serves the
 *         plan, taken with probability `callRate`.
 *     Those two rates stand in for "the tile is actually discarded rather than
 *     kept by its drawer". They are approximations, they are named, and they
 *     are the only tuned constants in the module.
 *  4. Completion is judged by the ENGINE, not by this file: enumerateWinShapes
 *     + detectYaku on the finished hand, success iff the target yaku is in the
 *     result. Kuitan, closed-only yaku, chinitsu-suppresses-honitsu and every
 *     other rule interaction therefore come from the rules engine for free,
 *     and an impossible yaku can never be reported as reachable.
 */
import {
  allTileIds, countsFromIds, detectYaku, enumerateWinShapes, kindOf, KIND_COUNT, YAKU_HAN,
} from '@engine/index';
import { shantenFromCounts } from '@engine/shanten';
import { createRng, nextInt, type Rng } from '@engine/rng';
import type {
  Meld, PublicView, SeatIndex, TableSettings, TileId, TileKind, Wind, YakuId,
} from '@engine/types';

// ---------------------------------------------------------------------------
// tuning
// ---------------------------------------------------------------------------

export interface SimOptions {
  /** Rollouts per candidate yaku. Higher = tighter, slower. */
  runs: number;
  /** Chance an opponent's tile that completes your hand is actually discarded. */
  ronRate: number;
  /** Chance a callable tile is actually discarded and claimable. */
  callRate: number;
  /** Deterministic seed, so the panel never jitters between renders. */
  seed: number;
}

export const DEFAULT_SIM: SimOptions = {
  runs: 60,
  ronRate: 0.5,
  callRate: 0.6,
  seed: 0x5ea5ed,
};

export interface YakuSimResult {
  id: YakuId;
  hits: number;
  runs: number;
  /** hits / runs, 0..1. */
  rate: number;
}

// ---------------------------------------------------------------------------
// the unseen pool
// ---------------------------------------------------------------------------

/**
 * Every tile the viewer cannot see, as concrete ids (so red fives keep their
 * identity). Public information only: own hand + drawn tile, all four seats'
 * melds, all four rivers (including tiles that were called away) and the
 * flipped dora indicators are removed; nothing else is knowable.
 */
export function unseenPool(view: PublicView): TileId[] {
  const seen = new Set<TileId>();
  for (const t of view.hand) seen.add(t);
  if (view.drawnTile !== null) seen.add(view.drawnTile);
  for (const s of [0, 1, 2, 3] as SeatIndex[]) {
    const seat = view.seats[s];
    for (const m of seat.melds) for (const t of m.tiles) seen.add(t);
    for (const d of seat.river) seen.add(d.tile);
  }
  for (const t of view.doraIndicators) seen.add(t);
  return allTileIds().filter((t) => !seen.has(t));
}

// ---------------------------------------------------------------------------
// plans — what "committing to this yaku" means, tile by tile
// ---------------------------------------------------------------------------

const HONOR = 3;

/**
 * A plan is a keep/discard policy plus the shape rules the policy must respect.
 * It never decides success: the engine does that on the completed hand. A plan
 * only has to steer the hand somewhere the yaku could live.
 */
interface Plan {
  /** Tile kinds allowed in the finished hand. Everything else gets thrown. */
  allows: (kind: TileKind) => boolean;
  /** Kinds the hand must end up holding (e.g. the 1-9 of an ittsu suit). */
  required: TileKind[];
  /** Calling forfeits closed-only yaku, and toitoi/honitsu welcome it. */
  mayCall: boolean;
  /** Keep pairs over runs (toitoi), or distinct pairs only (chiitoitsu). */
  shape: 'any' | 'triplets' | 'pairs';
  /** True when `allows` is the identity — lets planShanten skip the filter. */
  unconstrained: boolean;
  /**
   * How success is judged. Riichi is a declaration, not a hand shape: it is
   * reached by getting to tenpai with the hand still closed, so the engine's
   * shape detector can never see it and it needs its own terminal test.
   */
  mode: 'shape' | 'closedTenpai';
}

const isHonorKind = (k: TileKind) => k >= 27;
const isTerminalKind = (k: TileKind) => k < 27 && (k % 9 === 0 || k % 9 === 8);
const isSimpleKind = (k: TileKind) => k < 27 && k % 9 !== 0 && k % 9 !== 8;
/** Ranks that can sit in a group touching a terminal: 1,2,3 and 7,8,9. */
const isEdgeSupport = (k: TileKind) => {
  if (isHonorKind(k)) return true;
  const r = k % 9;
  return r <= 2 || r >= 6;
};

const closedOnly = (id: YakuId): boolean => {
  const han = YAKU_HAN[id];
  return han ? han[1] === 0 : false;
};

function plan(id: YakuId, over: Partial<Plan> = {}): Plan {
  const p: Plan = {
    allows: () => true,
    required: [],
    mayCall: !closedOnly(id),
    shape: 'any',
    unconstrained: true,
    mode: 'shape',
    ...over,
  };
  p.unconstrained = over.allows === undefined;
  return p;
}

/** Play-for-speed policy: no constraint at all. Used for candidate discovery. */
export const SPEED_PLAN: Plan = {
  allows: () => true, required: [], mayCall: true, shape: 'any',
  unconstrained: true, mode: 'shape',
};

/** Suit of a kind as 0..2, or HONOR. */
const suitIdx = (k: TileKind): number => (isHonorKind(k) ? HONOR : Math.floor(k / 9));

function planFor(id: YakuId, view: PublicView, counts: readonly number[]): Plan | null {
  const seatWindKind = 27 + windIndex(view.seats[view.viewer].seatWind);
  const roundWindKind = 27 + windIndex(view.roundWind);

  switch (id) {
    case 'tanyao':
      return plan(id, { allows: isSimpleKind });

    case 'chinitsu': {
      const s = dominantSuit(counts, false);
      return s === null ? null : plan(id, { allows: (k) => suitIdx(k) === s });
    }
    case 'honitsu': {
      const s = dominantSuit(counts, true);
      return s === null ? null : plan(id, { allows: (k) => suitIdx(k) === s || isHonorKind(k) });
    }

    case 'chanta':
      return plan(id, { allows: isEdgeSupport });
    case 'junchan':
      return plan(id, { allows: (k) => isEdgeSupport(k) && !isHonorKind(k) });
    case 'honroutou':
      return plan(id, { allows: (k) => isHonorKind(k) || isTerminalKind(k), shape: 'triplets' });

    case 'toitoi':
      return plan(id, { shape: 'triplets' });
    case 'sanankou':
      return plan(id, { shape: 'triplets', mayCall: false });
    case 'chiitoitsu':
      return plan(id, { shape: 'pairs', mayCall: false });

    case 'yakuhaiHaku': return plan(id, { required: [31, 31, 31] });
    case 'yakuhaiHatsu': return plan(id, { required: [32, 32, 32] });
    case 'yakuhaiChun': return plan(id, { required: [33, 33, 33] });
    case 'yakuhaiSeatWind': return plan(id, { required: [seatWindKind, seatWindKind, seatWindKind] });
    case 'yakuhaiRoundWind':
      // A round wind that is also your seat wind is scored as the seat wind
      // by the engine; chasing it under this id would never register.
      if (roundWindKind === seatWindKind) return null;
      return plan(id, { required: [roundWindKind, roundWindKind, roundWindKind] });

    case 'shousangen': {
      const req: TileKind[] = [];
      for (const k of [31, 32, 33] as TileKind[]) req.push(k, k);
      return plan(id, { required: req });
    }
    case 'daisangen':
      return plan(id, { required: [31, 31, 31, 32, 32, 32, 33, 33, 33] });
    case 'tsuuiisou':
      return plan(id, { allows: isHonorKind });
    case 'chinroutou':
      return plan(id, { allows: isTerminalKind, shape: 'triplets' });

    case 'ittsu': {
      const s = bestIttsuSuit(counts);
      if (s === null) return null;
      const req: TileKind[] = [];
      for (let r = 0; r < 9; r++) req.push((s * 9 + r) as TileKind);
      return plan(id, { required: req });
    }
    case 'sanshokuDoujun': {
      const r = bestSanshokuRank(counts);
      if (r === null) return null;
      const req: TileKind[] = [];
      for (const s of [0, 1, 2]) for (let i = 0; i < 3; i++) req.push((s * 9 + r + i) as TileKind);
      return plan(id, { required: req });
    }
    case 'sanshokuDoukou': {
      const r = bestDoukouRank(counts);
      if (r === null) return null;
      const req: TileKind[] = [];
      for (const s of [0, 1, 2]) for (let i = 0; i < 3; i++) req.push((s * 9 + r) as TileKind);
      return plan(id, { required: req, shape: 'triplets' });
    }

    case 'pinfu':
    case 'ryanpeikou':
    case 'menzenTsumo':
      return plan(id, { mayCall: false });
    // Riichi is a declaration: reaching it means reaching tenpai still closed.
    case 'riichi':
      return plan(id, { mayCall: false, mode: 'closedTenpai' });

    default:
      return null;
  }
}

function windIndex(w: Wind): number {
  return ['east', 'south', 'west', 'north'].indexOf(w);
}

/** Suit holding the most tiles, or null when nothing dominates enough to chase. */
function dominantSuit(counts: readonly number[], withHonors: boolean): number | null {
  const bySuit = [0, 0, 0];
  let honors = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    if (isHonorKind(k)) honors += counts[k];
    else bySuit[Math.floor(k / 9)] += counts[k];
  }
  let best = 0;
  for (let s = 1; s < 3; s++) if (bySuit[s] > bySuit[best]) best = s;
  const support = bySuit[best] + (withHonors ? honors : 0);
  return support >= 4 ? best : null;
}

function bestIttsuSuit(counts: readonly number[]): number | null {
  let best: number | null = null;
  let bestHave = 0;
  for (const s of [0, 1, 2]) {
    let have = 0;
    for (let r = 0; r < 9; r++) if (counts[s * 9 + r]) have++;
    if (have > bestHave) { bestHave = have; best = s; }
  }
  return bestHave >= 4 ? best : null;
}

function bestSanshokuRank(counts: readonly number[]): number | null {
  let best: number | null = null;
  let bestHave = 0;
  for (let r = 0; r <= 6; r++) {
    let have = 0;
    for (const s of [0, 1, 2]) for (let i = 0; i < 3; i++) if (counts[s * 9 + r + i]) have++;
    if (have > bestHave) { bestHave = have; best = r; }
  }
  return bestHave >= 3 ? best : null;
}

function bestDoukouRank(counts: readonly number[]): number | null {
  let best: number | null = null;
  let bestHave = 0;
  for (let r = 0; r < 9; r++) {
    let have = 0;
    for (const s of [0, 1, 2]) have += Math.min(counts[s * 9 + r], 3);
    if (have > bestHave) { bestHave = have; best = r; }
  }
  return bestHave >= 3 ? best : null;
}

// ---------------------------------------------------------------------------
// one rollout
// ---------------------------------------------------------------------------

/**
 * Memoised shanten. The engine caches `shanten(ids)` but not the counts form,
 * and a rollout evaluates the same shapes over and over, so this is worth a
 * map of its own. Bounded: rollouts are short-lived and the key space is huge.
 */
const shCache = new Map<string, number>();
export const SIM_STATS = { sh: 0, hit: 0, plan: 0, yaku: 0, rolls: 0 };
function shOf(counts: readonly number[], meldCount: number): number {
  let key = `${meldCount}`;
  for (let k = 0; k < KIND_COUNT; k++) key += counts[k];
  SIM_STATS.sh++;
  const hit = shCache.get(key);
  if (hit !== undefined) { SIM_STATS.hit++; return hit; }
  const v = shantenFromCounts(counts, meldCount);
  if (shCache.size > 120000) shCache.clear();
  shCache.set(key, v);
  return v;
}

/** Scratch buffer for planShanten, so rollouts allocate nothing per call. */
const scratch = new Array<number>(KIND_COUNT).fill(0);

interface RollCtx {
  melds: Meld[];
  meldCount: number;
  isClosed: boolean;
  seatWind: Wind;
  roundWind: Wind;
  settings: TableSettings;
  furiten: Set<TileKind>;
}

/** Cheap desirability of holding a tile, used when no shanten search is worth it. */
function floaterScore(counts: readonly number[], k: TileKind, p: Plan): number {
  let s = 0;
  if (!p.allows(k)) s -= 100;
  if (p.required.includes(k)) s += 100;
  s += (counts[k] - 1) * 12;               // pairs and triplets are worth keeping
  if (p.shape === 'pairs' && counts[k] > 2) s -= 20;
  if (p.shape !== 'any' || isHonorKind(k)) return s;
  const r = k % 9;                          // sequence neighbours
  const base = k - r;
  for (const d of [-2, -1, 1, 2]) {
    const n = r + d;
    if (n < 0 || n > 8) continue;
    if (counts[base + n]) s += Math.abs(d) === 1 ? 8 : 4;
  }
  return s;
}

/** Shanten of a hand restricted to the plan (disallowed tiles count as dead). */
function planShanten(counts: readonly number[], p: Plan, meldCount: number): number {
  SIM_STATS.plan++;
  if (p.unconstrained) return shOf(counts, meldCount);
  let dead = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (p.allows(k)) scratch[k] = counts[k];
    else { scratch[k] = 0; dead += counts[k]; }
  }
  // Required kinds the hand has not collected yet are exchanges it still owes.
  let owed = 0;
  for (let i = 0; i < p.required.length; i++) {
    const k = p.required[i];
    let need = 1;
    for (let j = 0; j < i; j++) if (p.required[j] === k) need++;
    if (counts[k] < need) owed++;
  }
  return shOf(scratch, meldCount) + dead + Math.min(owed, 4);
}

/** How many static candidates get a real shanten search. */
const SEARCH_WIDTH = 3;
/** Shanten at which the static score stops being good enough on its own. */
const SEARCH_FROM = 3;

/**
 * Discard the least useful tile for the plan. A cheap static score picks the
 * shortlist; only that shortlist gets a real shanten search, which is what
 * keeps a rollout in the sub-millisecond range.
 */
function discardFor(
  counts: number[], p: Plan, meldCount: number, deep: boolean,
): { kind: TileKind; sh: number } {
  let worst: TileKind = -1 as TileKind;
  let worstScore = Infinity;
  const shortlist: TileKind[] = [];
  const scores: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    const sc = floaterScore(counts, k as TileKind, p);
    if (sc < worstScore) { worstScore = sc; worst = k as TileKind; }
    shortlist.push(k as TileKind);
    scores.push(sc);
  }
  // A tile the plan forbids always goes first — no search needed. Far from
  // tenpai the static score is good enough too; the search only earns its cost
  // when the hand is close enough for one tile to matter.
  if (worstScore <= -50 || !deep) {
    counts[worst]--;
    return { kind: worst, sh: -1 };
  }

  const order = shortlist
    .map((k, i) => ({ k, s: scores[i] }))
    .sort((a, b) => a.s - b.s)
    .slice(0, SEARCH_WIDTH);
  let bestK = worst;
  let bestSh = Infinity;
  let bestTie = Infinity;
  for (const { k, s: tie } of order) {
    counts[k]--;
    const sh = planShanten(counts, p, meldCount);
    counts[k]++;
    if (sh < bestSh || (sh === bestSh && tie < bestTie)) { bestSh = sh; bestTie = tie; bestK = k; }
  }
  counts[bestK]--;
  return { kind: bestK, sh: bestSh };
}

/**
 * Every yaku the finished hand can be read as containing — the union over all
 * legal decompositions, judged by the engine. This is the ONLY place success
 * is decided, which is why no rule interaction has to be restated here.
 */
function yakuOf(
  concealed: TileId[], winTile: TileId, isTsumo: boolean, ctx: RollCtx,
): YakuId[] {
  SIM_STATS.yaku++;
  const shapes = enumerateWinShapes(concealed, ctx.melds, winTile);
  if (shapes.length === 0) return [];
  const found = new Set<YakuId>();
  for (const shape of shapes) {
    const hits = detectYaku(shape, {
      isClosed: ctx.isClosed,
      isTsumo,
      seatWind: ctx.seatWind,
      roundWind: ctx.roundWind,
      winKind: kindOf(winTile),
      settings: ctx.settings,
      flags: {
        riichi: false, doubleRiichi: false, ippatsu: false, haitei: false,
        houtei: false, rinshan: false, chankan: false, tenhou: false,
        chiihou: false, renhou: false,
      },
    });
    for (const h of hits) found.add(h.id);
  }
  return [...found];
}

/**
 * One commit-conditional continuation.
 *
 * `target` is the yaku being chased: the simulated player is committed, so an
 * off-plan win is declined rather than taken (that is what "if you commit"
 * means, and it stops a stumbled-into cheap tanyao from being scored as a
 * success). Pass null to play purely for speed and report whatever the hand
 * finishes with — that is how candidates are discovered.
 *
 * Returns the yaku of the hand it finished with, or null when the draws ran
 * out first.
 */
function rollout(
  view: PublicView, p: Plan, target: YakuId | null,
  pool: TileId[], draws: number, opts: SimOptions, rng: Rng,
): YakuId[] | null {
  const me = view.seats[view.viewer];
  const ctx: RollCtx = {
    melds: me.melds.slice(),
    meldCount: me.melds.length,
    isClosed: me.isClosed,
    seatWind: me.seatWind,
    roundWind: view.roundWind,
    settings: view.settings,
    furiten: new Set<TileKind>(me.river.map((d) => kindOf(d.tile))),
  };

  const hand: TileId[] = view.drawnTile !== null
    ? [...view.hand, view.drawnTile] : [...view.hand];
  const counts = countsFromIds(hand);
  const handSize = () => 13 - 3 * ctx.meldCount;

  /** Discard by the plan; returns the plan-shanten the hand is left at. */
  const throwOne = (deep: boolean): number => {
    const { kind, sh } = discardFor(counts, p, ctx.meldCount, deep);
    ctx.furiten.add(kind);
    const at = hand.findIndex((t) => kindOf(t) === kind);
    if (at >= 0) hand.splice(at, 1);
    return sh;
  };

  // Shed down to the waiting size before the first simulated draw.
  while (hand.length > handSize()) throwOne(true);

  // Hopeless-direction prune: you cannot need more useful tiles than you have
  // chances to acquire them. Exact, and it makes dead directions almost free.
  const chances = p.mayCall ? draws * 2 : draws;
  if (planShanten(counts, p, ctx.meldCount) > chances) return null;

  const accept = (hits: YakuId[]): YakuId[] | null => {
    if (hits.length === 0) return null;                    // yakuless: no win
    if (target === null) return hits;                      // discovery
    return hits.includes(target) ? hits : null;            // committed
  };

  let myDraws = 0;
  let cur = shOf(counts, ctx.meldCount);
  const reachedRiichi = (): YakuId[] | null =>
    (target !== null && ctx.isClosed && cur <= 0) ? [target] : null;
  if (p.mode === 'closedTenpai') { const r = reachedRiichi(); if (r) return r; }

  for (let i = 0; i < pool.length && myDraws < draws; i++) {
    const tile = pool[i];
    const kind = kindOf(tile);

    if (i % 4 === 0) {
      myDraws++;
      counts[kind]++;
      hand.push(tile);
      if (shOf(counts, ctx.meldCount) === -1) {
        const got = accept(yakuOf(hand, tile, true, ctx));
        if (got) return got;
      }
      const planSh = throwOne(cur <= SEARCH_FROM);
      cur = shOf(counts, ctx.meldCount);
      if (p.mode === 'closedTenpai' && myDraws < draws) {
        const r = reachedRiichi();
        if (r) return r;
      }
      // Exact abort: fewer chances left than useful tiles still needed.
      const left = draws - myDraws;
      if (planSh >= 0 && planSh > (p.mayCall ? left * 2 : left)) return null;
      continue;
    }

    // Somebody else's tile. Two ways it can still reach you.
    if (cur === 0 && !ctx.furiten.has(kind) && counts[kind] < 4) {
      counts[kind]++;
      const agari = shOf(counts, ctx.meldCount) === -1;
      counts[kind]--;
      if (agari && rng() < opts.ronRate) {
        const got = accept(yakuOf([...hand, tile], tile, false, ctx));
        if (got) return got;
      }
    }

    if (!p.mayCall || !p.allows(kind)) continue;
    const fromLeft = i % 4 === 3; // the seat immediately before you in turn order
    const canPon = counts[kind] >= 2;
    const canChi = fromLeft && !isHonorKind(kind) && chiPossible(counts, kind);
    if (!canPon && !canChi) continue;
    if (rng() >= opts.callRate) continue;

    const before = planShanten(counts, p, ctx.meldCount);
    const meld = canPon
      ? makePon(hand, kind, tile)
      : makeChi(hand, kind, tile);
    if (!meld) continue;
    for (const t of meld.removed) {
      counts[kindOf(t)]--;
      hand.splice(hand.indexOf(t), 1);
    }
    ctx.melds.push(meld.meld);
    ctx.meldCount++;
    ctx.isClosed = false;
    if (planShanten(counts, p, ctx.meldCount) > before) {
      // the call did not actually help: undo it and let the tile go
      ctx.melds.pop();
      ctx.meldCount--;
      ctx.isClosed = me.isClosed && ctx.melds.every((m) => m.concealed);
      for (const t of meld.removed) { counts[kindOf(t)]++; hand.push(t); }
      continue;
    }
    throwOne(cur <= SEARCH_FROM);
    cur = shOf(counts, ctx.meldCount);
  }
  return null;
}

function chiPossible(counts: readonly number[], kind: TileKind): boolean {
  const r = kind % 9;
  const base = kind - r;
  const has = (x: number) => x >= 0 && x <= 8 && counts[base + x] > 0;
  return (has(r - 2) && has(r - 1)) || (has(r - 1) && has(r + 1)) || (has(r + 1) && has(r + 2));
}

function makePon(hand: TileId[], kind: TileKind, called: TileId) {
  const own = hand.filter((t) => kindOf(t) === kind).slice(0, 2);
  if (own.length < 2) return null;
  const meld: Meld = {
    type: 'pon', tiles: [...own, called], calledFrom: 1, calledTile: called, concealed: false,
  };
  return { meld, removed: own };
}

function makeChi(hand: TileId[], kind: TileKind, called: TileId) {
  const r = kind % 9;
  const base = kind - r;
  const pick = (a: number, b: number) => {
    const ta = hand.find((t) => kindOf(t) === base + a);
    const tb = hand.find((t) => kindOf(t) === base + b);
    return ta !== undefined && tb !== undefined ? [ta, tb] : null;
  };
  const combos = [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]]
    .filter(([a, b]) => a >= 0 && a <= 8 && b >= 0 && b <= 8);
  for (const [a, b] of combos) {
    const own = pick(a, b);
    if (!own) continue;
    const meld: Meld = {
      type: 'chi', tiles: [...own, called], calledFrom: 3, calledTile: called, concealed: false,
    };
    return { meld, removed: own };
  }
  return null;
}

// ---------------------------------------------------------------------------
// public entry point
// ---------------------------------------------------------------------------

/** Draws the viewer still gets: one per go-around of the live wall. */
export function drawsRemaining(view: PublicView): number {
  return Math.max(0, Math.ceil(view.tilesRemaining / 4));
}

/**
 * Run `opts.runs` commit-conditional rollouts for each target. Deterministic
 * for a given seed: the same position always produces the same numbers.
 */
export function simulateYaku(
  view: PublicView, targets: YakuId[], opts: Partial<SimOptions> = {},
): YakuSimResult[] {
  const o: SimOptions = { ...DEFAULT_SIM, ...opts };
  const pool = unseenPool(view);
  const draws = drawsRemaining(view);
  const counts = countsFromIds(
    view.drawnTile !== null ? [...view.hand, view.drawnTile] : view.hand,
  );
  for (const m of view.seats[view.viewer].melds) for (const t of m.tiles) counts[kindOf(t)]++;

  const out: YakuSimResult[] = [];
  for (const id of targets) {
    const p = planFor(id, view, counts);
    if (!p) continue;
    if (!p.mayCall && !view.seats[view.viewer].isClosed) continue; // already impossible
    let hits = 0;
    const rng = createRng(o.seed ^ hashId(id));
    for (let r = 0; r < o.runs; r++) {
      const shuffled = shufflePool(pool, rng);
      if (rollout(view, p, id, shuffled, draws, o, rng)) hits++;
    }
    out.push({ id, hits, runs: o.runs, rate: hits / o.runs });
  }
  return out.sort((a, b) => b.rate - a.rate);
}

/**
 * Candidate discovery. Rather than re-inventing the hand-tuned thresholds this
 * module exists to delete, play the hand for pure speed a few dozen times and
 * see which yaku the finished hands actually contained. Whatever shows up is
 * worth spending real rollouts on. Cheap, data-driven, and it cannot invent a
 * direction the hand physically cannot reach.
 */
export function discoverCandidates(
  view: PublicView, opts: Partial<SimOptions> = {},
): { id: YakuId; seen: number; runs: number }[] {
  const o: SimOptions = { ...DEFAULT_SIM, ...opts };
  const pool = unseenPool(view);
  const draws = drawsRemaining(view);
  const rng = createRng(o.seed ^ 0x9e3779b9);
  const tally = new Map<YakuId, number>();
  for (let r = 0; r < o.runs; r++) {
    const got = rollout(view, SPEED_PLAN, null, shufflePool(pool, rng), draws, o, rng);
    if (!got) continue;
    for (const id of got) tally.set(id, (tally.get(id) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([id, seen]) => ({ id, seen, runs: o.runs }))
    .sort((a, b) => b.seen - a.seen);
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function shufflePool(pool: readonly TileId[], rng: Rng): TileId[] {
  const out = pool.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}
