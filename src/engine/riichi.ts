/**
 * engine/riichi — declaration rules. Owned by Worker A.
 *
 * Closed hands only, 1000-point stick, never after a call, must leave the hand
 * tenpai, and not available when fewer than 4 tiles remain in the live wall
 * (per the brief: no draw would follow the declaration).
 */
import { sortIds } from './tiles';
import { shanten } from './shanten';
import type { GameState, PlayerState, SeatIndex, TileId } from './types';

export const RIICHI_COST = 1000;
export const MIN_WALL_FOR_RIICHI = 4;

/** Basic eligibility, before looking at which tile is being discarded. */
export function canRiichiAtAll(state: GameState, seat: SeatIndex): boolean {
  const p = state.players[seat];
  if (p.riichi || !p.isClosed) return false;
  if (p.points < RIICHI_COST) return false;
  if (state.wall.length < MIN_WALL_FOR_RIICHI) return false;
  if (state.phase !== 'awaitingDiscard' || state.turn !== seat) return false;
  return true;
}

/** The 13-tile shape that would remain after discarding `tile`. */
export function shapeAfterDiscard(p: PlayerState, tile: TileId): TileId[] {
  const pool = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  const idx = pool.indexOf(tile);
  if (idx < 0) return [];
  return sortIds([...pool.slice(0, idx), ...pool.slice(idx + 1)]);
}

/** True when discarding `tile` leaves the hand tenpai. */
export function leavesTenpai(p: PlayerState, tile: TileId): boolean {
  const shape = shapeAfterDiscard(p, tile);
  if (shape.length === 0) return false;
  return shanten(shape, p.melds) === 0;
}

/** True when this is a double-riichi window: first go-around, no calls yet. */
export function isDoubleRiichiWindow(state: GameState, seat: SeatIndex): boolean {
  if (state.turnNumber > seat) return false;
  return state.players.every((pl) => pl.melds.length === 0);
}

/** Every tile this seat could discard while declaring riichi. */
export function riichiDiscards(state: GameState, seat: SeatIndex): TileId[] {
  if (!canRiichiAtAll(state, seat)) return [];
  const p = state.players[seat];
  const pool = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  return [...new Set(pool)].filter((tile) => leavesTenpai(p, tile));
}
