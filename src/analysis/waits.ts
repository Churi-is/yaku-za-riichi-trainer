/**
 * analysis/waits — Worker C. Winning-tile computation for PUBLIC hands.
 *
 * The engine (Worker A) exposes `waits(hand, melds)`; replay grading and
 * wait-guess resolution call it through this ONE wrapper so live overlays and
 * grades can never disagree about waits.
 *
 * Engine semantics: `waits` expects exactly `13 - 3*melds` concealed tiles
 * (the waiting shape). Callers that hold a just-drawn 14th tile must use
 * `computeWaitsWaiting`, which normalizes first.
 */
import type { Meld, TileId } from '@engine/types';
import { waits as engineWaits } from '@engine/index';
import { waitingShape } from './tileUtil';

/** Waits for a hand already in waiting shape (13 - 3*melds tiles). */
export function computeWaits(hand: TileId[], melds: Meld[]): number[] {
  return engineWaits(hand, melds);
}

/** Waits for a hand that may include a freshly drawn tile. */
export function computeWaitsWaiting(
  hand: TileId[], drawnTile: TileId | null, melds: Meld[],
): number[] {
  return engineWaits(waitingShape(hand, drawnTile, melds.length), melds);
}
