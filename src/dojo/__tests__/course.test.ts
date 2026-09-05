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
import { getLegalActions, isAgari, kindOf, shanten, ukeire, waits } from '@engine/index';
import { scriptedState, scriptedView, tilesInHand, tilesInRivers } from '../table';
import { ALL_LESSONS, CHAPTERS, lessonById, nextLesson, type Step } from '../course';

const drillsOf = (steps: Step[]) => steps.filter((s) => s.kind === 'drill');
const teachOf = (steps: Step[]) => steps.filter((s) => s.kind === 'teach');

/** the script of a step, as the table builder wants it */
const scriptOf = (s: Step) => ({
  hand: s.hand!, draw: s.draw, dora: s.dora, rivers: s.rivers,
  riichi: s.riichi, wall: s.wall, seatWind: s.seatWind,
});
const turnOf = (s: Step): number => Number((s.turn ?? '').replace(/\D/g, '')) || 0;
const riverLens = (s: Step): number[] =>
  ([0, 1, 2, 3] as const).map((x) => (s.rivers?.[x] ?? '').trim().split(/\s+/).filter(Boolean).length);

/**
 * How good is the hand after discarding `tile`: shanten first, then the number
 * of live tiles that help it (waits when tenpai, ukeire otherwise), counted
 * against what the ponds and the hand already show. Two answers with the same
 * shanten and the same live count are the same answer, and a drill may not
 * mark only one of them correct.
 */
function discardScore(s: Step, tile: string): { sh: number; n: number } {
  const view = scriptedView(scriptOf(s));
  const hand = parseHand(`${s.hand} ${s.draw ?? ''}`);
  const k = kindOf(parseHand(tile)[0]);
  let dropped = false;
  const rest = hand.filter((t) => {
    if (!dropped && kindOf(t) === k) { dropped = true; return false; }
    return true;
  });
  const sh = shanten(rest, []);
  if (sh === 0) {
    const n = waits(rest, []).reduce((a, w) => a + Math.max(0, 4 - view.visibleCounts[w]), 0);
    return { sh, n };
  }
  const n = ukeire(rest, [], view.visibleCounts).reduce((a, u) => a + u.count, 0);
  return { sh, n };
}

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
    // The card floats over the felt. Opponents' ponds sit at the top of the
    // board and your own sits at the bottom, so a step pointing at a discard
    // has to send the card the other way or it covers its own subject.
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        if (!step.focusPond || !step.hand) continue;
        const view = scriptedView({
          hand: step.hand, draw: step.draw, dora: step.dora,
          rivers: step.rivers, riichi: step.riichi, wall: step.wall,
          seatWind: step.seatWind,
        });
        const lit = new Set(tilesInRivers(view, step.focusPond));
        const mine = view.seats[0].river.some((d) => lit.has(d.tile));
        const theirs = ([1, 2, 3] as const).some(
          (s) => view.seats[s].river.some((d) => lit.has(d.tile)),
        );
        const want = theirs && !mine ? 'bottom' : 'top';
        expect(step.cardAt, `${lesson.id} step ${i + 1} hides its own subject`).toBe(want);
      }
    }
  });
});

describe('the table tells the truth', () => {
  it('never asks for a discard from a completed hand', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, s] of lesson.steps.entries()) {
        if (!s.hand) continue;
        const ids = parseHand(`${s.hand} ${s.draw ?? ''}`);
        if (ids.length !== 14) continue;
        expect(isAgari(ids, []), `${lesson.id} step ${i + 1} (${s.turn}) is already a winning hand`).toBe(false);
      }
    }
  });

  it('gives every drill a fourteen-tile hand — it is your turn', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        if (!q.hand) continue;
        const n = parseHand(`${q.hand} ${q.draw ?? ''}`).length;
        // A call decision happens between draws: thirteen tiles and a tile on
        // the cloth. Everything else is your own discard, so it needs fourteen.
        if (q.calling) {
          expect(n, `${lesson.id} (${q.turn}): a call window holds thirteen`).toBe(13);
        } else {
          expect(n, `${lesson.id} (${q.turn}): a drill must be a live discard decision`).toBe(14);
        }
      }
    }
  });

  it('keeps the ponds the length the turn chip claims', () => {
    // A turn-14 board with empty rivers is a board nobody has played on. When a
    // step names a turn late enough to have a history, every seat shows it.
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, s] of lesson.steps.entries()) {
        const t = turnOf(s);
        const lens = riverLens(s);
        const shown = lens.some((n) => n > 0);
        if (!shown) {
          expect(t, `${lesson.id} step ${i + 1}: turn ${t} with empty ponds`).toBeLessThan(7);
          continue;
        }
        if (t >= 7) {
          for (const [seat, n] of lens.entries()) {
            expect(n, `${lesson.id} step ${i + 1}: seat ${seat} pond at ${s.turn}`).toBe(t - 1);
          }
        } else {
          for (const n of lens) {
            expect(n, `${lesson.id} step ${i + 1}: pond from the future`).toBeLessThanOrEqual(t - 1);
          }
          expect(Math.max(...lens) - Math.min(...lens), `${lesson.id} step ${i + 1}: lopsided ponds`)
            .toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('shows a wall count the discards on the cloth allow', () => {
    // 136 tiles, 14 in the dead wall, 53 dealt: the live wall starts at 69 and
    // every discard on the cloth is one tile gone from it.
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, s] of lesson.steps.entries()) {
        if (s.wall === undefined) continue;
        const spent = riverLens(s).reduce((a, b) => a + b, 0);
        expect(
          Math.abs(s.wall - (69 - spent)),
          `${lesson.id} step ${i + 1}: wall ${s.wall} with ${spent} discards shown`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('marks the one answer the engine cannot beat', () => {
    // Shanten alone cannot see a tie: two discards can both be tenpai, or both
    // one-shanten, and still be worlds apart in live tiles. The marked answer
    // has to win on both counts, or the drill is teaching a coin flip as a rule.
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        if (q.check !== 'efficiency' || !q.hand) continue;
        const right = (q.options ?? []).find((o) => o.correct)!;
        const best = discardScore(q, right.tile!);
        for (const o of q.options ?? []) {
          if (o.correct || !o.tile) continue;
          const alt = discardScore(q, o.tile);
          const wins = best.sh < alt.sh || (best.sh === alt.sh && best.n > alt.n);
          expect(
            wins,
            `${lesson.id}: ${right.tile} (${best.sh}/${best.n}) must beat ${o.tile} (${alt.sh}/${alt.n})`,
          ).toBe(true);
        }
      }
    }
  });
});
