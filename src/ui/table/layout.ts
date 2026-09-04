/**
 * Deterministic table layout.
 *
 * Every object on the felt — concealed backs, pond tiles, called melds, the
 * human hand, riichi sticks and the centre block — gets explicit board-pixel
 * coordinates here, in plain TypeScript. The renderer absolutely positions
 * tiles inside one uniformly scaled container, so the table is pixel-identical
 * on every viewport and every browser engine: no flex, no grid, no percentage
 * sizing, no shrink-to-fit anywhere on the felt.
 *
 * Pond rules (authentic top-down): each seat's first row/line sits nearest
 * that seat and advances toward the centre, in the seat's own left-to-right
 * order. The human's pond is anchored at the bottom edge and grows UPWARD, so
 * it can never run underneath the hand row. Side ponds grow toward the centre
 * but stop short of the centre block; late-hand overflow wraps upward above
 * the grid (in the lane beside the owner's backs) instead of colliding with
 * the centre readout. Melds continue past the end of their seat's hand (that
 * seat's right), oriented like the hand; overflow zones are pond-aware. The
 * human hand sits face-up along the bottom edge with the drawn tile set apart,
 * and the player's melds to its right (above their pond when they would not
 * fit beside it).
 */
import type { DiscardEntry, Meld, PublicView, SeatIndex, TileId } from '@engine/types';
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
  /** pond tiles per row/line before the river wraps */
  pondCols: number;
}

export const METRICS: Record<BoardVariant, BoardMetrics> = {
  portrait: { W: 372, H: 510, tile: { w: 18, h: 25 }, hand: { w: 24, h: 33 }, gap: 5, rim: 6, stick: { w: 40, h: 6 }, cube: 52, pondCols: 6 },
  landscape: { W: 880, H: 560, tile: { w: 26, h: 35 }, hand: { w: 32, h: 43 }, gap: 8, rim: 10, stick: { w: 60, h: 8 }, cube: 60, pondCols: 7 },
  compact: { W: 640, H: 420, tile: { w: 20, h: 27 }, hand: { w: 24, h: 33 }, gap: 6, rim: 8, stick: { w: 48, h: 7 }, cube: 54, pondCols: 7 },
};

// ---------------------------------------------------------------------------
// Centre block geometry. These constants mirror .board-center / .dora-tray /
// .wind-cube / .sticks-row in table.css — keep them in sync.
// ---------------------------------------------------------------------------
const TRAY_PAD_X = 5;
const TRAY_PAD_Y = 4;
const TRAY_GAP = 2;
const TRAY_BORDER = 1;
const LABEL_GAP = 3;
const LABEL_H = 11;
const BLOCK_GAP = 7;
const STATUS_H = 16;
const CENTRE_MARGIN = 6; // keep-out between the centre block and any pond tile

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
  /** the dead-wall / dora / round-info block, explicitly placed */
  centre: Box & Placed;
  /** bounding boxes of each seat's pond (max extent), for debugging/tests */
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

/** size + position of the centre block for a board size */
export function centreMetrics(m: BoardMetrics): { tray: Box; block: Box & Placed } {
  const tray = {
    w: 5 * m.tile.w + 4 * TRAY_GAP + 2 * TRAY_PAD_X + 2 * TRAY_BORDER,
    h: m.tile.h + 2 * TRAY_PAD_Y + 2 * TRAY_BORDER,
  };
  const blockH = tray.h + LABEL_GAP + LABEL_H + BLOCK_GAP + m.cube + BLOCK_GAP + STATUS_H;
  return {
    tray,
    block: {
      x: Math.round((m.W - tray.w) / 2),
      y: Math.round(m.H / 2 - blockH / 2),
      w: tray.w,
      h: blockH,
    },
  };
}

export function layoutBoard(view: PublicView, variant: BoardVariant): BoardLayout {
  const m = METRICS[variant];
  const { W, H, tile, gap, rim } = m;
  const pondCols = m.pondCols;
  const pondStepX = tile.w + 2;
  const pondStepY = tile.h + 2;
  const gridW = pondCols * pondStepX - 2;          // top/bottom pond width
  const centre = centreMetrics(m).block;
  const centreTop = centre.y;
  const centreBottom = centre.y + centre.h;
  const centreLeft = centre.x;
  const centreRight = centre.x + centre.w;

  // hands shrink as they meld: size each row/column by its live tile count
  const n2 = Math.min(view.seats[2].concealedCount, 13);
  const n3 = Math.min(view.seats[3].concealedCount, 13);
  const n1 = Math.min(view.seats[1].concealedCount, 13);
  const spanOf = (n: number): number => (n > 0 ? n * tile.w + (n - 1) : 0);
  /** true vertical extent of a backs column (rotated tiles, (tile.w+1) pitch) */
  const colSpanOf = (n: number): number => (n > 0 ? (n - 1) * (tile.w + 1) + tile.h : 0);
  const backsRowW = spanOf(n2);
  const backsColH3 = colSpanOf(n3);
  const backsColH1 = colSpanOf(n1);

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

  // ---- ponds -------------------------------------------------------------
  // The hand row claims the bottom edge; the own pond is anchored just above
  // it and grows UPWARD (first discard nearest the owner), so the two can
  // never overlap no matter how long the river gets.
  const handH = m.hand.h;
  const handY = H - rim - handH;
  const pond0Y0 = handY - 7 - tile.h;                      // first (nearest) line
  const pond0Rows = Math.max(1, Math.floor((pond0Y0 - (centreBottom + CENTRE_MARGIN)) / pondStepY) + 1);
  const pond0H = pond0Rows * pondStepY - 2;
  const pond0X = Math.round((W - gridW) / 2);

  // across (seat 2): lines grow downward from just under their backs
  const pond2Y0 = t2y + tile.h + gap + 4;
  const pond2Rows = Math.max(1, Math.floor((centreTop - CENTRE_MARGIN - tile.h - pond2Y0) / pondStepY) + 1);
  const pond2X = pond0X;

  // side ponds: lines grow toward the centre but stop short of the block;
  // overflow wraps upward above the grid in the lane beside the owner's backs
  const sideLines = 6;                                     // tiles per line
  const sideH = sideLines * pondStepX - 2;                 // grid height along y
  const sideY = Math.round((H - sideH) / 2);
  const SIDE_OVERFLOW_TILES = 6;
  const overflowH = SIDE_OVERFLOW_TILES * pondStepX - 2 + 4;
  const pond3X = l3x + tile.h + gap + 4;
  const pond3Lines = Math.max(1, Math.floor((centreLeft - CENTRE_MARGIN - tile.h - pond3X) / pondStepY) + 1);
  const pond1Right = r1x - gap - 4;                        // right edge of seat 1's pond
  const pond1XRight = pond1Right - tile.h;                 // left edge of its nearest line
  const pond1Lines = Math.max(1, Math.floor((pond1XRight - (centreRight + CENTRE_MARGIN)) / pondStepY) + 1);

  const pondBoxes = {} as BoardLayout['pondBoxes'];
  const ponds = {} as BoardLayout['ponds'];

  /**
   * River → grid flow placement. Tiles advance a pixel cursor per line and a
   * riichi-declared discard lies sideways *paying for its rotated footprint*,
   * so neighbours never overlap. Top/bottom ponds wrap by row (dirY ±1, left-
   * or right-aligned via mirror); side ponds wrap by column.
   */
  type FlowRow = { tiles: PlacedTile[]; linesUsed: number };
  const flowRowPond = (
    river: DiscardEntry[], originX: number, y0: number, dirY: 1 | -1,
    mirror: boolean, maxRows: number, colsCap: number, keyPrefix: string,
  ): FlowRow => {
    const tiles: PlacedTile[] = [];
    let rowX = 0, row = 0;
    river.slice(0, maxRows * colsCap).forEach((d, i) => {
      const rot = (d.riichiDeclaration ? (mirror ? 270 : 90) : mirror ? 180 : 0) as 0 | 90 | 180 | 270;
      const fw = rot === 90 || rot === 270 ? tile.h : tile.w;
      if (rowX > 0 && rowX + fw > gridW) { row++; rowX = 0; }
      const x = mirror ? originX + gridW - rowX - fw : originX + rowX;
      tiles.push({
        id: d.tile, x: Math.round(x), y: y0 + dirY * row * pondStepY, rot,
        key: `${keyPrefix}-${i}`, dimmed: d.calledBy !== null,
      });
      rowX += fw + 2;
    });
    return { tiles, linesUsed: row + 1 };
  };
  type FlowCol = { tiles: PlacedTile[]; linesUsed: number; laneTop: number };
  const flowColPond = (
    river: DiscardEntry[], originX: number, dirX: 1 | -1, mirrorY: boolean,
    maxCols: number, linesPerCol: number, keyPrefix: string,
  ): FlowCol => {
    const tiles: PlacedTile[] = [];
    let colY = 0, col = 0, laneTop = sideY;
    const place = (d: DiscardEntry, x: number, y: number, rot: 0 | 90 | 180 | 270, i: number) => {
      tiles.push({ id: d.tile, x, y, rot, key: `${keyPrefix}-${i}`, dimmed: d.calledBy !== null });
      if (y < laneTop) laneTop = y;
    };
    river.slice(0, maxCols * linesPerCol + SIDE_OVERFLOW_TILES).forEach((d, i) => {
      const rot = (d.riichiDeclaration ? (dirX === 1 ? 180 : 0) : dirX === 1 ? 90 : 270) as 0 | 90 | 180 | 270;
      const fh = rot === 90 || rot === 270 ? tile.w : tile.h;
      const inGrid = col < maxCols;
      if (inGrid && colY > 0 && colY + fh > sideH) { col++; colY = 0; }
      if (col < maxCols) {
        const y = mirrorY ? sideY + sideH - colY - fh : sideY + colY;
        place(d, originX + dirX * col * pondStepY, Math.round(y), rot, i);
        colY += fh + 2;
      } else {
        // overflow lane above the grid, beside the owner's backs
        place(d, originX, Math.round(sideY - 4 - colY - fh), rot, i);
        colY += fh + 2;
      }
    });
    return { tiles, linesUsed: col + 1, laneTop };
  };

  // own (seat 0): bottom edge, first line nearest the owner, growing upward
  const flow0 = flowRowPond(view.seats[0].river, pond0X, pond0Y0, -1, false, pond0Rows, pondCols, 'p0');
  ponds[0] = flow0.tiles;
  pondBoxes[0] = { x: pond0X, y: pond0Y0 - (pond0Rows - 1) * pondStepY, w: gridW, h: pond0H };
  const pond0LinesUsed = Math.min(pond0Rows, flow0.linesUsed);
  const pond0TopNow = pond0Y0 - Math.max(0, pond0LinesUsed - 1) * pondStepY;

  // across (seat 2): top, lines advance toward the centre, right-aligned rows
  pondBoxes[2] = { x: pond2X, y: pond2Y0, w: gridW, h: pond2Rows * pondStepY - 2 };
  const flow2 = flowRowPond(view.seats[2].river, pond2X, pond2Y0, 1, true, pond2Rows, pondCols, 'p2');
  ponds[2] = flow2.tiles;
  const pond2LinesUsed = Math.min(pond2Rows, flow2.linesUsed);
  const pond2BottomNow = pond2Y0 + Math.max(0, pond2LinesUsed - 1) * pondStepY + tile.h;

  // left (seat 3): lines advance rightward toward the centre
  const pond3W = pond3Lines * pondStepY - 2;
  pondBoxes[3] = { x: pond3X, y: sideY - overflowH, w: pond3W, h: sideH + overflowH };
  const flow3 = flowColPond(view.seats[3].river, pond3X, 1, false, pond3Lines, sideLines, 'p3');
  ponds[3] = flow3.tiles;
  const laneTop3Now = flow3.laneTop - 2;

  // right (seat 1): lines advance leftward toward the centre, tiles bottom-to-top
  const pond1W = pond1Lines * pondStepY - 2;
  const pond1X = pond1XRight - (pond1Lines - 1) * pondStepY;
  pondBoxes[1] = { x: pond1X, y: sideY - overflowH, w: pond1W, h: sideH + overflowH };
  const flow1 = flowColPond(view.seats[1].river, pond1XRight, -1, true, pond1Lines, sideLines, 'p1');
  ponds[1] = flow1.tiles;
  const laneTop1Now = flow1.laneTop - 2;

  // ---- melds: continue past the end of each seat's hand, oriented like it.
  //      Each side seat owns ordered fallback zones (back column, then shared
  //      corner zones) so any number of melds stays on the felt and clear of
  //      ponds, the centre block and the hand. Seats are placed 3 → 1 → 2 so
  //      the shared corner zones' cursors bound one another.
  const melds: PlacedTile[] = [];
  /** extent of a meld group along its stacking axis, including inner 1px seams */
  const meldSpan = (meld: Meld, base: 0 | 90 | 180 | 270, axis: 'x' | 'y'): number =>
    meld.tiles.reduce((a, t) => {
      const f = foot(m, calledRot(meld, t, base));
      return a + (axis === 'x' ? f.w : f.h) + 1;
    }, -1);
  /** bounding box of a meld group laid out with `base` orientation */
  const meldBox = (meld: Meld, base: 0 | 90 | 180 | 270): Box => {
    const vertical = base === 90 || base === 270;
    return {
      w: vertical
        ? Math.max(...meld.tiles.map((t) => foot(m, calledRot(meld, t, base)).w))
        : meldSpan(meld, base, 'x'),
      h: vertical
        ? meldSpan(meld, base, 'y')
        : Math.max(...meld.tiles.map((t) => foot(m, calledRot(meld, t, base)).h)),
    };
  };
  const pushMeld = (meld: Meld, base: 0 | 90 | 180 | 270, x: number, y: number) => {
    let cx = x, cy = y;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, base);
      melds.push({ id: t, x: cx, y: cy, rot, key: `m-${melds.length}` });
      // side seats' melds stack along y; top/bottom seats' along x
      if (base === 90 || base === 270) cy += foot(m, rot).h + 1;
      else cx += foot(m, rot).w + 1;
    }
  };

  /**
   * Last-resort lane scanner: first free span of `len` along a lane, walking
   * past occupied segments. Returns the low edge, or `hi - len` (bottom of
   * the lane) when everything is taken — never an overlap with a segment.
   */
  const freeInLane = (blocks: Array<[number, number]>, len: number, lo: number, hi: number): number => {
    const segs = [...blocks].sort((a, b) => a[0] - b[0]);
    let p = lo;
    for (;;) {
      const hit = segs.find(([a0, a1]) => p < a1 && p + len > a0);
      if (!hit) return p;
      p = hit[1] + 1;
      if (p + len > hi) return hi - len;
    }
  };

  // Top-right shared zone: a column of right-aligned melds beside seat 2's
  // backs row (bounded by seat 1's pond grid / overflow lane and, later, by
  // seat 1's upward melds). Bottom-left shared zone: below seat 3's pond,
  // left of the own pond.
  const tr = {
    left: t2x + backsRowW + 6,   // live right edge of seat 2's backs row
    right: r1x - 4,              // clear of seat 1's meld column
    y: t2y,
    bottom: Math.min(laneTop1Now, sideY) - 4,
  };
  const bl = { left: l3x + tile.h + 4, right: pond0X - 6, y: sideY + sideH + 4, bottom: handY - 8 };
  const sideMeldFloor = Math.min(H - rim, handY - 8);

  // seat 3 (left): below their column, then above it, then the bottom-left zone
  let s3down = l3y + backsColH3 + gap;
  let s3up = l3y - gap;
  const lane3: Array<[number, number]> = [[l3y - 1, l3y + backsColH3 + 1]]; // backs block the lane
  for (const meld of view.seats[3].melds) {
    const h = meldSpan(meld, 90, 'y');
    const bw = meldBox(meld, 90).w;
    if (s3down + h <= sideMeldFloor) { pushMeld(meld, 90, l3x, s3down); lane3.push([s3down, s3down + h]); s3down += h + gap; }
    else if (s3up - h >= rim) { s3up -= h; pushMeld(meld, 90, l3x, s3up); lane3.push([s3up, s3up + h]); s3up -= gap; }
    else if (bl.y + h <= bl.bottom && bw <= bl.right - bl.left) { pushMeld(meld, 90, bl.right - bw, bl.y); bl.y += h + 6; }
    else {
      const y = freeInLane(lane3, h, rim, sideMeldFloor);
      pushMeld(meld, 90, l3x, y);
      lane3.push([y, y + h]);
      s3up = Math.min(s3up, y - gap);
    }
  }

  // seat 1 (right): above their column, then below it, then horizontal rows
  // in the top-right zone (short side-on rows that fit where columns cannot)
  let s1up = r1y - gap;
  let s1down = r1y + backsColH1 + gap;
  const lane1: Array<[number, number]> = [[r1y - 1, r1y + backsColH1 + 1]]; // backs block the lane
  for (const meld of view.seats[1].melds) {
    const h = meldSpan(meld, 270, 'y');
    if (s1up - h >= rim) { s1up -= h; pushMeld(meld, 270, r1x, s1up); lane1.push([s1up, s1up + h]); s1up -= gap; }
    else if (s1down + h <= sideMeldFloor) { pushMeld(meld, 270, r1x, s1down); lane1.push([s1down, s1down + h]); s1down += h + gap; }
    else {
      const hb = meldBox(meld, 180);
      if (tr.y + hb.h <= tr.bottom && hb.w <= tr.right - tr.left) {
        pushMeld(meld, 180, tr.right - hb.w, tr.y); tr.y += hb.h + 4;
      }
      // then a horizontal row in the bottom-left zone (shared with seat 3)
      else if (bl.y + hb.h <= bl.bottom && hb.w <= bl.right - bl.left) {
        pushMeld(meld, 180, bl.right - hb.w, bl.y); bl.y += hb.h + 6;
      } else {
        const y = freeInLane(lane1, h, rim, sideMeldFloor);
        pushMeld(meld, 270, r1x, y);
        lane1.push([y, y + h]);
        s1up = Math.min(s1up, y - gap);
      }
    }
  }
  tr.bottom = Math.min(tr.bottom, s1up + gap);

  // seat 2 (across): left of their row, then a column at the rim (clear of
  // their backs row and seat 3's upward melds), then the shared corners
  let s2left = t2x - gap;
  const c2LeftBottom = Math.min(laneTop3Now, s3up) - 4;
  let c2Y = t2y + tile.h + 6;
  const row2: Array<[number, number]> = [[t2x - 1, t2x + backsRowW + 1]]; // backs block the row
  for (const meld of view.seats[2].melds) {
    const w = meldSpan(meld, 180, 'x');
    const hb = meldBox(meld, 180);
    if (s2left - w >= rim) { s2left -= w; pushMeld(meld, 180, s2left, t2y); row2.push([s2left, s2left + w]); s2left -= gap; }
    else if (c2Y + hb.h <= c2LeftBottom && w <= pond2X - CENTRE_MARGIN - rim) { pushMeld(meld, 180, rim, c2Y); c2Y += hb.h + 6; }
    else if (tr.y + hb.h <= tr.bottom && hb.w <= tr.right - tr.left) { pushMeld(meld, 180, tr.right - hb.w, tr.y); tr.y += hb.h + 4; }
    else if (bl.y + hb.h <= bl.bottom && hb.w <= bl.right - bl.left) { pushMeld(meld, 180, bl.right - hb.w, bl.y); bl.y += hb.h + 6; }
    else {
      const x = freeInLane(row2, w, rim, Math.max(t2x - 1, rim + w));
      pushMeld(meld, 180, x, t2y);
      row2.push([x, x + w]);
      s2left = Math.min(s2left, x - gap);
    }
  }

  // ---- the human hand: face-up along the bottom edge, drawn tile set apart
  const hand: PlacedTile[] = [];
  const sorted = sortTiles(view.hand);
  const step = m.hand.w + 1;
  const drawnGap = 6;
  const rowW = sorted.length > 0 ? sorted.length * step - 1 + (view.drawnTile !== null ? drawnGap + m.hand.w : 0) : 0;
  const hx = Math.round((W - rowW) / 2);
  const hy = handY;
  sorted.forEach((t, i) => hand.push({ id: t, x: hx + i * step, y: hy, rot: 0, key: `h-${i}` }));
  if (view.drawnTile !== null && sorted.length > 0) {
    hand.push({ id: view.drawnTile, x: hx + rowW - m.hand.w, y: hy, rot: 0, key: 'h-drawn' });
  }
  const handBox = { x: hx, y: hy, w: rowW, h: m.hand.h };

  // ---- the human melds: to the right of the hand (their right hand side),
  //      wrapping to a right-aligned row above their pond when they won't fit
  const ownMelds = view.seats[0].melds;
  const ownSpan = (meld: Meld): number => meldSpan(meld, 0, 'x');
  const totalOwn = ownMelds.reduce((a, md) => a + ownSpan(md) + 8, 0);
  const beside = rowW > 0 && hx + rowW + 10 + totalOwn <= W - rim;
  let ox = hx + rowW + 10;
  const oyBeside = H - rim - tile.h;
  // above the pond's live top row, but never reaching into the centre block
  // nor under seat 1's backs column (which can hang down to here when long)
  const oyAbove = Math.max(pond0TopNow - 8 - tile.h, centreBottom + CENTRE_MARGIN);
  let oy = oyBeside;
  if (!beside) {
    ox = Math.min(W - rim, r1x - 4);
    oy = oyAbove;
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

  // ---- riichi sticks: laid on the cloth between the pond and the centre,
  //      tracking the river's live edge so they never sit on top of tiles;
  //      when the river has grown all the way to the centre block the stick
  //      lies beside the live row instead (never on top of pond tiles)
  const sticks: PlacedStick[] = [];
  if (view.seats[0].riichi) {
    const aboveY = pond0TopNow - m.stick.h - 4;
    if (aboveY >= centreBottom + 4) {
      sticks.push({ seat: 0, x: pond0X + (gridW - m.stick.w) / 2, y: aboveY, vertical: false });
    } else {
      sticks.push({
        seat: 0,
        x: Math.min(pond0X + gridW + 8, W - rim - m.stick.w),
        y: pond0TopNow + (tile.h - m.stick.h) / 2,
        vertical: false,
      });
    }
  }
  if (view.seats[2].riichi) {
    const belowY = pond2BottomNow + 4;
    if (belowY + m.stick.h <= centreTop - 4) {
      sticks.push({ seat: 2, x: pond2X + (gridW - m.stick.w) / 2, y: belowY, vertical: false });
    } else {
      sticks.push({
        seat: 2,
        x: Math.max(pond2X - 8 - m.stick.w, rim),
        y: pond2BottomNow - tile.h + (tile.h - m.stick.h) / 2,
        vertical: false,
      });
    }
  }
  // side seats: a vertical stick fits in the lane toward the centre only when
  // there is room; otherwise the stick lies horizontally along the grid edge
  // (above for the left seat, below for the right seat, clearing overflow).
  const pond3GridRight = pond3X + pond3W;
  if (view.seats[3].riichi) {
    if (centreLeft - CENTRE_MARGIN - pond3GridRight >= m.stick.h + 8) {
      sticks.push({ seat: 3, x: pond3GridRight + 4, y: sideY + (sideH - m.stick.w) / 2, vertical: true });
    } else {
      const over = Math.max(0, view.seats[3].river.length - pond3Lines * sideLines);
      const y = over > 0
        ? sideY - 8 - tile.w - (over - 1) * pondStepX - m.stick.h
        : sideY - m.stick.h - 4;
      sticks.push({ seat: 3, x: pond3X + (pond3W - m.stick.w) / 2, y, vertical: false });
    }
  }
  const pond1GridLeft = pond1XRight - (pond1Lines - 1) * pondStepY;
  if (view.seats[1].riichi) {
    if (pond1GridLeft - (centreRight + CENTRE_MARGIN) >= m.stick.h + 8) {
      sticks.push({ seat: 1, x: pond1GridLeft - m.stick.h - 4, y: sideY + (sideH - m.stick.w) / 2, vertical: true });
    } else {
      sticks.push({ seat: 1, x: pond1X + (pond1W - m.stick.w) / 2, y: sideY + sideH + 4, vertical: false });
    }
  }

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
    centre,
    pondBoxes,
  };
}
