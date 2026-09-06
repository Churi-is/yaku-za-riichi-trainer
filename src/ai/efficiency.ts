/**
 * Discard selection. Shanten first, then acceptance, then value, then safety —
 * decided, not drawn from a hat. Mistakes are made deliberately and only as
 * often as `efficiencyNoise` says, which is what separates the difficulty
 * tiers; everything else is the bot playing as well as it knows how.
 *
 * Pure: reads a PublicView + params + seeded RNG, returns a tile to discard.
 */
import type { PublicView, TileId, TileKind, Wind } from '@engine/types';
import type { AIParams } from './types';
import { Rng } from './rng';
import { directionReluctance } from './strategy';
import {
  evaluateDiscards,
  ownTiles,
  kindOf,
  isHonor,
  isDragon,
  isRed,
  doraKindForIndicator,
  yakuhaiKinds,
  countsOf,
  type DiscardEval,
} from './handEval';
import { buildSafetyContext, dangerOf, type SafetyContext } from './defense';

/**
 * Draws the viewer still gets. Below a handful, a hand that is not nearly
 * finished should be chasing the noten penalty rather than the win.
 */
function drawsLeft(view: PublicView): number {
  return Math.ceil(view.tilesRemaining / 4);
}

interface DiscardChoice {
  tile: TileId;
  kind: TileKind;
  rationale: string;
}

function ownSeat(view: PublicView) {
  return view.seats[view.viewer];
}

/** Set of dora kinds currently indicated (face-up indicators only). */
function indicatedDoraKinds(view: PublicView): Set<TileKind> {
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
  tile: TileId,
): number {
  const seat = ownSeat(view);
  const counts = countsOf(pool);
  const seatWind: Wind = seat.seatWind;
  const roundWind: Wind = view.roundWind;
  const valueKinds = new Set(yakuhaiKinds(seatWind, roundWind));

  let rel = 0;
  if (doraKinds.has(kind)) rel += 1.4; // never want to shed dora
  // A red five is a han in its own right, on top of any dora it may also be.
  if (view.settings.redDora && isRed(tile)) rel += 1.2;
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
  allowedTiles?: readonly TileId[],
): DiscardChoice {
  const seat = ownSeat(view);
  const melds = seat.melds;
  const tilePool = ownTiles(view); // 14 post-draw (13 + drawnTile), or 13 in a window
  const allowed = allowedTiles ? new Set(allowedTiles.map(kindOf)) : null;
  const evals = evaluateDiscards(tilePool, melds, view.visibleCounts)
    .filter((e) => !allowed || allowed.has(e.kind))
    .map((e) => {
      if (!allowedTiles || allowedTiles.includes(e.tile)) return e;
      const copies = allowedTiles.filter((t) => kindOf(t) === e.kind);
      return { ...e, tile: copies.find((t) => !isRed(t)) ?? copies[0] };
    });
  if (evals.length === 0) {
    throw new Error('AI: no legal discard candidates');
  }

  const safety: SafetyContext = buildSafetyContext(view);
  const doraKinds = indicatedDoraKinds(view);

  const danger = new Map<TileKind, number>();
  const reluctance = new Map<TileKind, number>();
  for (const e of evals) {
    danger.set(e.kind, dangerOf(e.kind, safety));
    reluctance.set(e.kind,
      discardReluctance(e.kind, view, tilePool, doraKinds, e.tile) * (0.35 + params.valueGreed * 1.3)
      + directionReluctance(e.kind, tilePool, melds, params));
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

  // -- Pushing ---------------------------------------------------------------
  // Shanten is a hard tier: never accept a worse shape for a prettier tile.
  // Inside the tier, acceptance is the efficiency number that matters, value
  // pulls back on tiles worth keeping, and danger breaks near-ties towards the
  // safer discard even while pushing.
  const bestShanten = Math.min(...evals.map((e) => e.shanten));
  const optimal = evals.filter((e) => e.shanten === bestShanten);
  const suboptimal = evals.filter((e) => e.shanten > bestShanten);

  const late = drawsLeft(view) <= 4;
  const score = (e: DiscardEval): number => {
    const rel = reluctance.get(e.kind) ?? 0;
    let v = e.acceptance + e.acceptKinds * 0.6;
    v -= rel * 5;                       // keep dora, red fives and yakuhai
    v -= (danger.get(e.kind) ?? 0) * (1 + params.safetyAwareness * 4); // free safety when the shape allows it
    // With the wall nearly gone, width stops paying and tenpai starts paying:
    // the noten penalty is real money and a wide 2-shanten hand is not.
    if (late) v = v * 0.4 - rel * 3;
    return v;
  };

  const byScore = (list: DiscardEval[]) =>
    list.slice().sort((a, b) => score(b) - score(a) || a.kind - b.kind);

  // A deliberate execution mistake: give up one shanten tier. Personality
  // variation below is separate and never gives up a tier.
  if (suboptimal.length > 0 && rng.chance(params.efficiencyNoise)) {
    const near = suboptimal.filter((e) => e.shanten <= bestShanten + 1);
    const pick = byScore(near.length > 0 ? near : suboptimal)[0];
    return {
      tile: pick.tile,
      kind: pick.kind,
      rationale: `push (loose): shanten ${pick.shanten}, accept ${pick.acceptance}`,
    };
  }

  const ranked = byScore(optimal);
  // A smaller slip: right tier, second-best tile.
  let pick = ranked.length > 1 && rng.chance(params.efficiencyNoise * 0.5)
    ? ranked[1]
    : ranked[0];
  // Personality, not sabotage: Majima varies only between similarly useful
  // discards, never a worse shanten or a markedly more dangerous tile.
  if (pick === ranked[0] && ranked.length > 1 && rng.chance(params.deviation)) {
    const near = ranked.filter((e) => score(e) >= score(ranked[0]) - 2
      && danger.get(e.kind)! <= danger.get(ranked[0].kind)! + 0.05);
    if (near.length > 1) pick = rng.pick(near);
  }

  return {
    tile: pick.tile,
    kind: pick.kind,
    rationale: `push: shanten ${pick.shanten}, accept ${pick.acceptance}, danger ${danger
      .get(pick.kind)!
      .toFixed(2)}`,
  };
}
