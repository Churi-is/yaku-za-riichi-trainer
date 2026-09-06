import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Tile from '@ui/components/Tile';
import { isRed, kindOf, doraKindForIndicator } from '@engine/index';
import { tileLabel, decodeTile, sortTiles } from '@ui/tiles';

afterEach(cleanup);

describe('tile decoding', () => {
  it('decodes suited tiles by kind', () => {
    expect(decodeTile(0)).toMatchObject({ suit: 'm', rank: 1 });
    expect(decodeTile(8 * 4)).toMatchObject({ suit: 'm', rank: 9 });
    expect(decodeTile(9 * 4)).toMatchObject({ suit: 'p', rank: 1 });
    expect(decodeTile(18 * 4)).toMatchObject({ suit: 's', rank: 1 });
    expect(decodeTile(27 * 4)).toMatchObject({ suit: 'z', rank: 1 });
  });

  it('labels honors and dragons in English', () => {
    expect(tileLabel(27 * 4)).toBe('East wind');
    expect(tileLabel(33 * 4)).toBe('Red dragon');
  });

  it('recognizes red fives by the fixed copy convention', () => {
    expect(isRed(16)).toBe(true); // m5 copy 0
    expect(isRed(17)).toBe(false);
  });

  it('maps dora indicator to next tile (with wrap)', () => {
    expect(doraKindForIndicator(kindOf(0))).toBe(1); // 1m -> 2m
    expect(doraKindForIndicator(kindOf(8 * 4))).toBe(0); // 9m -> 1m
    expect(doraKindForIndicator(kindOf(30 * 4))).toBe(27); // North -> East
    expect(doraKindForIndicator(kindOf(33 * 4))).toBe(31); // Chun -> Haku
  });

  it('sorts tiles m < p < s < z', () => {
    const sorted = sortTiles([18 * 4, 0, 9 * 4, 27 * 4]);
    expect(sorted.map((id) => Math.floor(id / 4))).toEqual([0, 9, 18, 27]);
  });

  it('preserves English labels for all 136 physical tiles', () => {
    const names = [
      '1 man', '2 man', '3 man', '4 man', '5 man', '6 man', '7 man', '8 man', '9 man',
      '1 pin', '2 pin', '3 pin', '4 pin', '5 pin', '6 pin', '7 pin', '8 pin', '9 pin',
      '1 sou', '2 sou', '3 sou', '4 sou', '5 sou', '6 sou', '7 sou', '8 sou', '9 sou',
      'East wind', 'South wind', 'West wind', 'North wind',
      'White dragon', 'Green dragon', 'Red dragon',
    ];
    for (let id = 0; id < 136; id++) expect(tileLabel(id)).toBe(names[Math.floor(id / 4)]);
  });

  it('moves red fives first without reordering ordinary copies or mutating the hand', () => {
    const hand = Object.freeze([19, 17, 16, 18, 53, 52, 54, 55, 3, 1, 0, 2]);
    expect(sortTiles(hand)).toEqual([3, 1, 0, 2, 16, 19, 17, 18, 52, 53, 54, 55]);
  });
});

describe('Tile component', () => {
  it('renders a face with an accessible label', () => {
    render(<Tile id={0} />);
    expect(screen.getByLabelText('1 man')).toBeTruthy();
  });

  it('renders a red five with the red label', () => {
    render(<Tile id={16} />);
    expect(screen.getByLabelText('red 5 man')).toBeTruthy();
  });

  it('renders a face-down tile that never exposes its identity', () => {
    const { container } = render(<Tile id={0} faceDown />);
    const el = container.querySelector('.tile-back');
    expect(el).toBeTruthy();
    expect(container.textContent).toBe('');
  });

  it('is a button when clickable', () => {
    render(<Tile id={0} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: '1 man' })).toBeTruthy();
  });
});
