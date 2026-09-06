/**
 * engine/wall — shuffling and dealing.
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
import { allTileIds, SEATS, sortIds } from './tiles';
import type { TileId } from './types';

export const DORA_SLOTS = 5;
export const URA_SLOTS = 5;
const KAN_REPLACEMENTS = 4;
const DEAD_WALL_SIZE = DORA_SLOTS + URA_SLOTS + KAN_REPLACEMENTS; // 14

interface Deal {
  /** Live wall, draw order = index 0 first. */
  wall: TileId[];
  deadWall: TileId[];
  /** 13 tiles per seat; the dealer's 14th tile is `wall[0]`. */
  hands: [TileId[], TileId[], TileId[], TileId[]];
  doraIndicators: TileId[];
  uraIndicators: TileId[];
}

/** Deal a full hand's worth of tiles for `handNumber` of a seeded match. */
export function dealHand(seed: number, handNumber: number): Deal {
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
    hands: [sortIds(hands[0]), sortIds(hands[1]), sortIds(hands[2]), sortIds(hands[3])],
    doraIndicators: [deadWall[0]],
    uraIndicators: [deadWall[DORA_SLOTS]],
  };
}
