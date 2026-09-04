/**
 * analysis/tileUtil — Worker C. Public-only tile helpers built on the
 * CANONICAL engine tiles module (`src/engine/tiles.ts`, Worker A).
 *
 * Numeric helpers re-export A's implementations so there is exactly one
 * encoding / red-five convention across the codebase (see CONTRACTS.md).
 * Analysis-specific conveniences (labels, wall-remaining math, full-hand
 * assembly) live here and take only public TileIds/TileKinds.
 */
import type { Suit, TileId, TileKind } from '@engine/types';
import {
  kindOf, copyIndex, idOf, suitOfKind, rankOfKind, isHonor, isTerminal,
  isSimple, isWind, isDragon, isRed, countsFromIds, doraKindForIndicator,
  kindOfWind, tileName,
} from '@engine/tiles';

export {
  kindOf, copyIndex, idOf, suitOfKind, rankOfKind, isHonor, isTerminal,
  isSimple, isWind, isDragon, isRed, countsFromIds, doraKindForIndicator,
};

/** Alias kept for readability in analysis prose. */
export const isHonorKind = isHonor;
export const isTerminalKind = isTerminal;
export const isSimpleKind = isSimple;
export const isWindKind = isWind;
export const isDragonKind = isDragon;

/** Canonical red-five copy index (copy 0 of each 5 — see CONTRACTS.md). */
export const RED_FIVE_COPY_INDEX = 0;

/** Build a canonical tile id from a kind (copy 0). */
export function tileId(kind: TileKind, copy = 0): TileId {
  return idOf(kind, copy);
}

/** Copy index convention exposed for callers that build fixtures. */
export function copyIndexOf(id: TileId): number {
  return copyIndex(id);
}

/** True for the canonical red-five copies when red fives are enabled. */
export function isRedFive(id: TileId): boolean {
  return isRed(id);
}

export const SUIT_LABEL: Record<Suit, string> = {
  m: 'man', p: 'pin', s: 'sou', z: 'honor',
};

export const HONOR_SHORT = ['E', 'S', 'W', 'N', 'Haku', 'Hatsu', 'Chun'] as const;
export const HONOR_LONG = [
  'East wind', 'South wind', 'West wind', 'North wind',
  'White dragon', 'Green dragon', 'Red dragon',
] as const;

export const WIND_KIND: Record<'east' | 'south' | 'west' | 'north', TileKind> = {
  east: kindOfWind('east'), south: kindOfWind('south'),
  west: kindOfWind('west'), north: kindOfWind('north'),
};

export const DRAGON_KIND: Record<'haku' | 'hatsu' | 'chun', TileKind> = {
  haku: 31, hatsu: 32, chun: 33,
};

/** Short label like "4m", "7p", "E" (canonical engine names for suits). */
export function kindShort(kind: TileKind): string {
  return tileName(kind);
}

/** Long English label like "4-man", "7-pin", "East wind" (prose/reasoning). */
export function kindLabel(kind: TileKind): string {
  const s = suitOfKind(kind);
  if (s === 'z') return HONOR_LONG[kind - 27];
  return `${rankOfKind(kind)}-${SUIT_LABEL[s]}`;
}

/** Indicator kind → dora kind (canonical engine wrap: 9→1, N→E, Chun→Haku). */
export function doraKindOf(indicatorKind: TileKind): TileKind {
  return doraKindForIndicator(indicatorKind);
}

/** Remaining copies of a kind (4 - visible), clamped to 0. */
export function remainingOf(kind: TileKind, visibleCounts: number[]): number {
  return Math.max(0, 4 - (visibleCounts[kind] ?? 0));
}

/** Total remaining lives, i.e. sum of `remainingOf` over all kinds. */
export function remainingAll(visibleCounts: number[]): number {
  let sum = 0;
  for (let k = 0; k < 34; k++) sum += remainingOf(k, visibleCounts);
  return sum;
}

/** All distinct kinds of the given ids, sorted ascending. */
export function distinctKinds(ids: TileId[]): TileKind[] {
  return [...new Set(ids.map(kindOf))].sort((a, b) => a - b);
}

/**
 * Tiles of the viewer's hand, including the just-drawn tile.
 * Defensive about hand/drawnTile overlap so either schema convention works.
 */
export function fullHand(hand: TileId[], drawnTile: TileId | null): TileId[] {
  const out = [...hand];
  if (drawnTile !== null && !out.includes(drawnTile)) out.push(drawnTile);
  return out.sort((a, b) => a - b);
}

/**
 * The 13 - 3*melds waiting shape of a viewer's hand. The engine's
 * `shanten`/`ukeire`/`waits` require exactly this size, so callers of the
 * shared engine functions must normalize first (hand+drawn conventions vary).
 */
export function waitingShape(
  hand: TileId[], drawnTile: TileId | null, meldCount: number,
): TileId[] {
  const goal = 13 - 3 * meldCount;
  let tiles = fullHand(hand, drawnTile);
  if (tiles.length > goal) {
    // Drop the freshly drawn tile first (it is the one awaiting a discard).
    const drop = drawnTile !== null ? drawnTile : tiles[tiles.length - 1];
    const i = tiles.indexOf(drop);
    if (i >= 0) tiles.splice(i, 1);
    while (tiles.length > goal) tiles.pop();
  }
  return tiles;
}
