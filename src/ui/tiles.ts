/** Display labels and stable hand ordering, using the engine's tile encoding. */
import { kindOf, suitOfKind, rankOfKind, isRed } from '@engine/index';
import type { Suit, TileId } from '@engine/types';

interface DecodedTile {
  suit: Suit;
  /** 1–9 for suited tiles; 1–7 for honors (winds 1–4, dragons 5–7). */
  rank: number;
}

export function decodeTile(id: TileId): DecodedTile {
  const kind = kindOf(id);
  return { suit: suitOfKind(kind), rank: rankOfKind(kind) };
}

const SUIT_NAMES = { m: 'man', p: 'pin', s: 'sou' };
const WIND_NAMES = ['East', 'South', 'West', 'North'];
const DRAGON_NAMES = ['White', 'Green', 'Red'];

/** Accessible label, e.g. "3 man", "East wind", or "Green dragon". */
export function tileLabel(id: TileId): string {
  const { suit, rank } = decodeTile(id);
  if (suit !== 'z') return `${rank} ${SUIT_NAMES[suit]}`;
  if (rank <= 4) return `${WIND_NAMES[rank - 1]} wind`;
  return `${DRAGON_NAMES[rank - 5]} dragon`;
}

function tileSortKey(id: TileId): number {
  return kindOf(id) * 10 + (isRed(id) ? 0 : 1);
}

/**
 * Sort m < p < s < z, red fives first. Unlike the engine's physical-ID sort,
 * preserve the incoming order of ordinary copies of the same kind.
 */
export function sortTiles(ids: readonly TileId[]): TileId[] {
  return [...ids].sort((a, b) => tileSortKey(a) - tileSortKey(b));
}
