import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Tile from '@ui/components/Tile';
import { tileFace, decodeTile, isRedFiveId, doraFromIndicator, sortTiles } from '@ui/tiles';

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
    expect(tileFace(27 * 4).label).toBe('East wind');
    expect(tileFace(33 * 4).label).toBe('Red dragon');
  });

  it('recognizes red fives by the fixed copy convention', () => {
    expect(isRedFiveId(16)).toBe(true); // m5 copy 0
    expect(isRedFiveId(17)).toBe(false);
  });

  it('maps dora indicator to next tile (with wrap)', () => {
    expect(doraFromIndicator(0)).toBe(1); // 1m -> 2m
    expect(doraFromIndicator(8 * 4)).toBe(0); // 9m -> 1m
    expect(doraFromIndicator(30 * 4)).toBe(27); // North -> East
    expect(doraFromIndicator(33 * 4)).toBe(31); // Chun -> Haku
  });

  it('sorts tiles m < p < s < z', () => {
    const sorted = sortTiles([18 * 4, 0, 9 * 4, 27 * 4]);
    expect(sorted.map((id) => Math.floor(id / 4))).toEqual([0, 9, 18, 27]);
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
