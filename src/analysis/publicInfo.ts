/**
 * analysis/publicInfo — Worker C. Thin, PUBLIC-ONLY view helpers.
 *
 * These derive derived tables from a PublicView. Everything is already
 * public by construction (own hand, rivers, melds, dora indicators, counts).
 * Nothing here may import GameState or read hidden tiles.
 */
import type { PublicView, SeatIndex } from '@engine/types';
import { countsFromIds, kindOf } from './tileUtil';

/** All tile ids the viewer can see: own hand, all rivers, all melds, dora. */
export function visibleTileIds(view: PublicView): number[] {
  const ids: number[] = [...view.hand];
  if (view.drawnTile !== null) ids.push(view.drawnTile);
  for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
    const s = view.seats[seat];
    ids.push(...s.river.map((d) => d.tile));
    for (const m of s.melds) ids.push(...m.tiles);
  }
  ids.push(...view.doraIndicators);
  return ids;
}

/** Recompute visibleCounts defensively (in case the view omits or skews it). */
export function recomputeVisibleCounts(view: PublicView): number[] {
  return countsFromIds(visibleTileIds(view));
}

/** Tiles of a seat's melds, flattened to kinds (public). */
export function meldKinds(view: PublicView, seat: SeatIndex): number[] {
  return view.seats[seat].melds.flatMap((m) => m.tiles.map(kindOf));
}

/** Total number of visible copies of a kind (0-4). */
export function visibleCopiesOf(view: PublicView, kind: number): number {
  return view.visibleCounts[kind] ?? recomputeVisibleCounts(view)[kind] ?? 0;
}

/** Rivers of all seats as TileKinds, keyed by seat. */
export function riverKindMap(view: PublicView): Record<SeatIndex, number[]> {
  return {
    0: view.seats[0].river.map((d) => kindOf(d.tile)),
    1: view.seats[1].river.map((d) => kindOf(d.tile)),
    2: view.seats[2].river.map((d) => kindOf(d.tile)),
    3: view.seats[3].river.map((d) => kindOf(d.tile)),
  };
}

/** True when the seat has made any open call (chi/pon/minkan/kakan). */
export function isOpenSeat(view: PublicView, seat: SeatIndex): boolean {
  return view.seats[seat].melds.some((m) => !m.concealed);
}

/** The human's own hand including the just-drawn tile (public to them). */
export function ownFullHand(view: PublicView): number[] {
  const ids = [...view.hand];
  if (view.drawnTile !== null && !ids.includes(view.drawnTile)) ids.push(view.drawnTile);
  return ids;
}
