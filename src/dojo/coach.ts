/**
 * Where the coach card goes, and how big it is.
 *
 * The card takes real room on the screen and the board rescales to what is
 * left, so it can never cover the thing it is talking about. That leaves two
 * questions per step, both answered from the SUBJECT of the step — which
 * seats' tiles are lit, whether the centre is lit, whether the player is
 * about to tap a tile — rather than fixed once for the whole lesson:
 *
 *   - which side of the felt the card sits on (next to its subject), and
 *   - how much of the screen it may take (no more than it has to say).
 *
 * Pure functions, so the rule is testable without a browser.
 */
import type { PublicView, SeatIndex, TileId } from '@engine/types';

/** What a step is pointing at, as regions of the table. */
export interface Subject {
  /** own hand tiles are lit, or the step asks you to tap one */
  hand: boolean;
  /** which seats' ponds (or melds) hold lit tiles */
  ponds: Set<SeatIndex>;
  /** the centre block (dora, wall count) is lit */
  centre: boolean;
}

export function subjectOf(
  view: PublicView | null,
  lit: TileId[],
  opts: { centre?: boolean; tapping?: boolean } = {},
): Subject {
  const ponds = new Set<SeatIndex>();
  let hand = Boolean(opts.tapping);
  if (view && lit.length) {
    const set = new Set(lit);
    const mine = new Set([...view.hand, ...(view.drawnTile !== null ? [view.drawnTile] : [])]);
    for (const id of set) if (mine.has(id)) hand = true;
    for (const s of [0, 1, 2, 3] as SeatIndex[]) {
      const seat = view.seats[s];
      if (seat.river.some((d) => set.has(d.tile))) ponds.add(s);
      if (seat.melds.some((m) => m.tiles.some((t) => set.has(t)))) ponds.add(s);
    }
  }
  return { hand, ponds, centre: Boolean(opts.centre) };
}

/**
 * Portrait: the card sits above or below the felt. Your hand and your own
 * pond are at the bottom of the board, so anything about them — and every
 * drill you answer by tapping — puts the card at the bottom, right next to
 * the tiles. Talk about the other seats or the centre and it moves to the
 * top, which also leaves your hand exactly where your thumb expects it.
 */
export type PortraitEnd = 'top' | 'bottom';

export function portraitEnd(subject: Subject, forced?: PortraitEnd): PortraitEnd {
  if (forced) return forced;
  if (subject.hand || subject.ponds.has(0)) return 'bottom';
  if (subject.centre || subject.ponds.size) return 'top';
  return 'bottom'; // nothing lit: reading, the card sits low like a caption
}

/**
 * Landscape: the card docks in a column beside the felt. It goes on the side
 * of the seat being discussed — the seat to your right when their pond is
 * lit, the left for the seat to your left — and otherwise on the right,
 * where the drawn tile and the Next button already are.
 */
export type LandscapeSide = 'left' | 'right';

export function landscapeSide(subject: Subject): LandscapeSide {
  const right = subject.ponds.has(1);
  const left = subject.ponds.has(3);
  if (left && !right) return 'left';
  return 'right';
}

export type Placement = PortraitEnd | LandscapeSide;

/**
 * How much of the felt the card may take. A one-line prompt should not push
 * the table into a corner; a drill's verdict needs the room, and by then
 * there is nothing left to tap.
 */
export type CardSize = 'sm' | 'md' | 'lg';

export function cardSize(
  words: number,
  opts: { answered?: boolean; figures?: number; choices?: number } = {},
): CardSize {
  if (opts.answered) return 'lg';
  // a tile figure is a row of tiles plus a caption; a written choice is a
  // button the reader has to see whole
  const load = words + (opts.figures ?? 0) * 25 + (opts.choices ?? 0) * 18;
  if (load <= 45) return 'sm';
  if (load <= 110) return 'md';
  return 'lg';
}
