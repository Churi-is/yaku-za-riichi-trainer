import { describe, expect, it } from 'vitest';
import {
  countsFromIds, idsFromCounts, isRed, kindOf, parseHand, rankOfKind, suitOfKind,
} from '../index';

describe('shared tile encoding', () => {
  it('decodes every physical copy with the same suit and rank', () => {
    for (let kind = 0; kind < 34; kind++) {
      const suit = kind < 9 ? 'm' : kind < 18 ? 'p' : kind < 27 ? 's' : 'z';
      const rank = kind < 27 ? kind % 9 + 1 : kind - 26;
      expect(suitOfKind(kind)).toBe(suit);
      expect(rankOfKind(kind)).toBe(rank);
      for (let copy = 0; copy < 4; copy++) {
        const id = kind * 4 + copy;
        expect(kindOf(id)).toBe(kind);
        expect(isRed(id)).toBe(copy === 0 && [4, 13, 22].includes(kind));
      }
    }
  });

  it('expands kind counts into distinct representative copies without mutating input', () => {
    const counts = Object.freeze(Array.from({ length: 34 }, (_, kind) => kind % 5));
    const ids = idsFromCounts(counts);
    expect(countsFromIds(ids)).toEqual(counts);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id >= 0 && id < 136)).toBe(true);
    expect(ids.slice(0, 3)).toEqual([4, 8, 9]);
  });

  it('parses red and ordinary fives without duplicating physical copies', () => {
    expect(parseHand('0555m 0555p 0555s')).toEqual([
      16, 17, 18, 19, 52, 53, 54, 55, 88, 89, 90, 91,
    ]);
  });
});
