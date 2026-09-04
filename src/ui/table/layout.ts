/**
 * Deterministic table layout.
 *
 * Every object on the felt — concealed backs, pond tiles, called melds, the
 * human hand and its melds, riichi sticks — gets explicit board-pixel
 * coordinates here, in plain TypeScript. The renderer absolutely positions
 * tiles inside one uniformly scaled container, so the table is pixel-identical
 * on every viewport and every browser engine: no flex, no grid, no percentage
 * sizing, no shrink-to-fit anywhere on the felt.
 *
 * Pond rules (authentic top-down): each seat's first row sits nearest that
 * seat and rows advance toward the centre, in the seat's own left-to-right
 * order. Melds continue past the end of their seat's hand (that seat's right),
 * oriented like the hand; if that slot runs out of felt they wrap to the other
 * side of the hand. The human hand sits face-up along the bottom edge with the
 * drawn tile separated, and the player's melds to its right (above it when
 * they would not fit beside it).
 */
import type { Meld, PublicView, SeatIndex, TileId } from '@engine/types';
import { sortTiles } from '@ui/tiles';

export type BoardVariant = 'portrait' | 'landscape' | 'compact';

export interface BoardMetrics {
  W: number;
  H: number;
  /** river/meld tile face size */
  tile: { w: number; h: number };
  /** the human's own tiles read a little larger, being closest to the eye */
  hand: { w: number; h: number };
  gap: number;
  rim: number;
  stick: { w: number; h: number };
  cube: number;
}

export const METRICS: Record<BoardVariant, BoardMetrics> = {
  portrait: { W: 360, H: 510, tile: { w: 18, h: 25 }, hand: { w: 22, h: 31 }, gap: 5, rim: 6, stick: { w: 40, h: 6 }, cube: 56 },
  landscape: { W: 880, H: 560, tile: { w: 26, h: 35 }, hand: { w: 32, h: 43 }, gap: 8, rim: 10, stick: { w: 60, h: 8 }, cube: 64 },
  compact: { W: 640, H: 420, tile: { w: 20, h: 27 }, hand: { w: 24, h: 33 }, gap: 6, rim: 8, stick: { w: 48, h: 7 }, cube: 58 },
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

export interface PlacedStick {
  seat: SeatIndex;
  x: number;
  y: number;
  vertical: boolean;
}

export interface Box { w: number; h: number }
export interface Placed { x: number; y: number }

export interface BoardLayout {
  m: BoardMetrics;
  backs: PlacedTile[];
  ponds: Record<SeatIndex, PlacedTile[]>;
  melds: PlacedTile[];
  /** the human's concealed hand + drawn tile, face up along the bottom edge */
  hand: PlacedTile[];
  handBox: Box & Placed;
  sticks: PlacedStick[];
  /** bounding boxes of each seat's pond, for debugging/tests */
  pondBoxes: Record<SeatIndex, Box & Placed>;
}

/** footprint of a rotated tile */
function foot(m: BoardMetrics, rot: number): Box {
  return rot === 90 || rot === 270 ? { w: m.tile.h, h: m.tile.w } : { w: m.tile.w, h: m.tile.h };
}

function rot90(r: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  return (((r + 90) % 360) as 0 | 90 | 180 | 270);
}

/** the tile a meld was called with lies sideways in the group */
function calledRot(meld: Meld, tile: TileId, base: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  const isCalled = meld.calledTile === tile && meld.calledFrom !== null;
  return isCalled ? rot90(base) : base;
}

export function layoutBoard(view: PublicView, variant: BoardVariant): BoardLayout {
  const m = METRICS[variant];
  const { W, H, tile, gap, rim } = m;

  // hands shrink as they meld: size each row/column by its live tile count
  const n2 = Math.min(view.seats[2].concealedCount, 13);
  const n3 = Math.min(view.seats[3].concealedCount, 13);
  const n1 = Math.min(view.seats[1].concealedCount, 13);
  const spanOf = (n: number): number => (n > 0 ? n * tile.w + (n - 1) : 0);
  const backsRowW = spanOf(n2);
  const backsColH3 = spanOf(n3);
  const backsColH1 = spanOf(n1);
  const pondW = 6 * tile.w + 5 * 2;          // 6 columns of faces
  const pondH = 3 * tile.h + 2 * 2;          // 3 rows of faces
  const sidePondW = 3 * tile.h + 2 * 2;
  const sidePondH = 6 * tile.w + 5 * 2;

  // ---- concealed backs: a row/column hugging each seat's edge
  const backs: PlacedTile[] = [];
  const t2x = Math.round((W - backsRowW) / 2);
  const t2y = rim + 6;
  for (let i = 0; i < n2; i++) {
    backs.push({ id: 0, x: t2x + i * (tile.w + 1), y: t2y, rot: 180, faceDown: true, key: `b2-${i}` });
  }
  const l3x = rim + 6;
  const l3y = Math.round((H - backsColH3) / 2);
  for (let i = 0; i < n3; i++) {
    backs.push({ id: 0, x: l3x, y: l3y + i * (tile.w + 1), rot: 90, faceDown: true, key: `b3-${i}` });
  }
  const r1x = W - rim - 6 - tile.h;
  const r1y = Math.round((H - backsColH1) / 2);
  for (let i = 0; i < n1; i++) {
    backs.push({ id: 0, x: r1x, y: r1y + i * (tile.w + 1), rot: 270, faceDown: true, key: `b1-${i}` });
  }

  // ---- ponds: fixed 6x3 grids, rows start at the owner's edge and advance
  //      toward the centre in the owner's left-to-right order
  const pondBoxes = {} as BoardLayout['pondBoxes'];
  const ponds = {} as BoardLayout['ponds'];

  // own (seat 0): bottom, row 1 at the bottom edge
  const p0 = { x: Math.round((W - pondW) / 2), y: H - rim - pondH };
  pondBoxes[0] = { ...p0, w: pondW, h: pondH };
  ponds[0] = view.seats[0].river.map((d, i) => {
    const r = Math.floor(i / 6), c = i % 6;
    return {
      id: d.tile, x: p0.x + c * (tile.w + 2), y: p0.y + (2 - r) * (tile.h + 2),
      rot: (d.riichiDeclaration ? 90 : 0) as 0 | 90, key: `p0-${i}`, dimmed: d.calledBy !== null,
    };
  });

  // across (seat 2): top, rows grow downward, columns right-to-left
  const p2 = { x: Math.round((W - pondW) / 2), y: t2y + tile.h + gap + 4 };
  pondBoxes[2] = { ...p2, w: pondW, h: pondH };
  ponds[2] = view.seats[2].river.map((d, i) => {
    const r = Math.floor(i / 6), c = i % 6;
    return {
      id: d.tile, x: p2.x + (5 - c) * (tile.w + 2), y: p2.y + r * (tile.h + 2),
      rot: (d.riichiDeclaration ? 270 : 180) as 180 | 270, key: `p2-${i}`, dimmed: d.calledBy !== null,
    };
  });

  // left (seat 3): columns grow rightward, rows top-to-bottom
  const p3 = { x: l3x + tile.h + gap + 4, y: Math.round((H - sidePondH) / 2) };
  pondBoxes[3] = { ...p3, w: sidePondW, h: sidePondH };
  ponds[3] = view.seats[3].river.map((d, i) => {
    const r = Math.floor(i / 6), c = i % 6;
    return {
      id: d.tile, x: p3.x + r * (tile.h + 2), y: p3.y + c * (tile.w + 2),
      rot: (d.riichiDeclaration ? 180 : 90) as 90 | 180, key: `p3-${i}`, dimmed: d.calledBy !== null,
    };
  });

  // right (seat 1): columns grow leftward, rows bottom-to-top
  const p1 = { x: r1x - sidePondW - gap - 4, y: Math.round((H - sidePondH) / 2) };
  pondBoxes[1] = { ...p1, w: sidePondW, h: sidePondH };
  ponds[1] = view.seats[1].river.map((d, i) => {
    const r = Math.floor(i / 6), c = i % 6;
    return {
      id: d.tile, x: p1.x + (2 - r) * (tile.h + 2), y: p1.y + (5 - c) * (tile.w + 2),
      rot: (d.riichiDeclaration ? 0 : 270) as 0 | 270, key: `p1-${i}`, dimmed: d.calledBy !== null,
    };
  });

  // ---- melds: continue past the end of each seat's hand, oriented like it.
  //      If the primary slot runs off the felt, overflow to the other side of
  //      that seat's hand (still beside their hand, never overlapping ponds).
  const melds: PlacedTile[] = [];
  /** extent of a meld group along one axis, including inner 1px seams */
  const meldSpan = (meld: Meld, base: 0 | 90 | 180 | 270, axis: 'x' | 'y'): number =>
    meld.tiles.reduce((a, t) => {
      const f = foot(m, calledRot(meld, t, base));
      return a + (axis === 'x' ? f.w : f.h) + 1;
    }, -1);

  // seat 2 (across): left of their row, growing leftwards; overflow rightwards;
  // a quad that fits neither side sits in the free corner beside their pond
  let s2left = t2x - gap;
  let s2right = t2x + backsRowW + gap;
  let c2left = rim;
  let c2right = W - rim;
  const c2y = t2y;
  for (const meld of view.seats[2].melds) {
    const w = meldSpan(meld, 180, 'x');
    let x: number;
    if (s2left - w >= rim) { s2left -= w; x = s2left; s2left -= gap; }
    else if (s2right + w <= W - rim) { x = s2right; s2right += w + gap; }
    else if (c2left + w <= p2.x - 6) { x = c2left; c2left += w + gap; }
    else { c2right -= w; x = c2right; c2right -= gap; }
    let cx = x;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 180);
      melds.push({ id: t, x: cx, y: c2y, rot, key: `m2-${melds.length}` });
      cx += foot(m, rot).w + 1;
    }
  }
  // seat 3 (left): below their column, growing downwards; overflow upwards
  let s3down = l3y + backsColH3 + gap;
  let s3up = l3y - gap;
  for (const meld of view.seats[3].melds) {
    const h = meldSpan(meld, 90, 'y');
    let y: number;
    if (s3down + h <= H - rim) { y = s3down; s3down += h + gap; }
    else { s3up -= h; y = s3up; s3up -= gap; }
    let cy = y;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 90);
      melds.push({ id: t, x: l3x, y: cy, rot, key: `m3-${melds.length}` });
      cy += foot(m, rot).h + 1;
    }
  }
  // seat 1 (right): above their column, growing upwards; overflow downwards
  let s1up = r1y - gap;
  let s1down = r1y + backsColH1 + gap;
  for (const meld of view.seats[1].melds) {
    const h = meldSpan(meld, 270, 'y');
    let y: number;
    if (s1up - h >= rim) { s1up -= h; y = s1up; s1up -= gap; }
    else { y = s1down; s1down += h + gap; }
    let cy = y;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 270);
      melds.push({ id: t, x: r1x, y: cy, rot, key: `m1-${melds.length}` });
      cy += foot(m, rot).h + 1;
    }
  }

  // ---- the human hand: face-up along the bottom edge, drawn tile set apart
  const hand: PlacedTile[] = [];
  const sorted = sortTiles(view.hand);
  const step = m.hand.w + 2;
  const drawnGap = 8;
  const rowW = sorted.length > 0 ? sorted.length * step - 2 + (view.drawnTile !== null ? drawnGap + m.hand.w : 0) : 0;
  const hx = Math.round((W - rowW) / 2);
  const hy = H - rim - m.hand.h;
  sorted.forEach((t, i) => hand.push({ id: t, x: hx + i * step, y: hy, rot: 0, key: `h-${i}` }));
  if (view.drawnTile !== null && sorted.length > 0) {
    hand.push({ id: view.drawnTile, x: hx + rowW - m.hand.w, y: hy, rot: 0, key: 'h-drawn' });
  }
  const handBox = { x: hx, y: hy, w: rowW, h: m.hand.h };

  // ---- the human melds: to the right of the hand (their right hand side),
  //      wrapping to a right-aligned row above the hand when they won't fit
  const ownMelds = view.seats[0].melds;
  const ownSpan = (meld: Meld): number => meldSpan(meld, 0, 'x');
  const totalOwn = ownMelds.reduce((a, md) => a + ownSpan(md) + 8, 0);
  const beside = rowW > 0 && hx + rowW + 10 + totalOwn <= W - rim;
  let ox = hx + rowW + 10;
  let oy = H - rim - tile.h;
  if (!beside) {
    ox = W - rim;
    oy = p0.y - m.stick.h - 8 - tile.h;
  }
  for (const meld of ownMelds) {
    const w = ownSpan(meld);
    let x: number;
    if (beside) { x = ox; ox += w + 8; }
    else { ox -= w; x = ox; ox -= 8; }
    let cx = x;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 0);
      melds.push({ id: t, x: cx, y: oy, rot, key: `m0-${melds.length}` });
      cx += foot(m, rot).w + 1;
    }
  }

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
    backs: backs.map(snap),
    ponds: { 0: ponds[0].map(snap), 1: ponds[1].map(snap), 2: ponds[2].map(snap), 3: ponds[3].map(snap) },
    melds: melds.map(snap),
    hand: hand.map(snap),
    handBox: { x: Math.round(hx), y: hy, w: Math.round(rowW), h: m.hand.h },
    sticks: sticks.map((st) => ({ ...st, x: Math.round(st.x), y: Math.round(st.y) })),
    pondBoxes,
  };
}
