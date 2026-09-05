/**
 * The coach card's placement rule, and the table extensions the course leans
 * on (opponents' melds, a wall that matches the ponds, a dora that cannot
 * change an answer, seat-scoped pond spotlights).
 */
import { describe, expect, it } from 'vitest';
import { kindOf } from '@engine/index';
import { cardSize, landscapeSide, portraitEnd, subjectOf } from '../coach';
import { scriptedState, scriptedView, tilesInHand, tilesInRivers, type TableScript } from '../table';

const SCRIPT: TableScript = {
  hand: '234m 567m 88p 345s 33s',
  draw: '9m',
  rivers: { 0: '1s 2p', 1: 'W 9s 2s', 2: '1m 9m 2m 8m 3m 7m', 3: 'E N 1s' },
  melds: { 2: ['111p', '666p'] },
};

describe('subject of a step', () => {
  it('sees the hand, each pond and the centre separately', () => {
    const view = scriptedView(SCRIPT);
    const hand = subjectOf(view, tilesInHand(view, '9m'));
    expect(hand.hand).toBe(true);
    expect(hand.ponds.size).toBe(0);

    const across = subjectOf(view, tilesInRivers(view, '2:1m 9m'));
    expect(across.hand).toBe(false);
    expect([...across.ponds]).toEqual([2]);

    const meld = subjectOf(view, [view.seats[2].melds[0].tiles[0]]);
    expect([...meld.ponds]).toEqual([2]);

    const centre = subjectOf(view, [], { centre: true });
    expect(centre.centre).toBe(true);
    expect(subjectOf(view, [], { tapping: true }).hand).toBe(true);
  });
});

describe('portrait placement', () => {
  const sub = (o: { hand?: boolean; ponds?: (0 | 1 | 2 | 3)[]; centre?: boolean }) =>
    ({ hand: Boolean(o.hand), ponds: new Set(o.ponds ?? []), centre: Boolean(o.centre) });

  it('keeps the card next to the hand when the hand is the subject', () => {
    expect(portraitEnd(sub({ hand: true }))).toBe('bottom');
    expect(portraitEnd(sub({ ponds: [0] }))).toBe('bottom');
    expect(portraitEnd(sub({ hand: true, ponds: [2] }))).toBe('bottom');
  });

  it('moves it to the top when the far side or the centre is the subject', () => {
    expect(portraitEnd(sub({ ponds: [2] }))).toBe('top');
    expect(portraitEnd(sub({ centre: true }))).toBe('top');
    expect(portraitEnd(sub({ ponds: [1, 3] }))).toBe('top');
  });

  it('reads like a caption, low, when nothing is lit — unless the step insists', () => {
    expect(portraitEnd(sub({}))).toBe('bottom');
    expect(portraitEnd(sub({}), 'top')).toBe('top');
    expect(portraitEnd(sub({ hand: true }), 'top')).toBe('top');
  });
});

describe('landscape placement', () => {
  const sub = (ponds: (0 | 1 | 2 | 3)[]) => ({ hand: false, ponds: new Set(ponds), centre: false });
  it('docks on the side of the seat under discussion', () => {
    expect(landscapeSide(sub([1]))).toBe('right');
    expect(landscapeSide(sub([3]))).toBe('left');
    expect(landscapeSide(sub([1, 3]))).toBe('right');
    expect(landscapeSide(sub([]))).toBe('right');
  });
});

describe('card size', () => {
  it('grows with what it has to say and fills out once a drill is answered', () => {
    expect(cardSize(20)).toBe('sm');
    expect(cardSize(80)).toBe('md');
    expect(cardSize(130)).toBe('lg');
    expect(cardSize(20, { figures: 2 })).toBe('md');
    expect(cardSize(20, { choices: 3 })).toBe('md');
    expect(cardSize(20, { answered: true })).toBe('lg');
  });
});

describe('scripted table extensions', () => {
  it('opens an opponent hand by exactly its melds', () => {
    const state = scriptedState(SCRIPT);
    const across = state.players[2];
    expect(across.melds.map((m) => m.type)).toEqual(['pon', 'pon']);
    expect(across.hand).toHaveLength(7);
    expect(across.isClosed).toBe(false);
    expect(state.players[1].hand).toHaveLength(13);
  });

  it('refuses a called set that is neither pon nor chi', () => {
    expect(() => scriptedState({ hand: '123m 456m 789m 123p 5s', melds: { 1: ['135p'] } })).toThrow();
    expect(() => scriptedState({ hand: '123m 456m 789m 123p 5s', melds: { 1: ['1p2p3p4p'] } })).toThrow();
    expect(() => scriptedState({ hand: '123m 456m 789m 123p 5s', melds: { 1: ['234s', 'EEE'] } })).not.toThrow();
  });

  it('sizes the wall to the ponds and marks the riichi declaration tile', () => {
    const state = scriptedState({ ...SCRIPT, riichi: [1] });
    // 136 tiles: four hands (13, and 7 for the seat with two melds), two
    // melds, the drawn tile, fourteen discards and the dead wall.
    expect(state.wall.length).toBe(136 - (13 * 3 + 7) - 6 - 1 - (2 + 3 + 6 + 3) - 14);
    const right = state.players[1];
    expect(right.riichi).toBe(true);
    expect(right.river.map((d) => d.riichiDeclaration)).toEqual([false, false, true]);
    expect(state.lastDiscard).toBeNull(); // fourteen tiles: it is your throw
    const thirteen = scriptedState({ hand: '234m 567m 88p 345s 33s', rivers: { 3: 'E N 1s' } });
    expect(thirteen.lastDiscard?.from).toBe(3);
    expect(kindOf(thirteen.lastDiscard!.tile)).toBe(kindOf(thirteen.players[3].river[2].tile));
  });

  it('picks an unscripted dora that touches nothing in the hand', () => {
    const state = scriptedState(SCRIPT);
    const ind = kindOf(state.doraIndicators[0]);
    expect(ind).toBeLessThan(27);
    const dora = ind % 9 === 8 ? ind - 8 : ind + 1;
    const mine = new Set([...state.players[0].hand, state.players[0].drawnTile!].map(kindOf));
    expect(mine.has(dora)).toBe(false);
    expect(state.deadWall[0]).toBe(state.doraIndicators[0]);
  });

  it('scopes a pond spotlight to one seat when asked', () => {
    const view = scriptedView(SCRIPT);
    expect(tilesInRivers(view, '1s')).toHaveLength(1);
    expect(tilesInRivers(view, '0:1s')[0]).toBe(view.seats[0].river[0].tile);
    expect(kindOf(view.seats[0].river[0].tile)).toBe(18); // 1s thrown first, 2p second
    expect(tilesInRivers(view, '3:1s')[0]).toBe(view.seats[3].river[2].tile);
    expect(tilesInRivers(view, '1:1s')).toHaveLength(0);
  });
});
