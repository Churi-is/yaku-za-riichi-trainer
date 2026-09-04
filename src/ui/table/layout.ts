/**
 * Deterministic top-down table layout.
 *
 * Every object on the felt — seat plates, concealed backs, every discard in
 * every pond, every meld tile, riichi sticks — gets explicit board coordinates
 * computed here in plain arithmetic. The renderer places them absolutely
 * inside a fixed-size board that is uniformly scaled to fit, so no browser
 * layout engine (flex/grid/percentage resolution, all of which differ between
 * Safari and Chrome) is involved in positioning the table. Same input state →
 * same pixels everywhere.
 *
 * Board coordinate space per variant; (0,0) is the felt's top-left.
 */
import type { PublicView, SeatIndex, TileId } from '@engine/types';

export type BoardVariant = 'portrait' | 'landscape' | 'compact';

export interface Box { w: number; h: number }
export interface Placed { x: number; y: number }

export interface VariantMetrics {
  W: number;
  H: number;
  /** river/meld tile face size */
  tile: Box;
  rim: number;
  gap: number;
  plate: number;   // plate thickness (height for horizontal, width for vertical)
  stick: Box;
}

export const METRICS: Record<BoardVariant, VariantMetrics> = {
  portrait: { W: 380, H: 470, tile: { w: 14, h: 20 }, rim: 6, gap: 6, plate: 18, stick: { w: 44, h: 6 } },
  landscape: { W: 1000, H: 560, tile: { w: 22, h: 30 }, rim: 10, gap: 8, plate: 24, stick: { w: 64, h: 8 } },
  compact: { W: 760, H: 430, tile: { w: 17, h: 23 }, rim: 8, gap: 6, plate: 20, stick: { w: 52, h: 7 } },
};

export interface PlacedTile {
  id: TileId;
  x: number;
  y: number;
  rot: 0 | 90 | 180 | 270;
  faceDown?: boolean;
  dimmed?: boolean;
  key: string;
}

export interface PlacedPlate {
  seat: SeatIndex;
  x: number;
  y: number;
  w: number;
  h: number;
  vertical: boolean;
}

export interface PlacedStick {
  seat: SeatIndex;
  x: number;
  y: number;
  vertical: boolean;
}

export interface BoardLayout {
  m: VariantMetrics;
  plates: PlacedPlate[];
  backs: PlacedTile[];
  ponds: Record<SeatIndex, PlacedTile[]>;
  melds: PlacedTile[];
  sticks: PlacedStick[];
  /** bounding boxes of each seat's pond, for debugging/tests */
  pondBoxes: Record<SeatIndex, Box & Placed>;
}

const rot90 = (r: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 => (((r + 90) % 360) as 0 | 90 | 180 | 270);

/** footprint of a tile face box (w×h) once rotated */
function foot(m: VariantMetrics, rot: number): Box {
  return rot === 90 || rot === 270 ? { w: m.tile.h, h: m.tile.w } : { w: m.tile.w, h: m.tile.h };
}

export function layoutBoard(view: PublicView, variant: BoardVariant): BoardLayout {
  const m = METRICS[variant];
  const { W, H, tile, rim, gap, plate } = m;

  const backsRowW = 13 * tile.w + 12;
  const backsColH = 13 * tile.w + 12;
  const pondW = 6 * tile.w + 5 * 2;          // 6 columns of faces
  const pondH = 3 * tile.h + 2 * 2;          // 3 rows of faces
  const sidePondW = 3 * tile.h + 2 * 2;      // rotated: 3 columns of side cells
  const sidePondH = 6 * tile.w + 5 * 2;

  const PLATE_H = 150; // fixed plate boxes keep placement deterministic
  const PLATE_V = 130;
  const plates: PlacedPlate[] = [
    // seat 0's plate lives in the dock, not on the felt
    { seat: 2, x: (W - PLATE_H) / 2, y: rim, w: PLATE_H, h: plate, vertical: false },
    { seat: 3, x: rim, y: (H - PLATE_V) / 2, w: plate, h: PLATE_V, vertical: true },
    { seat: 1, x: W - rim - plate, y: (H - PLATE_V) / 2, w: plate, h: PLATE_V, vertical: true },
  ];

  const backs: PlacedTile[] = [];
  // across (seat 2): horizontal row under its plate
  const t2x = (W - backsRowW) / 2;
  const t2y = rim + plate + gap;
  for (let i = 0; i < Math.min(view.seats[2].concealedCount, 13); i++) {
    backs.push({ id: 0, x: t2x + i * (tile.w + 1), y: t2y, rot: 180, faceDown: true, key: `b2-${i}` });
  }
  // left (seat 3): vertical column
  const l3x = rim + plate + gap;
  const l3y = (H - backsColH) / 2;
  for (let i = 0; i < Math.min(view.seats[3].concealedCount, 13); i++) {
    backs.push({ id: 0, x: l3x, y: l3y + i * (tile.w + 1), rot: 90, faceDown: true, key: `b3-${i}` });
  }
  // right (seat 1): vertical column
  const r1x = W - rim - plate - gap - tile.h;
  const r1y = (H - backsColH) / 2;
  for (let i = 0; i < Math.min(view.seats[1].concealedCount, 13); i++) {
    backs.push({ id: 0, x: r1x, y: r1y + i * (tile.w + 1), rot: 270, faceDown: true, key: `b1-${i}` });
  }

  // ---- ponds: fixed 6x3 grids, rows start at the owner's edge and advance
  //      toward the centre in the owner's left-to-right order
  const pondBoxes = {} as BoardLayout['pondBoxes'];
  const ponds = {} as BoardLayout['ponds'];

  // own (seat 0): bottom, row 1 at the bottom edge
  const p0 = { x: (W - pondW) / 2, y: H - rim - pondH };
  pondBoxes[0] = { ...p0, w: pondW, h: pondH };
  ponds[0] = view.seats[0].river.map((d, i) => {
    const r = Math.floor(i / 6); const c = i % 6;
    return {
      id: d.tile, key: `p0-${i}`, dimmed: d.calledBy !== null,
      rot: (d.riichiDeclaration ? 90 : 0) as 0 | 90,
      x: p0.x + c * (tile.w + 2), y: p0.y + (2 - r) * (tile.h + 2),
    };
  });

  // across (seat 2): top, row 1 at their edge (top), their left→right = screen right→left
  const p2 = { x: (W - pondW) / 2, y: t2y + tile.h + gap + 4 };
  pondBoxes[2] = { ...p2, w: pondW, h: pondH };
  ponds[2] = view.seats[2].river.map((d, i) => {
    const r = Math.floor(i / 6); const c = i % 6;
    return {
      id: d.tile, key: `p2-${i}`, dimmed: d.calledBy !== null,
      rot: (180 + (d.riichiDeclaration ? 90 : 0)) % 360 as 0 | 90 | 180 | 270,
      x: p2.x + (5 - c) * (tile.w + 2), y: p2.y + r * (tile.h + 2),
    };
  });

  // left (seat 3): column 1 at their edge (left), their left→right = screen top→down
  const p3 = { x: l3x + tile.h + gap + 4, y: (H - sidePondH) / 2 };
  pondBoxes[3] = { ...p3, w: sidePondW, h: sidePondH };
  ponds[3] = view.seats[3].river.map((d, i) => {
    const r = Math.floor(i / 6); const c = i % 6;
    return {
      id: d.tile, key: `p3-${i}`, dimmed: d.calledBy !== null,
      rot: (90 + (d.riichiDeclaration ? 90 : 0)) % 360 as 0 | 90 | 180 | 270,
      x: p3.x + r * (tile.h + 2), y: p3.y + c * (tile.w + 2),
    };
  });

  // right (seat 1): column 1 at their edge (right), their left→right = screen bottom→top
  const p1 = { x: r1x - sidePondW - gap - 4, y: (H - sidePondH) / 2 };
  pondBoxes[1] = { ...p1, w: sidePondW, h: sidePondH };
  ponds[1] = view.seats[1].river.map((d, i) => {
    const r = Math.floor(i / 6); const c = i % 6;
    return {
      id: d.tile, key: `p1-${i}`, dimmed: d.calledBy !== null,
      rot: (270 + (d.riichiDeclaration ? 90 : 0)) % 360 as 0 | 90 | 180 | 270,
      x: p1.x + (2 - r) * (tile.h + 2), y: p1.y + (5 - c) * (tile.w + 2),
    };
  });

  // ---- melds: continue past the end of each seat's hand, oriented like it.
  //      If the primary slot runs off the felt, overflow to the other side of
  //      that seat's hand (still beside their hand, never overlapping ponds).
  const melds: PlacedTile[] = [];
  const placeMelds = (seat: SeatIndex) => {
    const list = view.seats[seat].melds;
    if (seat === 2) {
      let leftX = t2x - gap;           // grows leftwards
      let rightX = t2x + backsRowW + gap; // overflow grows rightwards
      for (const meld of list) {
        const widths = meld.tiles.map((t) => foot(m, calledRot(meld, t, 180)).w);
        const meldW = widths.reduce((a, b) => a + b + 1, -1);
        let x: number;
        if (leftX - meldW >= rim) { leftX -= meldW; x = leftX; leftX -= gap; }
        else { x = rightX; rightX += meldW + gap; }
        let cx = x;
        for (const t of meld.tiles) {
          const rot = calledRot(meld, t, 180);
          melds.push({ id: t, x: cx, y: t2y, rot, key: `m2-${melds.length}` });
          cx += foot(m, rot).w + 1;
        }
      }
    } else if (seat === 3) {
      let downY = l3y + backsColH + gap; // grows downwards (their right)
      let upY = l3y - gap;               // overflow grows upwards
      for (const meld of list) {
        const heights = meld.tiles.map((t) => foot(m, calledRot(meld, t, 90)).h);
        const meldH = heights.reduce((a, b) => a + b + 1, -1);
        let y: number;
        if (downY + meldH <= H - rim) { y = downY; downY += meldH + gap; }
        else { upY -= meldH; y = upY; upY -= gap; }
        let cy = y;
        for (const t of meld.tiles) {
          const rot = calledRot(meld, t, 90);
          melds.push({ id: t, x: l3x, y: cy, rot, key: `m3-${melds.length}` });
          cy += foot(m, rot).h + 1;
        }
      }
    } else if (seat === 1) {
      let upY = r1y - gap;               // grows upwards (their right)
      let downY = r1y + backsColH + gap; // overflow grows downwards
      for (const meld of list) {
        const heights = meld.tiles.map((t) => foot(m, calledRot(meld, t, 270)).h);
        const meldH = heights.reduce((a, b) => a + b + 1, -1);
        let y: number;
        if (upY - meldH >= rim) { upY -= meldH; y = upY; upY -= gap; }
        else { y = downY; downY += meldH + gap; }
        let cy = y;
        for (const t of meld.tiles) {
          const rot = calledRot(meld, t, 270);
          melds.push({ id: t, x: r1x, y: cy, rot, key: `m1-${melds.length}` });
          cy += foot(m, rot).h + 1;
        }
      }
    }
  };
  placeMelds(2); placeMelds(3); placeMelds(1);

  // ---- riichi sticks: laid on the cloth between the pond and the centre
  const sticks: PlacedStick[] = [];
  if (view.seats[0].riichi) sticks.push({ seat: 0, x: p0.x + (pondW - m.stick.w) / 2, y: p0.y - m.stick.h - 4, vertical: false });
  if (view.seats[2].riichi) sticks.push({ seat: 2, x: p2.x + (pondW - m.stick.w) / 2, y: p2.y + pondH + 4, vertical: false });
  if (view.seats[3].riichi) sticks.push({ seat: 3, x: p3.x + sidePondW + 4, y: p3.y + (sidePondH - m.stick.w) / 2, vertical: true });
  if (view.seats[1].riichi) sticks.push({ seat: 1, x: p1.x - m.stick.h - 4, y: p1.y + (sidePondH - m.stick.w) / 2, vertical: true });

  // snap everything to whole pixels (fractional origins blur tiles)
  const snap = (t: PlacedTile): PlacedTile => ({ ...t, x: Math.round(t.x), y: Math.round(t.y) });
  return {
    m,
    plates: plates.filter((p) => p.seat !== 0).map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })),
    backs: backs.map(snap),
    ponds: { 0: ponds[0].map(snap), 1: ponds[1].map(snap), 2: ponds[2].map(snap), 3: ponds[3].map(snap) },
    melds: melds.map(snap),
    sticks: sticks.map((st) => ({ ...st, x: Math.round(st.x), y: Math.round(st.y) })),
    pondBoxes,
  };
}

function calledRot(meld: { calledTile: TileId | null; calledFrom: unknown }, tile: TileId, base: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  const isCalled = meld.calledTile === tile && meld.calledFrom !== null;
  return isCalled ? rot90(base) : base;
}
