/**
 * Board geometry contract.
 *
 * The felt is laid out by a pure function, so "does anything overlap anything
 * else?" is a question we can answer exactly instead of squinting at a phone.
 * These are the bugs this guards against:
 *   - the player's own pond drawn underneath their hand;
 *   - a side seat's third pond row running into the dora display;
 *   - a riichi declaration tile (laid sideways) covering its neighbour.
 */
import { describe, it, expect } from 'vitest';
import type { DiscardEntry, Meld, PublicView, SeatIndex } from '@engine/types';
import { DEFAULT_SETTINGS } from '@engine/types';
import {
  BOUNDS, fitMetrics, layoutBoard, METRICS,
  type BoardMetrics, type BoardVariant, type PlacedTile, type Rect,
} from '@ui/table/layout';

const VARIANTS: BoardVariant[] = ['portrait', 'landscape', 'compact'];

/** the board stretches to the felt's shape: check the extremes of that range */
function shapes(variant: BoardVariant): { label: string; m: BoardMetrics }[] {
  const base = METRICS[variant];
  const b = BOUNDS[variant];
  const at = (v: number) => (variant === 'portrait' ? { ...base, H: v } : { ...base, W: v });
  return [
    { label: 'squat', m: at(b.min) },
    { label: 'default', m: base },
    { label: 'tall', m: at(b.max) },
  ];
}

function river(n: number, riichiAt = -1): DiscardEntry[] {
  return Array.from({ length: n }).map((_, i) => ({
    tile: ((i * 7) % 34) * 4,
    tsumogiri: i % 3 === 0,
    riichiDeclaration: i === riichiAt,
    calledBy: null,
    turnNumber: i,
  }));
}

function pon(i: number): Meld {
  return {
    type: 'pon',
    tiles: [(i + 2) * 4, (i + 2) * 4 + 1, (i + 2) * 4 + 2],
    calledFrom: 1 as SeatIndex,
    calledTile: (i + 2) * 4 + 2,
    concealed: false,
  };
}

interface Scenario {
  name: string;
  rivers: [number, number, number, number];
  riichi?: SeatIndex[];
  melds?: Partial<Record<SeatIndex, number>>;
  hand?: number;
  drawn?: boolean;
  dora?: number;
}

function makeView(sc: Scenario): PublicView {
  const seats = {} as PublicView['seats'];
  const winds = ['east', 'south', 'west', 'north'] as const;
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    const nMelds = sc.melds?.[s] ?? 0;
    seats[s] = {
      seat: s,
      seatWind: winds[s],
      melds: Array.from({ length: nMelds }).map((_, i) => pon(i + s)),
      river: river(sc.rivers[s], sc.riichi?.includes(s) ? 4 : -1),
      points: 25000,
      riichi: sc.riichi?.includes(s) ?? false,
      riichiTurn: null,
      ippatsu: false,
      concealedCount: 13 - 3 * nMelds,
      isClosed: nMelds === 0,
      aiPersonalityId: s === 0 ? null : 'x',
    };
  }
  const handN = sc.hand ?? 13 - 3 * (sc.melds?.[0] ?? 0);
  return {
    viewer: 0,
    settings: { ...DEFAULT_SETTINGS },
    roundWind: 'east',
    roundNumber: 1,
    honba: 1,
    riichiSticks: 1,
    dealer: 0,
    turn: 2,
    phase: 'awaitingDiscard',
    hand: Array.from({ length: handN }).map((_, i) => ((i * 3) % 34) * 4),
    drawnTile: sc.drawn === false ? null : 30 * 4,
    furiten: false,
    seats,
    doraIndicators: Array.from({ length: sc.dora ?? 1 }).map((_, i) => i * 5 * 4),
    tilesRemaining: 42,
    lastDiscard: { tile: 0, from: 2 },
    visibleCounts: new Array(34).fill(0),
  };
}

const SCENARIOS: Scenario[] = [
  { name: 'fresh deal', rivers: [0, 0, 0, 0], drawn: false },
  { name: 'mid hand', rivers: [6, 5, 5, 6], dora: 2 },
  { name: 'full ponds', rivers: [18, 18, 18, 18], dora: 3 },
  { name: 'everyone riichi', rivers: [12, 9, 14, 7], riichi: [0, 1, 2, 3], dora: 2 },
  { name: 'melds everywhere', rivers: [10, 11, 12, 13], melds: { 0: 2, 1: 2, 2: 2, 3: 2 }, dora: 2 },
  { name: 'player fully open', rivers: [14, 6, 8, 9], melds: { 0: 4 }, dora: 5 },
  { name: 'opponents fully open', rivers: [9, 9, 9, 9], melds: { 1: 4, 2: 4, 3: 4 } },
  { name: 'long rivers + riichi', rivers: [20, 21, 20, 20], riichi: [1, 3], dora: 4 },
];

function rectOf(t: PlacedTile, size: { w: number; h: number }): Rect {
  const side = t.rot === 90 || t.rot === 270;
  return { x: t.x, y: t.y, w: side ? size.h : size.w, h: side ? size.w : size.h };
}

/** overlapping area in px², ignoring shared edges */
function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

describe('board geometry', () => {
  for (const variant of VARIANTS) {
    for (const sc of SCENARIOS) {
      it(`${variant}: nothing overlaps anything else — ${sc.name}`, () => {
        for (const shape of shapes(variant)) {
        const L = layoutBoard(makeView(sc), variant, shape.m);
        const items: { what: string; r: Rect }[] = [];
        for (const t of [...L.backs, ...L.melds]) items.push({ what: t.key, r: rectOf(t, L.m.tile) });
        for (const s of [0, 1, 2, 3] as SeatIndex[]) {
          for (const t of L.ponds[s]) items.push({ what: t.key, r: rectOf(t, L.m.tile) });
        }
        for (const t of L.hand) items.push({ what: t.key, r: rectOf(t, L.m.hand) });
        items.push({ what: 'centre', r: L.center });

        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const area = overlap(items[i].r, items[j].r);
            expect(
              area,
              `${shape.label}: ${items[i].what} overlaps ${items[j].what} by ${area}px²`,
            ).toBe(0);
          }
        }
        }
      });

      it(`${variant}: everything stays on the felt — ${sc.name}`, () => {
        for (const shape of shapes(variant)) {
        const L = layoutBoard(makeView(sc), variant, shape.m);
        const { W, H } = shape.m;
        const all = [
          ...[...L.backs, ...L.melds].map((t) => rectOf(t, L.m.tile)),
          ...([0, 1, 2, 3] as SeatIndex[]).flatMap((s) => L.ponds[s].map((t) => rectOf(t, L.m.tile))),
          ...L.hand.map((t) => rectOf(t, L.m.hand)),
          L.center,
        ];
        for (const r of all) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(W);
          expect(r.y + r.h).toBeLessThanOrEqual(H);
        }
        }
      });
    }
  }

  it('keeps the human hand below their own pond, never under it', () => {
    for (const variant of VARIANTS) {
      for (const shape of shapes(variant)) {
        const L = layoutBoard(makeView({ name: 'x', rivers: [18, 0, 0, 0] }), variant, shape.m);
        const pond = L.pondBoxes[0];
        expect(pond.y + pond.h).toBeLessThanOrEqual(L.handBox.y);
        // and the hand sits on the bottom edge of the felt, not floating
        expect(shape.m.H - (L.handBox.y + L.handBox.h)).toBeLessThanOrEqual(shape.m.rim);
      }
    }
  });

  it('stretches the board to the shape of the felt instead of letterboxing', () => {
    const tall = fitMetrics('portrait', 390, 700);
    const squat = fitMetrics('portrait', 390, 380);
    expect(tall.H).toBeGreaterThan(squat.H);
    expect(tall.W).toBe(squat.W);
    // a landscape felt widens instead
    const wide = fitMetrics('landscape', 1200, 500);
    expect(wide.W).toBeGreaterThan(METRICS.landscape.W);
  });

  it('keeps the dora display clear of every pond', () => {
    for (const variant of VARIANTS) {
      const L = layoutBoard(makeView({ name: 'x', rivers: [18, 18, 18, 18], dora: 5 }), variant);
      for (const s of [0, 1, 2, 3] as SeatIndex[]) {
        expect(overlap(L.center, L.pondBoxes[s])).toBe(0);
      }
      // the tray must have room for five indicators inside the centre block
      expect(L.center.dora.w * 5).toBeLessThanOrEqual(L.center.w);
      expect(L.center.dora.w).toBeGreaterThanOrEqual(10);
    }
  });

  it('lays a riichi declaration tile sideways without covering its neighbour', () => {
    for (const variant of VARIANTS) {
      for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
        const L = layoutBoard(makeView({ name: 'x', rivers: [8, 8, 8, 8], riichi: [seat] }), variant);
        const turned = L.ponds[seat].filter((t, i) => i === 4);
        expect(turned).toHaveLength(1);
        // it is rotated a quarter turn from that seat's other discards
        const others = L.ponds[seat].filter((_, i) => i !== 4).map((t) => t.rot);
        expect(others.every((r) => r === others[0])).toBe(true);
        expect(Math.abs(turned[0].rot - others[0]) % 180).toBe(90);
      }
    }
  });
});
