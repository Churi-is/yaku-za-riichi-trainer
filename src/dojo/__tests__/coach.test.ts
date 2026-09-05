/**
 * The coach card must not stand on its own subject.
 *
 * The old card was a fixed slab pinned across the middle of the felt: it
 * covered the right-hand seat in every lesson and was the same size whether it
 * had two sentences or four drill options to show. Placement is data now, so
 * it can be checked — for every step in the course, the card goes to the
 * opposite end of the board from whatever the step is pointing at, and the
 * band it claims scales with how much it has to say.
 */
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, type Step } from '../course';
import { coachPlacement, sizeOf, subjectOf } from '../coach';
import { scriptedView } from '../table';

const viewFor = (step: Step) => (step.hand
  ? scriptedView({
    hand: step.hand, draw: step.draw, dora: step.dora, rivers: step.rivers,
    riichi: step.riichi, wall: step.wall, seatWind: step.seatWind,
  })
  : null);

describe('coach placement', () => {
  it('never sits on the end of the board it is pointing at', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        const view = viewFor(step);
        const subject = subjectOf(step, view);
        const { slot } = coachPlacement(step, view);
        if (subject === 'bottom') {
          expect(slot, `${lesson.id} step ${i + 1} covers your own hand`).toBe('top');
        }
        if (subject === 'top') {
          expect(slot, `${lesson.id} step ${i + 1} covers the pond it names`).toBe('bottom');
        }
        if (subject === 'both') {
          // Nothing can dodge both ends, so the card keeps itself small.
          expect(
            coachPlacement(step, view).band,
            `${lesson.id} step ${i + 1} points at both ends and hogs the felt`,
          ).toBeLessThanOrEqual(0.46);
        }
      }
    }
  });

  it('leaves the felt free on a wide screen instead of floating over it', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const step of lesson.steps) {
        const p = coachPlacement(step, viewFor(step), true);
        expect(p.slot).toBe('rail');
        expect(p.band).toBe(0); // a rail steals no felt at all
      }
    }
  });

  it('sizes the card to what it has to say, not to a constant', () => {
    // A one-line teach step and a four-option drill must not get the same box.
    const small: Step = { kind: 'teach', text: ['A short remark about the hand you hold.'] };
    const big: Step = {
      kind: 'drill',
      prompt: 'A long prompt that goes on for a while about which tile to throw and why.',
      table: 'Riichi from across, and their pond is full of information you should read first.',
      note: { title: 'x', text: 'y' },
      options: [
        { tile: '1m', correct: true, why: 'a' }, { tile: '2m', why: 'b' },
        { tile: '3m', why: 'c' }, { tile: '4m', why: 'd' },
      ],
    };
    expect(sizeOf(small)).toBe('sm');
    expect(sizeOf(big)).toBe('lg');
    expect(coachPlacement(small, null).band).toBeLessThan(coachPlacement(big, null).band);
  });

  it('gives every step a band that leaves most of the felt visible', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        const { band } = coachPlacement(step, viewFor(step));
        expect(band, `${lesson.id} step ${i + 1} band`).toBeLessThanOrEqual(0.6);
        expect(band).toBeGreaterThan(0);
      }
    }
  });
});
