/**
 * engine/draw — drawing tiles and flipping dora. Owned by Worker A.
 *
 * All randomness happened at deal time, so drawing is a deterministic pop and
 * `applyAction` stays pure. These helpers mutate a state the caller has
 * already cloned.
 */
import { DORA_SLOTS, URA_SLOTS } from './wall';
import type { GameState, SeatIndex, TileId } from './types';

/** Take the next live tile, or null when the wall is exhausted. */
export function drawFromWall(state: GameState): TileId | null {
  if (state.wall.length === 0) return null;
  return state.wall.shift() as TileId;
}

/**
 * Rinshan kaihou: draw a replacement from the dead wall and move a live tile
 * across to keep it whole. This is what shrinks the live wall by one per kan.
 *
 * The replacement is spliced OUT of the dead wall, so a tile is never in two
 * places at once; the next replacement therefore always sits at the same
 * index, immediately after the ura slots.
 */
export function rinshanDraw(state: GameState): TileId | null {
  const tile = state.deadWall.splice(DORA_SLOTS + URA_SLOTS, 1)[0];
  if (tile === undefined) return null; // more than four kans: impossible anyway
  const moved = state.wall.pop();
  if (moved !== undefined) state.deadWall.push(moved);
  return tile;
}

/** Flip the next dora (and stage the next ura) indicator. */
export function flipKanDora(state: GameState): void {
  const doraIdx = state.doraIndicators.length;
  const uraIdx = DORA_SLOTS + state.uraIndicators.length;
  const dora = state.deadWall[doraIdx];
  const ura = state.deadWall[uraIdx];
  if (dora !== undefined) state.doraIndicators.push(dora);
  if (ura !== undefined) state.uraIndicators.push(ura);
}

/** True when the tile just drawn was the last one in the live wall. */
export function isLastLiveTile(state: GameState): boolean {
  return state.wall.length === 0;
}

/** Seats in turn order starting at `from` (inclusive). */
export function turnOrderFrom(from: SeatIndex): SeatIndex[] {
  return [0, 1, 2, 3].map((i) => ((from + i) % 4) as SeatIndex);
}
