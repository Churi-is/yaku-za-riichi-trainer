/**
 * Geometry contract for the top-down board.
 *
 * These lock in the fixes for the mobile portrait table:
 *   - the player's discard pond sits ABOVE their hand, never underneath it
 *   - the left/right opponents' rivers stay clear of the centre block
 * (and, in general, that the board never lets a river run into the centre).
 */
import { describe, it, expect } from 'vitest';
import type { PublicView, SeatIndex, DiscardEntry } from '@engine/types';
import { layoutBoard } from '@ui/table/layout';

function dummyView(riverLen: number): PublicView {
  const river: DiscardEntry[] = Array.from({ length: riverLen }, (_, i) => ({
    tile: i % 136, tsumogiri: false, riichiDeclaration: false, calledBy: null, turnNumber: i,
  }));
  const seat = (s: SeatIndex): PublicView['seats'][SeatIndex] => ({
    seat: s, seatWind: (['east', 'south', 'west', 'north'] as const)[s],
    melds: [], river, points: 25000, riichi: false, riichiTurn: null, ippatsu: false,
    concealedCount: 13, isClosed: true, aiPersonalityId: null,
  });
  return {
    viewer: 0,
    settings: { redDora: true, kuitan: true, twoHanMinimum: false, gameLength: 'east', difficulty: 'normal' },
    roundWind: 'east', roundNumber: 1, honba: 0, riichiSticks: 0, dealer: 0, turn: 0,
    phase: 'awaitingDiscard', hand: Array.from({ length: 13 }, (_, i) => i), drawnTile: 13,
    seats: { 0: seat(0), 1: seat(1), 2: seat(2), 3: seat(3) },
    doraIndicators: [0], tilesRemaining: 60, lastDiscard: null, visibleCounts: [],
  };
}

const VARIANTS = ['portrait', 'landscape', 'compact'] as const;
const doraHalf = 76;

describe('table geometry', () => {
  it('keeps the player pond above their hand, not underneath it (all variants)', () => {
    for (const v of VARIANTS) {
      const L = layoutBoard(dummyView(16), v);
      const handTop = L.handBox.y;
      const pondBottom = Math.max(...L.ponds[0].map((t) => t.y + L.m.tile.h));
      // the pond must sit fully above the hand (with the hand getting the bottom edge)
      expect(pondBottom, `${v} pond should sit above hand`).toBeLessThan(handTop);
      // and the hand is laid out along the bottom edge
      expect(L.hand[0].y, `${v} hand y`).toBe(L.m.H - L.m.rim - L.m.hand.h);
    }
  });

  it('keeps the left/right rivers out of the centre block, even on a 3rd row', () => {
    for (const v of ['portrait', 'compact'] as const) {
      const L = layoutBoard(dummyView(18), v);
      const c = L.m.W / 2;
      const leftRightEdge = Math.max(...L.ponds[3].map((t) => t.x + L.m.tile.h));
      const rightLeftEdge = Math.min(...L.ponds[1].map((t) => t.x));
      // a generous half-width of the centre block (dora tray ~119px, sticks row
      // bounded to 140px) — the river must never reach into it
      const half = v === 'compact' ? 70 : doraHalf;
      expect(leftRightEdge, `${v} left river clear of centre`).toBeLessThan(c - half);
      expect(rightLeftEdge, `${v} right river clear of centre`).toBeGreaterThan(c + half);
    }
  });

  it('lays out each opponent river as a non-overlapping compact grid', () => {
    // No two pond tiles of the same seat may share an exact cell.
    for (const v of VARIANTS) {
      for (const s of [0, 1, 2, 3] as SeatIndex[]) {
        const L = layoutBoard(dummyView(18), v);
        const seen = new Set<string>();
        for (const t of L.ponds[s]) {
          const key = `${Math.round(t.x)},${Math.round(t.y)}`;
          expect(seen.has(key), `${v} seat${s} duplicate cell`).toBe(false);
          seen.add(key);
        }
      }
    }
  });
});
