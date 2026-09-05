/**
 * Course integrity. The lessons are data, and data rots quietly: a typo in a
 * tile string renders an empty row, a drill with two right answers teaches the
 * wrong thing, and nobody notices until a player does.
 */
import { describe, expect, it } from 'vitest';
import { parseHand } from '@ai/handEval';
import { kindOf, shanten } from '@engine/index';
import { ALL_LESSONS, CHAPTERS, lessonById, nextLesson } from '../course';

describe('course structure', () => {
  it('has unique chapter and lesson ids', () => {
    const chapters = CHAPTERS.map((c) => c.id);
    expect(new Set(chapters).size).toBe(chapters.length);
    const lessons = ALL_LESSONS.map((x) => x.lesson.id);
    expect(new Set(lessons).size).toBe(lessons.length);
    expect(lessons.length).toBeGreaterThanOrEqual(12);
  });

  it('reads in one order, start to finish', () => {
    const ids = ALL_LESSONS.map((x) => x.lesson.id);
    for (let i = 0; i < ids.length - 1; i++) {
      expect(nextLesson(ids[i])?.id).toBe(ids[i + 1]);
    }
    expect(nextLesson(ids[ids.length - 1])).toBeNull();
    for (const id of ids) expect(lessonById(id)).not.toBeNull();
  });

  it('gives every lesson a summary and some body', () => {
    for (const { lesson } of ALL_LESSONS) {
      expect(lesson.title.length).toBeGreaterThan(3);
      expect(lesson.summary.length).toBeGreaterThan(10);
      expect(lesson.sections.length).toBeGreaterThan(2);
      for (const s of lesson.sections) {
        if (s.kind === 'p' || s.kind === 'callout') expect((s.text ?? '').length).toBeGreaterThan(20);
        if (s.kind === 'list') expect((s.items ?? []).length).toBeGreaterThan(1);
      }
    }
  });
});

describe('course tiles', () => {
  it('every tile diagram parses to real tiles', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const s of lesson.sections) {
        if (s.kind !== 'tiles') continue;
        const ids = parseHand(s.tiles ?? '');
        expect(ids.length).toBeGreaterThan(0);
        // A diagram is a hand fragment, never more than a full hand.
        expect(ids.length).toBeLessThanOrEqual(14);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});

describe('drills', () => {
  it('each has exactly one right answer, and every option is explained', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const q of lesson.quizzes ?? []) {
        const right = q.options.filter((o) => o.correct);
        expect(right).toHaveLength(1);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        for (const o of q.options) {
          // Explaining only the right answer teaches nothing about the trap.
          expect(o.why.length).toBeGreaterThan(25);
        }
      }
    }
  });

  it('offers only discards the player is actually holding', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const q of lesson.quizzes ?? []) {
        const hand = parseHand(q.hand).map(kindOf);
        expect(hand.length).toBeGreaterThanOrEqual(13);
        for (const o of q.options) {
          const [kind] = parseHand(o.tile).map(kindOf);
          expect(kind).toBeDefined();
          expect(hand).toContain(kind);
        }
        const kinds = q.options.map((o) => parseHand(o.tile).map(kindOf)[0]);
        expect(new Set(kinds).size).toBe(kinds.length);
      }
    }
  });
});

describe('drill answers are actually correct', () => {
  it('the right answer is never worse than the alternatives, by the engine', () => {
    // The explanations are mine; the shanten arithmetic is the engine's. If a
    // drill claims a discard is best and the engine disagrees, the lesson is
    // teaching a mistake.
    for (const { lesson } of ALL_LESSONS) {
      for (const q of lesson.quizzes ?? []) {
        const hand = parseHand(q.hand);
        const after = (tile: string) => {
          const k = kindOf(parseHand(tile)[0]);
          let dropped = false;
          const rest = hand.filter((t) => {
            if (!dropped && kindOf(t) === k) { dropped = true; return false; }
            return true;
          });
          return shanten(rest, []);
        };
        const right = q.options.find((o) => o.correct)!;
        const rightShanten = after(right.tile);
        for (const o of q.options) {
          if (o.correct) continue;
          expect(
            rightShanten,
            `${lesson.id}: discarding ${right.tile} should not be worse than ${o.tile}`,
          ).toBeLessThanOrEqual(after(o.tile));
        }
      }
    }
  });
});
