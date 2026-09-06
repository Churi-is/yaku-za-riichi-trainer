/**
 * engine/furiten — all three kinds of furiten.
 *
 *   permanent  one of your own discards is among your waits
 *   temporary  you passed on a ron chance; clears on your next draw
 *   riichi     you passed on a ron after declaring riichi; locked for the hand
 *
 * Furiten blocks RON only. Tsumo is always allowed.
 */
import { kindOf } from './tiles';
import { shanten, waits } from './shanten';
import type { GameState, PlayerState, SeatIndex, TileKind } from './types';

/** Wait kinds for a seat's current 13-tile shape (empty if not tenpai). */
function waitsFor(player: PlayerState): TileKind[] {
  return waits(player.hand, player.melds);
}

/** True when the seat's own river contains one of its waits. */
function isPermanentFuriten(player: PlayerState): boolean {
  if (shanten(player.hand, player.melds) !== 0) return false;
  const w = waitsFor(player);
  if (w.length === 0) return false;
  // Every discard counts, including ones that were later called away.
  return player.river.some((entry) => w.includes(kindOf(entry.tile)));
}

/** Any furiten flavour that blocks a ron right now. */
export function blocksRon(player: PlayerState): boolean {
  return player.furiten || player.temporaryFuriten || player.riichiFuriten;
}

/** Refresh the permanent flag; called after anything that changes the waits. */
export function refreshFuriten(player: PlayerState): void {
  player.furiten = isPermanentFuriten(player);
}

/** Called when a seat declines a ron-able discard. */
export function applyPassedRon(player: PlayerState): void {
  player.temporaryFuriten = true;
  if (player.riichi) player.riichiFuriten = true;
}

/** Called when a seat draws: temporary furiten lapses. */
export function onDraw(player: PlayerState): void {
  player.temporaryFuriten = false;
  refreshFuriten(player);
}

/** Which seats are tenpai, for the exhaustive-draw payment. */
export function tenpaiSeats(state: GameState): SeatIndex[] {
  const out: SeatIndex[] = [];
  for (const p of state.players) {
    if (shanten(p.hand, p.melds) === 0) out.push(p.seat);
  }
  return out;
}
