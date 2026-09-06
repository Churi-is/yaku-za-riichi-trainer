/**
 * dojo/coach — where the coach card goes, and how big it is allowed to be.
 *
 * The card used to be one fixed slab pinned across the felt, which meant it
 * sat on top of the right-hand seat for every lesson in the course and was the
 * same size whether it had two sentences or four drill options to show. Both
 * of those are decided here instead, from the step itself:
 *
 *   SLOT.  The card goes to the opposite end of the felt from whatever it is
 *          pointing at. Point at your hand (bottom of the board) and the card
 *          sits at the top; point at an opponent's pond (top of the board) and
 *          it drops to the bottom. On a wide screen it becomes a side rail, so
 *          it never overlaps the board at all.
 *
 *   SIZE.  A one-paragraph teach step gets a small card; a drill with four
 *          options and four explanations gets a large one. The band limits
 *          the expanded overlay in portrait without resizing the board.
 *          Portrait peeks live in a fixed-height strip above the board;
 *          landscape keeps its existing rail or band layout.
 *
 * This is pure data so the test suite can check every expanded step prefers
 * the opposite end from the subject it is pointing at.
 */
import type { PublicView, SeatIndex } from '@engine/types';
import type { Step } from './course';
import { tilesInRivers } from './table';

type CoachSlot = 'top' | 'bottom' | 'rail';
type CoachSize = 'sm' | 'md' | 'lg';

interface CoachPlacement {
  slot: CoachSlot;
  size: CoachSize;
  /** Share of the felt the card is allowed to take, 0..1. */
  band: number;
}

/** Fraction of the felt each size may occupy when the card floats over it. */
const BAND: Record<CoachSize, number> = { sm: 0.32, md: 0.46, lg: 0.58 };

/**
 * Which end of the board the step is talking about.
 *
 * 'bottom' is your own hand and your own pond; 'top' is the other three seats'
 * ponds and their backs; 'centre' is the dora tray and wall count, which sits
 * in the middle and is dodged by neither end.
 */
type CoachSubject = 'bottom' | 'top' | 'both' | 'centre' | 'none';

export function subjectOf(step: Step, view: PublicView | null): CoachSubject {
  if (step.focusCentre) return 'centre';
  let bottom = Boolean(step.focus);
  let top = false;
  if (step.focusPond && view) {
    const lit = new Set(tilesInRivers(view, step.focusPond));
    if (view.seats[0].river.some((d) => lit.has(d.tile))) bottom = true;
    if (([1, 2, 3] as SeatIndex[]).some((s) => view.seats[s].river.some((d) => lit.has(d.tile)))) {
      top = true;
    }
  }
  // A tile drill lights up your own hand even without an explicit focus.
  if (step.kind === 'drill' && (step.options ?? []).some((o) => o.tile)) bottom = true;
  if (bottom && top) return 'both';
  if (bottom) return 'bottom';
  if (top) return 'top';
  return 'none';
}

/** How much card there is to show. */
export function sizeOf(step: Step): CoachSize {
  const words = (step.text ?? []).join(' ').split(/\s+/).filter(Boolean).length
    + (step.table ?? '').split(/\s+/).filter(Boolean).length
    + (step.prompt ?? '').split(/\s+/).filter(Boolean).length;
  const extras = (step.figures?.length ?? 0) * 12 + (step.note ? 26 : 0);
  // Tile options are compact (one tile + a label); word options in judgement
  // drills can wrap to several lines each and the post-answer explanations
  // add several lines more, so they weigh by their actual text.
  const options = (step.options ?? []).reduce((w, o) => {
    if (o.tile) return w + 6;
    const optWords = (o.label ?? '').split(/\s+/).filter(Boolean).length
      + o.why.split(/\s+/).filter(Boolean).length;
    return w + Math.max(10, optWords * 1.6);
  }, 0);
  const weight = words + extras + options;
  if (weight < 45) return 'sm';
  if (weight < 80) return 'md';
  return 'lg';
}

/**
 * Place the card for a step. `wide` is a landscape screen roomy enough to sit
 * the card beside the felt instead of over it.
 */
export function coachPlacement(
  step: Step,
  view: PublicView | null,
  wide = false,
): CoachPlacement {
  const size = sizeOf(step);
  if (wide) return { slot: 'rail', size, band: 0 };
  const subject = subjectOf(step, view);
  // Your own hand is always along the bottom edge, so 'top' is the safe
  // default; only a step pointing at somebody else's pond sends the expanded
  // overlay the other way. In portrait, the screen docks every collapsed card
  // at the top without resizing the board. Landscape keeps this placement.
  const slot: CoachSlot = step.cardAt ?? (subject === 'top' ? 'bottom' : 'top');
  // A step pointing at both ends of the board cannot dodge cleanly, so it gets
  // the smallest card it can and lets the reader see past it.
  const band = subject === 'both' ? Math.min(BAND[size], BAND.md) : BAND[size];
  return { slot, size, band };
}
