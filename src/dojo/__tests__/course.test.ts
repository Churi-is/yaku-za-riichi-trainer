/**
 * Course integrity. The lessons are data, and data rots quietly: a typo in a
 * tile string renders an empty row, a drill with two right answers teaches the
 * wrong thing, and nobody notices until a player does.
 *
 * The last test here is the one that matters — it replays every efficiency
 * drill through the ENGINE and refuses to let a lesson claim a discard is best
 * when the engine says otherwise.
 */
import { describe, expect, it } from 'vitest';
import { parseHand } from '@ai/handEval';
import { getLegalActions, isAgari, isTenpai, kindOf, shanten } from '@engine/index';
import { scriptedState, scriptedView, tilesInHand, tilesInRivers } from '../table';
import { ALL_LESSONS, CHAPTERS, lessonById, nextLesson, type Step } from '../course';
import { subjectOf } from '../coach';

const drillsOf = (steps: Step[]) => steps.filter((s) => s.kind === 'drill');
const teachOf = (steps: Step[]) => steps.filter((s) => s.kind === 'teach');

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

  it('is a guided example then three drills, not a page of prose', () => {
    for (const { lesson } of ALL_LESSONS) {
      if (lesson.id === 'source') continue; // the credits page has nothing to drill
      const teach = teachOf(lesson.steps);
      const drills = drillsOf(lesson.steps);
      expect(teach.length, `${lesson.id} guided steps`).toBeGreaterThanOrEqual(2);
      expect(drills.length, `${lesson.id} drills`).toBe(3);
      // Teaching comes first, drills after: no drill before the explanation.
      const firstDrill = lesson.steps.findIndex((s) => s.kind === 'drill');
      expect(lesson.steps.slice(firstDrill).every((s) => s.kind === 'drill')).toBe(true);
    }
  });

  it('keeps each step to one screen of reading', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const s of lesson.steps) {
        const words = (s.text ?? []).join(' ').split(/\s+/).filter(Boolean).length;
        expect(words, `${lesson.id} step too long`).toBeLessThan(140);
        for (const t of s.text ?? []) expect(t.length).toBeGreaterThan(20);
      }
      expect(lesson.summary.length).toBeGreaterThan(10);
    }
  });
});

describe('course tiles', () => {
  it('every hand, draw and diagram parses to real tiles', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const s of lesson.steps) {
        for (const notation of [s.hand, s.draw, s.meld]) {
          if (!notation) continue;
          const ids = parseHand(notation);
          expect(ids.length, `${lesson.id}: "${notation}"`).toBeGreaterThan(0);
          expect(new Set(ids).size).toBe(ids.length);
        }
        for (const f of s.figures ?? []) {
          const ids = parseHand(f.tiles);
          expect(ids.length, `${lesson.id}: figure "${f.tiles}"`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never shows more than a legal hand at once', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const s of lesson.steps) {
        const held = parseHand(s.hand ?? '').length
          + parseHand(s.draw ?? '').length
          + parseHand(s.meld ?? '').length;
        expect(held, `${lesson.id} holds ${held} tiles`).toBeLessThanOrEqual(14);
      }
    }
  });
});

describe('drills', () => {
  it('each has exactly one right answer, and every option is explained', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        expect(q.prompt, `${lesson.id} drill prompt`).toBeTruthy();
        const options = q.options ?? [];
        expect(options.length).toBeGreaterThanOrEqual(3);
        expect(options.filter((o) => o.correct)).toHaveLength(1);
        for (const o of options) {
          // Explaining only the right answer teaches nothing about the trap.
          expect(o.why.length, `${lesson.id}: thin explanation`).toBeGreaterThan(25);
          expect(Boolean(o.tile) !== Boolean(o.label)).toBe(true);
        }
      }
    }
  });

  it('offers only discards the player is actually holding', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        const tileOptions = (q.options ?? []).filter((o) => o.tile);
        if (tileOptions.length === 0) continue;
        const hand = parseHand(`${q.hand ?? ''} ${q.draw ?? ''}`).map(kindOf);
        expect(hand.length, `${lesson.id}: drill hand`).toBe(14);
        for (const o of tileOptions) {
          expect(hand, `${lesson.id}: ${o.tile} not in hand`).toContain(kindOf(parseHand(o.tile!)[0]));
        }
        const kinds = tileOptions.map((o) => kindOf(parseHand(o.tile!)[0]));
        expect(new Set(kinds).size).toBe(kinds.length);
      }
    }
  });

  it('the right answer is never worse than the alternatives, by the engine', () => {
    // The explanations are mine; the shanten arithmetic is the engine's. If a
    // drill claims a discard is best and the engine disagrees, the lesson is
    // teaching a mistake.
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        if (q.check !== 'efficiency') continue;
        const hand = parseHand(`${q.hand ?? ''} ${q.draw ?? ''}`);
        const after = (tile: string) => {
          const k = kindOf(parseHand(tile)[0]);
          let dropped = false;
          return shanten(hand.filter((t) => {
            if (!dropped && kindOf(t) === k) { dropped = true; return false; }
            return true;
          }), []);
        };
        const right = (q.options ?? []).find((o) => o.correct)!;
        const best = after(right.tile!);
        for (const o of q.options ?? []) {
          if (o.correct || !o.tile) continue;
          expect(
            best,
            `${lesson.id}: discarding ${right.tile} should not be worse than ${o.tile}`,
          ).toBeLessThanOrEqual(after(o.tile));
        }
      }
    }
  });
});

describe('positions say what the lesson says they say', () => {
  it('never shows a fourteen-tile hand that is already a winning hand', () => {
    // A drill that asks "which discard keeps you tenpai" on a hand that has
    // already won is nonsense, and it happened twice before this test existed.
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.hand) continue;
        const held = parseHand(`${step.hand} ${step.draw ?? ''}`);
        if (held.length !== 14) continue;
        expect(isAgari(held, []), `${lesson.id} step ${i + 1} is already a complete hand`)
          .toBe(false);
      }
    }
  });

  it('a step that calls itself tenpai really is tenpai', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.hand) continue;
        const prose = [step.table ?? '', ...(step.text ?? []), step.prompt ?? ''].join(' ');
        // "two away from tenpai", "one from tenpai" describe a hand that is
        // deliberately NOT tenpai, so they are not claims to check.
        if (!/\btenpai\b/i.test(prose)) continue;
        if (/(from|short of|away from|towards) tenpai/i.test(prose)) continue;
        // A melding drill reaches tenpai through a CALL, which is a tile the
        // player does not hold yet, so the concealed hand cannot show it.
        if (/\b(chi|pon|kan|call|called|calling|meld)\b/i.test(prose)) continue;
        const held = parseHand(`${step.hand} ${step.draw ?? ''}`);
        // Either you are tenpai now (13 tiles) or a discard gets you there.
        const reachable = held.length === 13
          ? isTenpai(held, [])
          : held.some((_, at) => isTenpai(held.filter((__, j) => j !== at), []));
        expect(reachable, `${lesson.id} step ${i + 1} talks about tenpai it cannot reach`)
          .toBe(true);
      }
    }
  });
});

describe('every position is a real engine state', () => {
  it('builds through the engine, or the lesson does not ship', () => {
    // This is the check that makes hand-written positions safe. A script that
    // asks for a fifth copy of a tile, a sixteen-tile hand or a pond holding a
    // tile the player is also holding throws here rather than rendering an
    // empty board to a reader.
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.hand) continue;
        expect(
          () => scriptedState({
            hand: step.hand!,
            draw: step.draw,
            dora: step.dora,
            rivers: step.rivers,
            riichi: step.riichi,
            wall: step.wall,
            seatWind: step.seatWind,
          }),
          `${lesson.id} step ${i + 1}`,
        ).not.toThrow();
      }
    }
  });

  it('spotlights only tiles the player is actually holding', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.focus || !step.hand) continue;
        const view = scriptedView({
          hand: step.hand, draw: step.draw, dora: step.dora,
          rivers: step.rivers, riichi: step.riichi, wall: step.wall,
          seatWind: step.seatWind,
        });
        const want = parseHand(step.focus).length;
        const got = tilesInHand(view, step.focus).length;
        expect(got, `${lesson.id} step ${i + 1}: focus "${step.focus}"`).toBe(want);
      }
    }
  });

  it('lets the engine offer the discards a tile drill asks for', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const step of drillsOf(lesson.steps)) {
        const tileOptions = (step.options ?? []).filter((o) => o.tile);
        if (tileOptions.length === 0 || !step.hand) continue;
        const state = scriptedState({
          hand: step.hand, draw: step.draw, dora: step.dora,
          rivers: step.rivers, riichi: step.riichi, wall: step.wall,
          seatWind: step.seatWind,
        });
        const legal = getLegalActions(state, 0)
          .filter((l) => l.action.type === 'discard')
          .map((l) => kindOf((l.action as { tile: number }).tile));
        for (const o of tileOptions) {
          expect(legal, `${lesson.id}: ${o.tile} is not a legal discard`)
            .toContain(kindOf(parseHand(o.tile!)[0]));
        }
      }
    }
  });
});

describe('the coach points at real things', () => {
  it('every pond spotlight names a tile that is really in a pond', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.focusPond || !step.hand) continue;
        const view = scriptedView({
          hand: step.hand, draw: step.draw, dora: step.dora,
          rivers: step.rivers, riichi: step.riichi, wall: step.wall,
          seatWind: step.seatWind,
        });
        const want = parseHand(step.focusPond).length;
        const got = tilesInRivers(view, step.focusPond).length;
        expect(got, `${lesson.id} step ${i + 1}: pond focus "${step.focusPond}"`).toBe(want);
      }
    }
  });

  it('keeps the card off the pond when the pond is the subject', () => {
    // Placement lives in @dojo/coach and is checked there in full. What this
    // test guards is the content side: if a step sets `cardAt` by hand, it had
    // better not be sending the card on top of its own subject.
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.cardAt || !step.hand) continue;
        const view = scriptedView({
          hand: step.hand, draw: step.draw, dora: step.dora,
          rivers: step.rivers, riichi: step.riichi, wall: step.wall,
          seatWind: step.seatWind,
        });
        const subject = subjectOf(step, view);
        if (subject === 'bottom') {
          expect(step.cardAt, `${lesson.id} step ${i + 1} hides your own hand`).toBe('top');
        }
        if (subject === 'top') {
          expect(step.cardAt, `${lesson.id} step ${i + 1} hides its own pond`).toBe('bottom');
        }
      }
    }
  });
});
