/**
 * engine/wall — shuffling and dealing. Owned by Worker A.
 *
 * The full 136-tile set is shuffled once per hand and split into the live
 * wall and the dead wall, so no randomness is needed mid-hand: drawing is a
 * deterministic pop, which is what keeps `applyAction` pure.
 *
 * Dead wall layout (first 14 entries, fixed):
 *   [0..4]   dora indicator slots  (5: one at deal + one per kan, max 4 kans)
 *   [5..9]   ura indicator slots   (5: mirror the dora slots)
 *   [10..13] kan replacement tiles (drawn in index order, rinshan kaihou)
 * Each kan appends one more entry: the live-wall tile moved into the dead
 * wall. That append is what shrinks the live wall by one per kan.
 */
import { createRng, seedForHand, shuffle } from './rng';
import { allTileIds, SEATS } from './tiles';
import type { SeatIndex, TableSettings, TileId } from './types';

export const DORA_SLOTS = 5;
export const URA_SLOTS = 5;
export const KAN_REPLACEMENTS = 4;
export const DEAD_WALL_SIZE = DORA_SLOTS + URA_SLOTS + KAN_REPLACEMENTS; // 14
export const STARTING_HAND_SIZE = 13;

export interface Deal {
  /** Live wall, draw order = index 0 first. */
  wall: TileId[];
  deadWall: TileId[];
  /** 13 tiles per seat; the dealer's 14th tile is `wall[0]`. */
  hands: [TileId[], TileId[], TileId[], TileId[]];
  doraIndicators: TileId[];
  uraIndicators: TileId[];
}

/** Index of the kan replacement tile for the (0-based) nth kan this hand. */
export function replacementIndex(kanOrdinal: number): number {
  return DORA_SLOTS + URA_SLOTS + kanOrdinal;
}

/** Deal a full hand's worth of tiles for `handNumber` of a seeded match. */
export function dealHand(seed: number, handNumber: number, _settings: TableSettings): Deal {
  const rng = createRng(seedForHand(seed, handNumber));
  const shuffled = shuffle(allTileIds(), rng);

  // Dead wall comes off the end, as at a real table.
  const deadWall = shuffled.slice(shuffled.length - DEAD_WALL_SIZE);
  const rest = shuffled.slice(0, shuffled.length - DEAD_WALL_SIZE);

  // Deal four rounds of three to each seat in turn order, then one each,
  // then the dealer's extra tile (which stays on the wall as `wall[0]`).
  const hands: [TileId[], TileId[], TileId[], TileId[]] = [[], [], [], []];
  let cursor = 0;
  for (let round = 0; round < 4; round++) {
    for (const seat of SEATS) {
      hands[seat].push(...rest.slice(cursor, cursor + 3));
      cursor += 3;
    }
  }
  for (const seat of SEATS) {
    hands[seat].push(rest[cursor]);
    cursor += 1;
  }

  const wall = rest.slice(cursor); // 122 - 13*4 = 70 live tiles
  return {
    wall,
    deadWall,
    hands: [sortHand(hands[0]), sortHand(hands[1]), sortHand(hands[2]), sortHand(hands[3])],
    doraIndicators: [deadWall[0]],
    uraIndicators: [deadWall[DORA_SLOTS]],
  };
}

function sortHand(ids: TileId[]): TileId[] {
  return [...ids].sort((a, b) => a - b);
}

/** Sanity check used by tests: a deal must consume the whole 136-tile set. */
export function isCompleteDeal(deal: Deal): boolean {
  const seen = new Set<TileId>();
  const add = (ids: TileId[]) => {
    for (const id of ids) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
    return true;
  };
  if (!add(deal.wall) || !add(deal.deadWall)) return false;
  for (const h of deal.hands) if (!add(h)) return false;
  return seen.size === 136;
}
