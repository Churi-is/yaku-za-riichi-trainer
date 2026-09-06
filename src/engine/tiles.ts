/**
 * engine/tiles — tile encoding helpers.
 *
 * THE ENCODING (memorize):
 *   TileKind 0..33: m1-m9 = 0-8, p1-p9 = 9-17, s1-s9 = 18-26,
 *                   E,S,W,N = 27-30, Haku,Hatsu,Chun = 31-33.
 *   TileId 0..135:  id = kind * 4 + copyIndex, copyIndex 0..3.
 *   Red fives are copy index 0 of m5/p5/s5 -> TileId 16, 52, 88.
 *
 * `kindOf` and `isRed` take TileId values (0..135). Suit/rank helpers and
 * predicates (`isHonor`, `isTerminal`, `isSimple`, ...) take TileKind values
 * (0..33). They are not interchangeable.
 */
import type { SeatIndex, Suit, TileId, TileKind, Wind } from './types';

/** Seats in turn order. Iterate this instead of doing modular arithmetic on
 *  a `SeatIndex` — `(3 + 1) % 4` is 0, which silently never terminates a loop. */
export const SEATS: SeatIndex[] = [0, 1, 2, 3];

/** The seat that acts after `seat`. */
export function nextSeat(seat: SeatIndex): SeatIndex {
  return SEATS[(seat + 1) % 4];
}

/** Seats in call-priority order after `from` (turn order from the discarder). */
export function seatsAfter(from: SeatIndex): SeatIndex[] {
  return [SEATS[(from + 1) % 4], SEATS[(from + 2) % 4], SEATS[(from + 3) % 4]];
}

export const KIND_COUNT = 34;
const TILE_COUNT = 136;
const COPIES_PER_KIND = 4;

const SUIT_OF_KIND: Suit[] = (() => {
  const out: Suit[] = new Array(KIND_COUNT);
  for (let k = 0; k < KIND_COUNT; k++) out[k] = k < 9 ? 'm' : k < 18 ? 'p' : k < 27 ? 's' : 'z';
  return out;
})();

const RANK_OF_KIND: number[] = (() => {
  const out: number[] = new Array(KIND_COUNT);
  for (let k = 0; k < KIND_COUNT; k++) out[k] = k < 27 ? (k % 9) + 1 : (k - 27) + 1;
  return out;
})();

const WINDS: Wind[] = ['east', 'south', 'west', 'north'];
/** Kind index of the first honor tile (East). */
const HONOR_START = 27;

const DRAGON_KINDS: TileKind[] = [31, 32, 33];

/** Red five = copy index 0 of m5 (kind 4), p5 (kind 13), s5 (kind 22). */
export const RED_FIVE_KINDS: TileKind[] = [4, 13, 22];

/** Ryuuiisou (all green): 2s,3s,4s,6s,8s + Hatsu. */
export const GREEN_KINDS: TileKind[] = [19, 20, 21, 23, 25, 32];

// ---------------------------------------------------------------------------
// id <-> kind
// ---------------------------------------------------------------------------

export function kindOf(id: TileId): TileKind {
  return (id / 4) | 0;
}

export function idOf(kind: TileKind, copy = 0): TileId {
  return kind * COPIES_PER_KIND + copy;
}

// ---------------------------------------------------------------------------
// suit / rank (TileKind in)
// ---------------------------------------------------------------------------

export function suitOfKind(kind: TileKind): Suit {
  return SUIT_OF_KIND[kind];
}

export function rankOfKind(kind: TileKind): number {
  return RANK_OF_KIND[kind];
}

/** True for the physical red-five copies (16, 52, 88). */
export function isRed(id: TileId): boolean {
  return id === 16 || id === 52 || id === 88;
}

export function isRedKind(kind: TileKind): boolean {
  return kind === 4 || kind === 13 || kind === 22;
}

// ---------------------------------------------------------------------------
// kind predicates
// ---------------------------------------------------------------------------

export function isHonor(kind: TileKind): boolean {
  return kind >= HONOR_START;
}

export function isWind(kind: TileKind): boolean {
  return kind >= 27 && kind <= 30;
}

export function isDragon(kind: TileKind): boolean {
  return kind >= 31 && kind <= 33;
}

export function isTerminal(kind: TileKind): boolean {
  return kind < 27 && (kind % 9 === 0 || kind % 9 === 8);
}

export function isSimple(kind: TileKind): boolean {
  return kind < 27 && kind % 9 !== 0 && kind % 9 !== 8;
}

/** Terminals and honors — the "yaochuuhai" class. */
export function isTerminalOrHonor(kind: TileKind): boolean {
  return kind >= 27 || kind % 9 === 0 || kind % 9 === 8;
}

// ---------------------------------------------------------------------------
// winds
// ---------------------------------------------------------------------------

export function kindOfWind(wind: Wind): TileKind {
  return 27 + WINDS.indexOf(wind);
}

/** Yakuhai kinds for a seat: dragons always, plus round and seat wind. */
export function yakuhaiKinds(seatWind: Wind, roundWind: Wind): TileKind[] {
  const kinds = [...DRAGON_KINDS, kindOfWind(roundWind)];
  const sw = kindOfWind(seatWind);
  if (sw !== kindOfWind(roundWind)) kinds.push(sw);
  return kinds;
}

// ---------------------------------------------------------------------------
// counts
// ---------------------------------------------------------------------------

/** 34-slot count array from a list of tile ids. */
export function countsFromIds(ids: TileId[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0);
  for (const id of ids) counts[kindOf(id)]++;
  return counts;
}

/** Expand a 34-slot count array back into tile ids (lowest copies first). */
export function idsFromCounts(counts: readonly number[]): TileId[] {
  const ids: TileId[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    for (let c = 0; c < counts[k]; c++) ids.push(idOf(k, c));
  }
  return ids;
}

export function sortIds(ids: TileId[]): TileId[] {
  return [...ids].sort((a, b) => a - b);
}

function sortKinds(kinds: TileKind[]): TileKind[] {
  return [...kinds].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// display names
// ---------------------------------------------------------------------------

const HONOR_NAMES = ['East', 'South', 'West', 'North', 'Haku', 'Hatsu', 'Chun'];

/** Short canonical name for a kind: "5m", "East", "Chun". */
export function tileName(kind: TileKind): string {
  if (kind < 0 || kind >= KIND_COUNT) return '?';
  if (kind >= HONOR_START) return HONOR_NAMES[kind - HONOR_START];
  return `${RANK_OF_KIND[kind]}${SUIT_OF_KIND[kind]}`;
}

/** "Chi 3-4m"-style label for a set of kinds. */
export function kindsLabel(kinds: TileKind[]): string {
  if (!kinds.length) return '';
  const sorted = sortKinds(kinds);
  const suit = SUIT_OF_KIND[sorted[0]];
  if (suit === 'z') return sorted.map((k) => tileName(k)).join(' ');
  if (sorted.every((k) => SUIT_OF_KIND[k] === suit)) {
    return `${sorted.map((k) => RANK_OF_KIND[k]).join('-')}${suit}`;
  }
  return sorted.map((k) => tileName(k)).join(' ');
}

/** Every tile id in the 136-tile set, in order. */
export function allTileIds(): TileId[] {
  const ids: TileId[] = new Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i++) ids[i] = i;
  return ids;
}

/** Dora kind for an indicator kind, with wraparound (9->1, N->E, Chun->Haku). */
export function doraKindForIndicator(indicator: TileKind): TileKind {
  if (indicator >= HONOR_START) {
    return indicator <= 30 ? 27 + ((indicator - 27 + 1) % 4) : 31 + ((indicator - 31 + 1) % 3);
  }
  return indicator - (indicator % 9) + ((indicator % 9) + 1) % 9;
}
