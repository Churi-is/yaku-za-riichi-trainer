/**
 * Dojo course model and syllabus composition.
 *
 * The dojo is two tracks, taught in order:
 *
 *   BASICS  (`src/dojo/basics.ts`) — the on-ramp for a player who has never
 *           touched mahjong: the tiles, the turn, sets and the pair, tenpai
 *           and waits, the everyday yaku, riichi, calling, dora, and the one
 *           safety rule. Gentle, recognition-focused, no judgement expected.
 *
 *   STRATEGY (`src/dojo/strategy.ts`) — the playing course, structured on
 *           Riichi Book I by Daina Chiba (CC BY-NC 3.0, http://riichi.dynaman.net/).
 *           It assumes the basics vocabulary and turns it into decisions: the
 *           five-block method, yaku, riichi timing, defence, and calling.
 *
 * SHAPE OF A LESSON. Not a page — a scripted sequence of turns. Every lesson
 * is a guided hand played a turn at a time, where each idea arrives at the
 * moment the hand needs it, followed by three drills on positions of your
 * own. You read one screen, make one decision, and move on.
 *
 * Tile notation is the engine's own: "123m" = 1-2-3 man, "0p" = red five
 * pin, and E S W N P F C are the honours (P/F/C = white, green, red dragon).
 */

export interface DrillOption {
  /** A tile to discard. Mutually exclusive with `label`. */
  tile?: string;
  /** A plain action, for judgement drills ("Declare riichi", "Fold"). */
  label?: string;
  correct?: boolean;
  /** Shown after answering, for every option — the wrong ones are the lesson. */
  why: string;
}

export interface Step {
  /** 'teach' walks the hand forward; 'drill' stops and asks. */
  kind: 'teach' | 'drill';
  /** Tiles to spotlight in your hand — everything else dims. */
  focus?: string;
  /** Tiles to spotlight in the ponds, for pointing at what has been discarded. */
  focusPond?: string;
  /** Spotlight the centre block (dora, wall, round) instead of tiles. */
  focusCentre?: boolean;
  /** Force the coach card to a side; otherwise it dodges the spotlight. */
  cardAt?: 'top' | 'bottom';
  /** Face-up dora indicator for this position. */
  dora?: string;
  /** Discards already in the ponds, per seat. */
  rivers?: Partial<Record<0 | 1 | 2 | 3, string>>;
  /** Seats that have declared riichi. */
  riichi?: (0 | 1 | 2 | 3)[];
  /** Tiles left in the live wall. */
  wall?: number;
  /** A call decision: this tile was just discarded by the seat to your left. */
  calling?: string;
  /** The viewer's seat wind. */
  seatWind?: 'east' | 'south' | 'west' | 'north';
  /** Turn label, e.g. "Turn 4". Sets the scene for a scripted position. */
  turn?: string;
  /** The concealed hand for this step. */
  hand?: string;
  /** The tile just drawn, shown apart from the hand. */
  draw?: string;
  /** Table context: what the ponds and the other seats are telling you. */
  table?: string;
  /** Body paragraphs. */
  text?: string[];
  /** A highlighted aside. */
  note?: { title: string; text: string };
  /** Extra diagram rows, each with its own caption. */
  figures?: { tiles: string; caption: string }[];

  // drill only
  prompt?: string;
  options?: DrillOption[];
  /**
   * 'efficiency' drills are checked against the engine's shanten in the test
   * suite. Judgement drills (push/fold, riichi timing, melding) are not, since
   * the right answer there is deliberately not the fastest one.
   */
  check?: 'efficiency';
}

interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: Step[];
}

interface Chapter {
  id: string;
  book: number;
  title: string;
  kanji: string;
  blurb: string;
  lessons: Lesson[];
}

export type TrackId = 'basics' | 'strategy' | 'yaku';

export interface Track {
  id: TrackId;
  title: string;
  kanji: string;
  blurb: string;
  chapters: Chapter[];
}

import { BASICS_CHAPTERS } from './basics';
import { STRATEGY_CHAPTERS } from './strategy';
import { YAKU_CODEX_CHAPTERS } from './yakucodex';

/**
 * The two tracks in teaching order. Basics is the on-ramp for a complete
 * beginner; strategy is the judgement course that assumes everything in it.
 */
export const TRACKS: Track[] = [
  {
    id: 'basics',
    title: 'Basics',
    kanji: '初心',
    blurb: 'Never played mahjong? Start here: the tiles, a turn of play, the shapes you build, and the words the strategy track uses without explanation.',
    chapters: BASICS_CHAPTERS,
  },
  {
    id: 'strategy',
    title: 'Strategy',
    kanji: '戦略',
    blurb: 'The original course, structured on Riichi Book I: tile efficiency, yaku, riichi timing, defence, and calling — taught on playable positions.',
    chapters: STRATEGY_CHAPTERS,
  },
  {
    id: 'yaku',
    title: 'Yaku Codex',
    kanji: '役一覧',
    blurb: 'A reference through every yaku in the game — the one-han luck yaku, the everyday shapes, the two-han hands, the flushes, and the yakuman limit hands — each with recognition drills.',
    chapters: YAKU_CODEX_CHAPTERS,
  },
];

/** Every chapter in teaching order, basics track first. */
export const CHAPTERS: Chapter[] = TRACKS.flatMap((t) => t.chapters);

/** Lesson counts per track — handy for the contents page and its tests. */
export const BASICS_COUNT = TRACKS[0].chapters.reduce((n, c) => n + c.lessons.length, 0);
export const STRATEGY_COUNT = TRACKS[1].chapters.reduce((n, c) => n + c.lessons.length, 0);

/** The track a chapter belongs to. */
export function trackOfChapter(id: string): Track {
  return TRACKS.find((t) => t.chapters.some((c) => c.id === id)) ?? TRACKS[0];
}

/** The track a lesson belongs to, looked up by its chapter. */
export function trackOfLesson(lessonId: string): Track {
  const found = ALL_LESSONS.find((x) => x.lesson.id === lessonId);
  return found ? trackOfChapter(found.chapter.id) : TRACKS[0];
}

export const ALL_LESSONS: { chapter: Chapter; lesson: Lesson; track: Track }[] =
  TRACKS.flatMap((track) =>
    track.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({ chapter, lesson, track }))));

export function lessonById(id: string): { chapter: Chapter; lesson: Lesson; track: Track } | null {
  return ALL_LESSONS.find((x) => x.lesson.id === id) ?? null;
}

/** How many steps and drills a lesson holds, for the dojo contents page. */
export function lessonShape(lesson: Lesson): { steps: number; drills: number } {
  return {
    steps: lesson.steps.length,
    drills: lesson.steps.filter((s) => s.kind === 'drill').length,
  };
}

/** The lesson after `id` in reading order, or null at the end of the course. */
export function nextLesson(id: string): Lesson | null {
  const i = ALL_LESSONS.findIndex((x) => x.lesson.id === id);
  return i >= 0 && i + 1 < ALL_LESSONS.length ? ALL_LESSONS[i + 1].lesson : null;
}
