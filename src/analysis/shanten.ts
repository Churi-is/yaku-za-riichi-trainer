/**
 * analysis/shanten — Worker C. Facade over the SHARED engine shanten/ukeire.
 *
 * `src/engine/shanten.ts` (Worker A) is the single implementation used by the
 * AI, the live overlays and the replay grader — this file only normalizes the
 * input convention (hand + freshly drawn tile → the 13-tile waiting shape the
 * engine requires) so every caller in src/analysis behaves identically.
 *
 * Engine semantics (documented in engine/shanten.ts):
 *   shanten: -1 = complete, 0 = tenpai, n = n useful exchanges away.
 *   waits / ukeire expect exactly `13 - 3*melds` concealed tiles.
 */
import type { Meld, TileId } from '@engine/types';
import { shanten, ukeire } from '@engine/index';
import { waitingShape } from './tileUtil';

/** Shanten for the current hand (hand + drawn tile), matches the engine. */
export function computeShanten(hand: TileId[], melds: Meld[]): number {
  return shanten(hand, melds);
}

/** Shanten for the current hand normalized to the 13-tile waiting shape. */
export function computeShantenWaiting(hand: TileId[], drawnTile: TileId | null, melds: Meld[]): number {
  return shanten(waitingShape(hand, drawnTile, melds.length), melds);
}

/** Ukeire for the current hand, weighted by remaining visible copies. */
export function computeUkeire(
  hand: TileId[],
  melds: Meld[],
  visibleCounts: number[],
): { kind: number; count: number }[] {
  return ukeire(hand, melds, visibleCounts);
}

/** Ukeire for the 13-tile waiting shape derived from hand + drawn tile. */
export function computeUkeireWaiting(
  hand: TileId[], drawnTile: TileId | null, melds: Meld[], visibleCounts: number[],
): { kind: number; count: number }[] {
  return ukeire(waitingShape(hand, drawnTile, melds.length), melds, visibleCounts);
}
