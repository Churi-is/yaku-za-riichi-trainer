import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Meld, type PublicView, type TileId } from '@engine/types';
import { layoutBoard, type Box, type Placed } from '@ui/table/layout';

function overlap(a: Box & Placed, b: Box & Placed): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, Math.min(w, h));
}

function makeView(
  hand: TileId[],
  drawnTile: TileId | null,
  riverCount: number,
  ownMelds: Meld[] = [],
): PublicView {
  const seat = (i: number, wind: 'east' | 'south' | 'west' | 'north') => ({
    seat: i as 0 | 1 | 2 | 3,
    seatWind: wind,
    melds: i === 0 ? ownMelds : [],
    river: Array.from({ length: riverCount }, (_, idx) => ({
      tile: (idx * 5) % 34 * 4 + 1,
      tsumogiri: false,
      riichiDeclaration: false,
      calledBy: null,
      turnNumber: idx + 1,
    })),
    points: 25000,
    riichi: false,
    riichiTurn: null,
    ippatsu: false,
    concealedCount: i === 0 ? hand.length + (drawnTile !== null ? 1 : 0) : 13,
    isClosed: true,
    aiPersonalityId: null,
  });
  return {
    viewer: 0,
    settings: DEFAULT_SETTINGS,
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: 0,
    phase: 'awaitingDiscard',
    hand,
    drawnTile,
    seats: {
      0: seat(0, 'east'),
      1: seat(1, 'south'),
      2: seat(2, 'west'),
      3: seat(3, 'north'),
    },
    doraIndicators: [0, 4, 9, 13, 18],
    tilesRemaining: 60,
    lastDiscard: null,
    visibleCounts: [],
  };
}

const HAND: TileId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('table layout geometry', () => {
  it('renders the player river above the player hand, never under it', () => {
    const L = layoutBoard(makeView(HAND, 13, 20), 'portrait');
    // the pond's bottom edge must sit above the hand's top edge
    expect(L.pondBoxes[0].y + L.pondBoxes[0].h).toBeLessThanOrEqual(L.handBox.y);
    expect(overlap(L.pondBoxes[0], L.handBox)).toBe(0);
  });

  it('keeps the whole player hand and drawn tile inside the felt', () => {
    const L = layoutBoard(makeView(HAND, 13, 20), 'portrait');
    expect(L.handBox.x).toBeGreaterThanOrEqual(0);
    expect(L.handBox.x + L.handBox.w).toBeLessThanOrEqual(L.m.W);
    expect(L.handBox.y + L.handBox.h).toBeLessThanOrEqual(L.m.H);
  });

  it('leaves a clear centre lane for the dora tray between the side rivers', () => {
    const L = layoutBoard(makeView(HAND, 13, 20), 'portrait');
    const { W } = L.m;
    const leftInner = L.pondBoxes[3].x + L.pondBoxes[3].w;
    const rightInner = L.pondBoxes[1].x;
    // The dora tray is roughly 104 board-px wide (five 16px tiles + gaps +
    // padding). Reserve a bit more than half of that on each side.
    expect(W / 2 - leftInner).toBeGreaterThanOrEqual(52);
    expect(rightInner - W / 2).toBeGreaterThanOrEqual(52);
  });

  it('never lets side rivers overlap the centre band vertically', () => {
    const L = layoutBoard(makeView(HAND, 13, 20), 'portrait');
    for (const s of [1, 3] as const) {
      expect(L.pondBoxes[s].x).toBeGreaterThanOrEqual(0);
      expect(L.pondBoxes[s].x + L.pondBoxes[s].w).toBeLessThanOrEqual(L.m.W);
    }
  });

  it('keeps player melds in the bottom strip, clear of rivers and the hand', () => {
    const meld: Meld = { type: 'pon', tiles: [0, 1, 2], calledFrom: 1, calledTile: 0, concealed: false };
    const meld2: Meld = { type: 'pon', tiles: [12, 13, 14], calledFrom: 2, calledTile: 12, concealed: false };
    const melds = [meld, meld2];
    const L = layoutBoard(makeView(HAND, 13, 20, melds), 'portrait');
    const boxes = L.melds
      .filter((t) => t.key.startsWith('m0-'))
      .map((t) => {
        const sideways = t.rot === 90 || t.rot === 270;
        return {
          x: t.x,
          y: t.y,
          w: sideways ? L.m.tile.h : L.m.tile.w,
          h: sideways ? L.m.tile.w : L.m.tile.h,
        };
      });
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(overlap(b, L.handBox)).toBe(0);
      for (const s of [0, 1, 2, 3] as const) {
        expect(overlap(b, L.pondBoxes[s])).toBe(0);
      }
    }
  });

  it('keeps the core geometry clean in portrait, compact and landscape', () => {
    const meld: Meld = { type: 'pon', tiles: [0, 1, 2], calledFrom: 1, calledTile: 0, concealed: false };
    for (const variant of ['portrait', 'compact', 'landscape'] as const) {
      const L = layoutBoard(makeView(HAND, 13, 20, [meld]), variant);
      // Player river above hand in every variant
      expect(L.pondBoxes[0].y + L.pondBoxes[0].h).toBeLessThanOrEqual(L.handBox.y);
      expect(overlap(L.pondBoxes[0], L.handBox)).toBe(0);
      // Clear central lane for the compact dora tray
      const lane = L.pondBoxes[1].x - (L.pondBoxes[3].x + L.pondBoxes[3].w);
      expect(lane).toBeGreaterThanOrEqual(104);
      // Player melds never collide with a river
      const boxes = L.melds
        .filter((t) => t.key.startsWith('m0-'))
        .map((t) => ({
          x: t.x,
          y: t.y,
          w: t.rot === 90 || t.rot === 270 ? L.m.tile.h : L.m.tile.w,
          h: t.rot === 90 || t.rot === 270 ? L.m.tile.w : L.m.tile.h,
        }));
      for (const b of boxes) {
        expect(overlap(b, L.handBox)).toBe(0);
        for (const s of [0, 1, 2, 3] as const) {
          expect(overlap(b, L.pondBoxes[s])).toBe(0);
        }
      }
    }
  });
});
