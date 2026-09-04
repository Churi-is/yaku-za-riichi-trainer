/**
 * UI-local tile decoding + display helpers. Owned by Worker D.
 *
 * These derive purely from the FROZEN tile encoding in docs/CONTRACTS.md
 * (id = kind * 4 + copyIndex; kinds m1-9=0-8, p1-9=9-17, s1-9=18-26,
 * E/S/W/N=27-30, Haku/Hatsu/Chun=31-33). Decoding is a rendering concern,
 * so it lives in the UI and never reaches into engine internals.
 *
 * Red-five convention (until Worker A's isRed lands): copyIndex 0 of
 * m5/p5/s5 is the red copy when aka dora is enabled. The fallback engine in
 * src/state uses the same convention, so rendering stays consistent.
 */
import type { Suit, TileId, TileKind } from '@engine/types';

export const RED_FIVE_IDS: ReadonlySet<number> = new Set([16, 52, 88]); // m5,p5,s5 copy 0

export interface DecodedTile {
  kind: TileKind;
  suit: Suit;
  /** 1-9 for suited tiles; 1-7 for honors (winds 1-4, dragons 5-7). */
  rank: number;
}

export function kindOf(id: TileId): TileKind {
  return Math.floor(id / 4);
}

export function decodeKind(kind: TileKind): DecodedTile {
  if (kind < 9) return { kind, suit: 'm', rank: kind + 1 };
  if (kind < 18) return { kind, suit: 'p', rank: kind - 9 + 1 };
  if (kind < 27) return { kind, suit: 's', rank: kind - 18 + 1 };
  return { kind, suit: 'z', rank: kind - 27 + 1 };
}

export function decodeTile(id: TileId): DecodedTile {
  return decodeKind(kindOf(id));
}

export function isRedFiveId(id: TileId): boolean {
  return RED_FIVE_IDS.has(id);
}

const NUM_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT_KANJI: Record<Exclude<Suit, 'z'>, string> = { m: '萬', p: '筒', s: '索' };
const WIND_KANJI = ['東', '南', '西', '北'];
const DRAGON_KANJI = ['白', '發', '中'];
const WIND_NAMES = ['East', 'South', 'West', 'North'];
const DRAGON_NAMES = ['White', 'Green', 'Red'];

export interface TileFace {
  /** Primary glyph (numeral or honor character). */
  glyph: string;
  /** Secondary glyph for suited tiles (suit kanji), empty for honors. */
  suitGlyph: string;
  /** 'man' | 'pin' | 'sou' | 'wind' | 'dragon' — drives colour styling. */
  group: 'man' | 'pin' | 'sou' | 'wind' | 'dragon';
  /** Accessible label, e.g. "3 man", "East wind", "Green dragon". */
  label: string;
}

export function tileFace(id: TileId): TileFace {
  const { suit, rank } = decodeTile(id);
  if (suit === 'm') return { glyph: NUM_KANJI[rank - 1], suitGlyph: SUIT_KANJI.m, group: 'man', label: `${rank} man` };
  if (suit === 'p') return { glyph: NUM_KANJI[rank - 1], suitGlyph: SUIT_KANJI.p, group: 'pin', label: `${rank} pin` };
  if (suit === 's') return { glyph: NUM_KANJI[rank - 1], suitGlyph: SUIT_KANJI.s, group: 'sou', label: `${rank} sou` };
  if (rank <= 4) return { glyph: WIND_KANJI[rank - 1], suitGlyph: '', group: 'wind', label: `${WIND_NAMES[rank - 1]} wind` };
  return { glyph: DRAGON_KANJI[rank - 5], suitGlyph: '', group: 'dragon', label: `${DRAGON_NAMES[rank - 5]} dragon` };
}

/** Sort key so hands render m < p < s < z, ascending rank, red fives before plain. */
export function tileSortKey(id: TileId): number {
  return kindOf(id) * 10 + (isRedFiveId(id) ? 0 : 1);
}

export function sortTiles(ids: TileId[]): TileId[] {
  return [...ids].sort((a, b) => tileSortKey(a) - tileSortKey(b));
}

/** The dora tile a given indicator points to (next in the wrap-around sequence). */
export function doraFromIndicator(indicatorId: TileId): TileKind {
  const { suit, rank } = decodeTile(indicatorId);
  if (suit === 'z') {
    if (rank <= 4) return 27 + (rank % 4); // winds wrap E->S->W->N->E
    return 31 + ((rank - 5 + 1) % 3); // dragons wrap Haku->Hatsu->Chun->Haku
  }
  const base = suit === 'm' ? 0 : suit === 'p' ? 9 : 18;
  return base + (rank % 9); // 9 wraps to 1
}
