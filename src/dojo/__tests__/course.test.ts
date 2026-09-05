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
import { getLegalActions, improvingKinds, kindOf, shanten, toPublicView, ukeire, waits } from '@engine/index';
import { scriptedState, scriptedView, stepScript, tilesInHand, tilesInRivers } from '../table';
import { landscapeSide, portraitEnd, subjectOf } from '../coach';
import { ALL_LESSONS, CHAPTERS, lessonById, nextLesson, type Step } from '../course';

const drillsOf = (steps: Step[]) => steps.filter((s) => s.kind === 'drill');
const teachOf = (steps: Step[]) => steps.filter((s) => s.kind === 'teach');
const withHand = (steps: Step[]) => steps.filter((s) => s.hand);

/** Every step's position, built the way the screen builds it. */
const positioned = () => ALL_LESSONS.flatMap(({ lesson }) =>
  withHand(lesson.steps).map((step) => ({
    lesson, step, at: lesson.steps.indexOf(step) + 1, script: stepScript(step)!,
  })));

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
        for (const notation of [s.hand, s.draw]) {
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
        const held = parseHand(s.hand ?? '').length + parseHand(s.draw ?? '').length;
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

  it('the right answer is strictly best, by the engine, with the ponds counted', () => {
    // The explanations are mine; the arithmetic is the engine's. A drill's
    // answer must be the lowest shanten among the options and, among those
    // tied on shanten, accept strictly the most live tiles — live meaning not
    // in a pond, a meld, the dora tray or your own hand. Two discards that are
    // genuinely equal are a broken drill: the fix is to put one of them out
    // of business in the ponds, not to prefer it in the prose.
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        if (q.check !== 'efficiency') continue;
        const state = scriptedState(stepScript(q)!);
        const view = toPublicView(state, 0);
        const me = state.players[0];
        const hand = [...me.hand, ...(me.drawnTile !== null ? [me.drawnTile] : [])];
        const rate = (tile: string) => {
          const k = kindOf(parseHand(tile)[0]);
          let dropped = false;
          const rest = hand.filter((t) => {
            if (!dropped && kindOf(t) === k) { dropped = true; return false; }
            return true;
          });
          const sh = shanten(rest, []);
          const live = ukeire(rest, [], view.visibleCounts).reduce((a, u) => a + u.count, 0);
          return { sh, live };
        };
        const right = (q.options ?? []).find((o) => o.correct)!;
        const best = rate(right.tile!);
        for (const o of q.options ?? []) {
          if (o.correct || !o.tile) continue;
          const other = rate(o.tile);
          const tag = `${lesson.id}: ${right.tile} (${best.sh}sh/${best.live}) vs ${o.tile} (${other.sh}sh/${other.live})`;
          expect(best.sh, tag).toBeLessThanOrEqual(other.sh);
          if (best.sh === other.sh) expect(best.live, tag).toBeGreaterThan(other.live);
        }
      }
    }
  });

  it('tenpai drills wait on tiles that are actually live', () => {
    // If a drill says "tenpai on 6s and 9s", the engine agrees and at least
    // one of each is still somewhere in the wall.
    for (const { lesson } of ALL_LESSONS) {
      for (const q of drillsOf(lesson.steps)) {
        if (q.check !== 'efficiency') continue;
        const state = scriptedState(stepScript(q)!);
        const view = toPublicView(state, 0);
        const me = state.players[0];
        const hand = [...me.hand, ...(me.drawnTile !== null ? [me.drawnTile] : [])];
        const right = (q.options ?? []).find((o) => o.correct)!;
        const k = kindOf(parseHand(right.tile!)[0]);
        let dropped = false;
        const rest = hand.filter((t) => {
          if (!dropped && kindOf(t) === k) { dropped = true; return false; }
          return true;
        });
        if (shanten(rest, []) !== 0) continue;
        const live = waits(rest, []).filter((w) => view.visibleCounts[w] < 4);
        expect(live.length, `${lesson.id}: tenpai on nothing`).toBeGreaterThan(0);
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
    for (const { lesson, at, script } of positioned()) {
      expect(() => scriptedState(script), `${lesson.id} step ${at}`).not.toThrow();
    }
  });

  it('shows a table that matches the turn it claims to be', () => {
    // "Turn 8" with empty ponds is a diagram, not a position. Every seat has
    // thrown about turn-minus-one tiles, the wall has shrunk to match, and
    // nobody has thrown a tile they could not have had.
    for (const { lesson, step, at, script } of positioned()) {
      const turn = Number(/Turn (\d+)/.exec(step.turn ?? '')?.[1] ?? NaN);
      if (Number.isNaN(turn)) continue;
      const state = scriptedState(script);
      const tag = `${lesson.id} step ${at} (${step.turn})`;
      for (const seat of [0, 1, 2, 3] as const) {
        const thrown = state.players[seat].river.length;
        // you are about to throw your Nth; the others have thrown N-1 or N
        expect(thrown, `${tag}: seat ${seat} threw ${thrown}`).toBeGreaterThanOrEqual(turn - 2);
        expect(thrown, `${tag}: seat ${seat} threw ${thrown}`).toBeLessThanOrEqual(turn + 1);
      }
      expect(state.wall.length, `${tag}: wall`).toBeLessThanOrEqual(70 - 4 * (turn - 2));
      expect(state.wall.length, `${tag}: wall`).toBeGreaterThan(0);
    }
  });

  it('gives a riichi seat a declaration tile and a stick', () => {
    for (const { lesson, at, script } of positioned()) {
      for (const seat of script.riichi ?? []) {
        const p = scriptedState(script).players[seat];
        expect(p.riichi, `${lesson.id} step ${at}`).toBe(true);
        expect(p.river.some((d) => d.riichiDeclaration), `${lesson.id} step ${at}: no declaration tile`).toBe(true);
      }
    }
  });

  it('opens an opponent hand exactly as far as its melds', () => {
    for (const { lesson, at, script } of positioned()) {
      const view = scriptedView(script);
      for (const seat of [1, 2, 3] as const) {
        const melds = script.melds?.[seat]?.length ?? 0;
        expect(view.seats[seat].melds.length, `${lesson.id} step ${at}`).toBe(melds);
        expect(view.seats[seat].concealedCount, `${lesson.id} step ${at}`).toBe(13 - 3 * melds);
        expect(view.seats[seat].isClosed).toBe(melds === 0);
      }
    }
  });

  it('spotlights only tiles the player is actually holding', () => {
    for (const { lesson, step, at, script } of positioned()) {
      if (!step.focus) continue;
      const view = scriptedView(script);
      const want = parseHand(step.focus).length;
      const got = tilesInHand(view, step.focus).length;
      expect(got, `${lesson.id} step ${at}: focus "${step.focus}"`).toBe(want);
    }
  });

  it('lets the engine offer the discards a tile drill asks for', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const step of drillsOf(lesson.steps)) {
        const tileOptions = (step.options ?? []).filter((o) => o.tile);
        if (tileOptions.length === 0 || !step.hand) continue;
        const state = scriptedState(stepScript(step)!);
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

  it('never lets an unscripted dora touch the answer', () => {
    // When a step does not name a dora, the table picks an indicator whose
    // dora is not in the hand — so a lesson's arithmetic never quietly
    // changes because of a tile it did not mention.
    for (const { lesson, step, at, script } of positioned()) {
      if (step.dora) continue;
      const state = scriptedState(script);
      const me = state.players[0];
      const held = new Set([...me.hand, ...(me.drawnTile !== null ? [me.drawnTile] : [])].map(kindOf));
      const ind = kindOf(state.doraIndicators[0]);
      expect(ind, `${lesson.id} step ${at}: honour indicator`).toBeLessThan(27);
      const dora = ind % 9 === 8 ? ind - 8 : ind + 1;
      expect(held.has(dora), `${lesson.id} step ${at}: dora in hand`).toBe(false);
      // nor a tile the hand is waiting for, before or after the recommended discard
      const all = [...me.hand, ...(me.drawnTile !== null ? [me.drawnTile] : [])];
      const right = (step.options ?? []).find((o) => o.correct)?.tile;
      const shapes: number[][] = all.length === 13 ? [all] : [];
      if (all.length === 14 && right) {
        const k = kindOf(parseHand(right)[0]);
        let dropped = false;
        shapes.push(all.filter((t) => { if (!dropped && kindOf(t) === k) { dropped = true; return false; } return true; }));
      }
      for (const shape of shapes) {
        expect(improvingKinds(shape, []), `${lesson.id} step ${at}: dora is a useful draw`).not.toContain(dora);
      }
    }
  });
});

describe('the coach points at real things', () => {
  it('every pond spotlight names a tile that is really in a pond', () => {
    for (const { lesson, step, at, script } of positioned()) {
      if (!step.focusPond) continue;
      const view = scriptedView(script);
      const want = parseHand(step.focusPond.replace(/^[0-3]:/, '')).length;
      const got = tilesInRivers(view, step.focusPond).length;
      expect(got, `${lesson.id} step ${at}: pond focus "${step.focusPond}"`).toBe(want);
    }
  });

  it('every table note about the ponds is true of the ponds', () => {
    // "Two 9p are visible" had better mean two 9p are visible.
    for (const { lesson, step, at, script } of positioned()) {
      const note = step.table ?? '';
      const m = /(one|two|three|all four|four) (\d[mps]|[1-9][mps]) are/i.exec(note);
      if (!m) continue;
      const n = { one: 1, two: 2, three: 3, four: 4, 'all four': 4 }[m[1].toLowerCase()]!;
      const view = scriptedView(script);
      const k = kindOf(parseHand(m[2])[0]);
      const inPonds = ([0, 1, 2, 3] as const).reduce<number>(
        (a, s) => a + view.seats[s].river.filter((d) => kindOf(d.tile) === k).length, 0);
      expect(inPonds, `${lesson.id} step ${at}: "${m[0]}"`).toBe(n);
    }
  });

  it('never sits on its own subject', () => {
    // The card takes one side of the screen and the board the rest, so the
    // only way to cover the subject is to choose the wrong side. In portrait
    // the hand is at the bottom, the far pond and the centre at the top; in
    // landscape the seats to your left and right are at the sides.
    for (const { lesson, step, at, script } of positioned()) {
      const view = scriptedView(script);
      const lit = [
        ...(step.focus ? tilesInHand(view, step.focus) : []),
        ...(step.focusPond ? tilesInRivers(view, step.focusPond) : []),
      ];
      const tapping = step.kind === 'drill' && (step.options ?? []).some((o) => o.tile);
      const subject = subjectOf(view, lit, { centre: step.focusCentre, tapping });
      const tag = `${lesson.id} step ${at}`;
      const end = portraitEnd(subject, step.cardAt);
      if (subject.hand || subject.ponds.has(0)) expect(end, `${tag} covers the hand`).toBe('bottom');
      else if (subject.centre || subject.ponds.has(2)) expect(end, `${tag} covers the far side`).toBe('top');
      const side = landscapeSide(subject);
      if (subject.ponds.has(1) && !subject.ponds.has(3)) expect(side, `${tag}`).toBe('right');
      if (subject.ponds.has(3) && !subject.ponds.has(1)) expect(side, `${tag}`).toBe('left');
    }
  });
});
