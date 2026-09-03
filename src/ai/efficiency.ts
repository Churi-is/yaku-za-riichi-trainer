/**
 * Discard selection. Shanten-first, ukeire tiebreak, value-aware (dora / yaku
 * direction), and safety-weighted when folding. Perturbed by efficiencyNoise.
 * Pure: reads a PublicView + params + seeded RNG, returns a tile to discard.
 */
import type { PublicView, TileId, TileKind, Wind } from '@engine/types';
import type { AIParams } from './types';
import { Rng } from './rng';
import {
  evaluateDiscards,
  ownTiles,
  kindOf,
  isHonor,
  isDragon,
  doraKindForIndicator,
  yakuhaiKinds,
  countsOf,
  type DiscardEval,
} from './handEval';
import { buildSafetyContext, dangerOf, type SafetyContext } from './defense';

export interface DiscardChoice {
  tile: TileId;
  kind: TileKind;
  rationale: string;
}

function ownSeat(view: PublicView) {
  return view.seats[view.viewer];
}

/** Set of dora kinds currently indicated (face-up indicators only). */
export function indicatedDoraKinds(view: PublicView): Set<TileKind> {
  const set = new Set<TileKind>();
  for (const ind of view.doraIndicators) set.add(doraKindForIndicator(kindOf(ind)));
  return set;
}

/**
 * Value cost of discarding `kind`: how much future value we throw away.
 * Higher = more reluctant to discard. Uses only public info (own hand +
 * indicators + seat/round wind).
 */
function discardReluctance(
  kind: TileKind,
  view: PublicView,
  pool: TileId[],
  doraKinds: Set<TileKind>,
): number {
  const seat = ownSeat(view);
  const counts = countsOf(pool);
  const seatWind: Wind = seat.seatWind;
  const roundWind: Wind = view.roundWind;
  const valueKinds = new Set(yakuhaiKinds(seatWind, roundWind));

  let rel = 0;
  if (doraKinds.has(kind)) rel += 1.4; // never want to shed dora
  if (valueKinds.has(kind)) {
    if (counts[kind] >= 3) rel += 2.0; // live yakuhai triplet
    else if (counts[kind] === 2) rel += 1.1; // yakuhai pair (atozuke/pon)
    else if (isDragon(kind)) rel += 0.4; // single dragon keeps options
  }
  // Center suited tiles connect more; terminals/honors are more disposable.
  if (!isHonor(kind)) {
    const r = kind % 9;
    const rank = r + 1;
    if (rank >= 3 && rank <= 7) rel += 0.15;
  }
  return rel;
}

/**
 * Choose a discard tile from the 14-tile post-draw hand.
 * `folding` switches to safety-first selection.
 */
export function chooseDiscard(
  view: PublicView,
  params: AIParams,
  rng: Rng,
  folding: boolean,
): DiscardChoice {
  const seat = ownSeat(view);
  const melds = seat.melds;
  const tilePool = ownTiles(view); // 14 post-draw (13 + drawnTile), or 13 in a window
  const evals = evaluateDiscards(tilePool, melds, view.visibleCounts);
  if (evals.length === 0) {
    // Fallback (should never happen with a legal discard set).
    return { tile: tilePool[0], kind: kindOf(tilePool[0]), rationale: 'fallback' };
  }

  const safety: SafetyContext = buildSafetyContext(view);
  const doraKinds = indicatedDoraKinds(view);

  const danger = new Map<TileKind, number>();
  const reluctance = new Map<TileKind, number>();
  for (const e of evals) {
    danger.set(e.kind, dangerOf(e.kind, safety));
    reluctance.set(e.kind, discardReluctance(e.kind, view, tilePool, doraKinds));
  }

  // -- Folding: safe tile first, then least shape damage. -------------------
  if (folding) {
    const ranked = evals.slice().sort((a, b) => {
      const da = danger.get(a.kind)!;
      const db = danger.get(b.kind)!;
      if (Math.abs(da - db) > 0.02) return da - db;
      // Among equally safe tiles, prefer keeping hand shape (lower shanten)
      // but it barely matters when folding; accept cheap damage.
      return a.shanten - b.shanten || b.acceptance - a.acceptance;
    });
    const safest = ranked[0];
    return {
      tile: safest.tile,
      kind: safest.kind,
      rationale: `fold: discard danger ${danger.get(safest.kind)!.toFixed(2)}`,
    };
  }

  // -- Pushing: shanten-first, ukeire/value tiebreak, noise on top. ----------
  const bestShanten = evals[0].shanten;
  const optimal = evals.filter((e) => e.shanten === bestShanten);
  const suboptimal = evals.filter((e) => e.shanten > bestShanten);

  // Weight within a tier: acceptance dominates; value reluctance nudges.
  const weight = (e: DiscardEval): number => {
    const rel = reluctance.get(e.kind) ?? 0;
    const w = e.acceptance + 8 + rel * 6;
    return Math.max(0.1, w);
  };

  let pool: DiscardEval[];
  if (suboptimal.length > 0 && rng.chance(params.efficiencyNoise)) {
    // Efficiency mistake: drop one shanten tier (usually just +1 shanten).
    const near = suboptimal.filter((e) => e.shanten <= bestShanten + 1);
    pool = near.length > 0 ? near : suboptimal;
  } else {
    pool = optimal;
  }

  const idx = rng.weightedIndex(pool.map(weight));
  const pick = pool[idx];
  return {
    tile: pick.tile,
    kind: pick.kind,
    rationale: `push: shanten ${pick.shanten}, accept ${pick.acceptance}, danger ${danger
      .get(pick.kind)!
      .toFixed(2)}`,
  };
}
