/** Small, explainable personality preferences; no hidden information. */
import type { Meld, PublicView, TileId, TileKind } from '@engine/types';
import type { AIParams } from './types';
import { countsOf, isHonor, kindOf } from './handEval';

/** Positive = comeback pressure, negative = protect a final-round lead. */
export function placementPressure(view: PublicView, params: AIParams): number {
  const lastWind = view.settings.gameLength === 'east' ? 'east' : 'south';
  if (view.roundWind !== lastWind || view.roundNumber < 4) return 0;
  const mine = view.seats[view.viewer].points;
  const others = Object.values(view.seats).filter((s) => s.seat !== view.viewer).map((s) => s.points);
  const lead = mine - Math.max(...others);
  if (lead > 0) return -params.placementAwareness * (0.14 + Math.min(0.16, lead / 60000));
  const ahead = others.filter((n) => n > mine);
  if (!ahead.length) return 0; // tied leaders do not have a protected lead
  const gap = Math.min(...ahead) - mine;
  const last = others.every((n) => n > mine);
  return params.placementAwareness * ((last ? 0.15 : 0.06) + Math.min(0.12, gap / 80000));
}

/** Only follow a flush if the deal supports it and no open meld contradicts it. */
export function flushDirection(pool: TileId[], melds: Meld[]): number | null {
  const tiles = pool.concat(melds.flatMap((m) => m.tiles));
  const suits = [0, 0, 0];
  for (const t of tiles) { const k = kindOf(t); if (!isHonor(k)) suits[Math.floor(k / 9)]++; }
  const best = suits.indexOf(Math.max(...suits));
  if (suits[best] < Math.max(7, tiles.length * 0.55)) return null;
  if (melds.some((m) => m.tiles.some((t) => !isHonor(kindOf(t)) && Math.floor(kindOf(t) / 9) !== best))) return null;
  return best;
}

/** Extra reluctance to shed a tile, applied only WITHIN the best shanten tier. */
export function directionReluctance(kind: TileKind, pool: TileId[], melds: Meld[], params: AIParams): number {
  let reluctance = 0;
  const suit = params.flushBias > 0 ? flushDirection(pool, melds) : null;
  if (suit !== null) {
    if (!isHonor(kind) && Math.floor(kind / 9) === suit) reluctance += params.flushBias * 2.2;
    else if (isHonor(kind)) reluctance += params.flushBias * 0.35;
  }
  if (params.pairBias > 0 && !melds.some((m) => m.type === 'chi')) {
    const counts = countsOf(pool);
    const blocks = counts.filter((n) => n >= 2).length + melds.length;
    if (blocks >= 4 && counts[kind] >= 2) reluctance += params.pairBias * (counts[kind] === 2 ? 1.5 : 0.7);
  }
  return reluctance;
}
