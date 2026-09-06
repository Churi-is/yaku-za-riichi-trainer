/**
 * Deterministic table layout.
 *
 * Every object on the felt — concealed backs, pond tiles, called melds, the
 * human hand and its melds, riichi sticks and the centre block — gets explicit
 * board-pixel coordinates here, in plain TypeScript. The renderer absolutely
 * positions everything inside one uniformly scaled container, so the table is
 * pixel-identical on every viewport and every browser engine: no flex, no
 * grid, no percentage sizing, no shrink-to-fit anywhere on the felt.
 *
 * The board is laid out as four bands so nothing can ever collide:
 *
 *   1. the human's bottom block (hand + own melds) is placed first, hugging
 *      the bottom edge — it is the one thing that must never be covered;
 *   2. each seat's pond is then placed against its own edge, clear of that
 *      block, rows advancing toward the centre in the seat's reading order;
 *   3. melds continue past the end of their seat's hand and are clamped to
 *      the free felt between the ponds;
 *   4. whatever rectangle is left in the middle holds the centre block (dora
 *      tray, round cube, sticks), whose tile size is derived from that space.
 *
 * Riichi declaration tiles lie sideways *in flow*: the row they belong to is
 * measured tile by tile, so a rotated tile pushes its neighbours along instead
 * of overlapping them. Rivers longer than eighteen tiles extend the last row
 * outward, exactly like a real table.
 */
import type { Meld, PublicView, SeatIndex, TileId } from '@engine/types';
import { sortTiles } from '@ui/tiles';

export type BoardVariant = 'portrait' | 'landscape' | 'compact';

interface Box { w: number; h: number }
interface Placed { x: number; y: number }
export type Rect = Box & Placed;

export interface BoardMetrics {
  W: number;
  H: number;
  /** river/meld/back tile face size */
  tile: Box;
  /** the human's own tiles read a little larger, being closest to the eye */
  hand: Box;
  /** seam between neighbouring tiles inside a pond/meld */
  seam: number;
  /** seam between neighbouring tiles in the human hand */
  handSeam: number;
  /** space between a hand and its own pond */
  gap: number;
  /** felt margin */
  rim: number;
  stick: Box;
  /** preferred round-wind cube size (shrinks if the middle is tight) */
  cube: number;
}

export const METRICS: Record<BoardVariant, BoardMetrics> = {
  portrait: {
    W: 360, H: 432, tile: { w: 18, h: 25 }, hand: { w: 22, h: 30 },
    seam: 2, handSeam: 2, gap: 5, rim: 6, stick: { w: 38, h: 6 }, cube: 54,
  },
  landscape: {
    W: 780, H: 520, tile: { w: 26, h: 35 }, hand: { w: 32, h: 43 },
    seam: 2, handSeam: 2, gap: 8, rim: 10, stick: { w: 56, h: 8 }, cube: 74,
  },
  compact: {
    W: 620, H: 384, tile: { w: 19, h: 26 }, hand: { w: 24, h: 33 },
    seam: 2, handSeam: 2, gap: 6, rim: 7, stick: { w: 42, h: 6 }, cube: 56,
  },
};

type TileRot = 0 | 90 | 180 | 270;

export interface PlacedTile {
  id: TileId;
  x: number;
  y: number;
  rot: TileRot;
  faceDown?: boolean;
  dimmed?: boolean;
  /** the discard everyone is looking at right now */
  latest?: boolean;
  /** discarded straight from the draw — a strong river-reading signal */
  tsumogiri?: boolean;
  key: string;
}

interface PlacedStick {
  seat: SeatIndex;
  x: number;
  y: number;
  vertical: boolean;
}

/** the centre block: dora tray + round cube + sticks, sized to the free space */
export interface CenterBlock extends Rect {
  /** dora indicator tile size (derived from the free width) */
  dora: Box;
  cube: number;
}

interface BoardLayout {
  m: BoardMetrics;
  backs: PlacedTile[];
  ponds: Record<SeatIndex, PlacedTile[]>;
  melds: PlacedTile[];
  /** the human's concealed hand + drawn tile, face up along the bottom edge */
  hand: PlacedTile[];
  handBox: Rect;
  /** bounding box of the human's own called sets */
  sticks: PlacedStick[];
  center: CenterBlock;
  /** bounding boxes of each seat's pond, for debugging/tests */
  pondBoxes: Record<SeatIndex, Rect>;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** footprint of a rotated tile, in board axes */
function foot(m: BoardMetrics, rot: number): Box {
  return rot === 90 || rot === 270 ? { w: m.tile.h, h: m.tile.w } : { w: m.tile.w, h: m.tile.h };
}

function rot90(r: TileRot): TileRot {
  return (((r + 90) % 360) as TileRot);
}

/** the tile a meld was called with lies sideways in the group */
function calledRot(meld: Meld, tile: TileId, base: TileRot): TileRot {
  const isCalled = meld.calledTile === tile && meld.calledFrom !== null;
  return isCalled ? rot90(base) : base;
}

/**
 * A seat's local frame on the felt: `u` is the seat's own left-to-right, `v`
 * runs from that seat's edge toward the centre. The origin is the corner of
 * the pond nearest that seat's left hand.
 */
interface Frame { ox: number; oy: number; ux: number; uy: number; vx: number; vy: number }

function frameFor(seat: SeatIndex, box: Rect): Frame {
  switch (seat) {
    // bottom: reads left→right, rows climb toward the centre
    case 0: return { ox: box.x, oy: box.y + box.h, ux: 1, uy: 0, vx: 0, vy: -1 };
    // right: reads bottom→top, rows advance leftward
    case 1: return { ox: box.x + box.w, oy: box.y + box.h, ux: 0, uy: -1, vx: -1, vy: 0 };
    // across: reads right→left, rows descend toward the centre
    case 2: return { ox: box.x + box.w, oy: box.y, ux: -1, uy: 0, vx: 0, vy: 1 };
    // left: reads top→bottom, rows advance rightward
    default: return { ox: box.x, oy: box.y, ux: 0, uy: 1, vx: 1, vy: 0 };
  }
}

/** place a footprint `du` along the seat's reading axis and `dv` rows in */
function place(f: Frame, du: number, dv: number, fw: number, fh: number): Placed {
  let x = f.ox;
  let y = f.oy;
  if (f.ux !== 0) x += f.ux > 0 ? du : -du - fw;
  else y += f.uy > 0 ? du : -du - fh;
  if (f.vx !== 0) x += f.vx > 0 ? dv : -dv - fw;
  else y += f.vy > 0 ? dv : -dv - fh;
  return { x, y };
}

/** base rotation of a seat's tiles seen from the viewer's chair */
const BASE_ROT: Record<SeatIndex, TileRot> = { 0: 0, 1: 270, 2: 180, 3: 90 };

/**
 * How far each variant may stretch to match the shape of the felt it is
 * given. Portrait keeps its width (so hand tiles stay the same fraction of a
 * phone screen) and grows taller; landscape keeps its height and grows wider.
 * Without this the board would sit in a letterbox of dead felt.
 */
export const BOUNDS: Record<BoardVariant, { min: number; max: number }> = {
  // a table should still read as a table: stretch, but never into a corridor
  portrait: { min: 400, max: 520 },
  landscape: { min: 700, max: 940 },
  compact: { min: 560, max: 740 },
};

/** metrics for a variant, stretched to the aspect of the felt it must fill */
export function fitMetrics(variant: BoardVariant, cw: number, ch: number): BoardMetrics {
  const base = METRICS[variant];
  if (!(cw > 0) || !(ch > 0)) return base;
  const b = BOUNDS[variant];
  if (variant === 'portrait') {
    return { ...base, H: clamp(Math.round((base.W * ch) / cw), b.min, b.max) };
  }
  return { ...base, W: clamp(Math.round((base.H * cw) / ch), b.min, b.max) };
}

export function layoutBoard(
  view: PublicView,
  variant: BoardVariant,
  metrics: BoardMetrics = METRICS[variant],
): BoardLayout {
  const m = metrics;
  const { W, H, tile, hand: handSz, gap, rim, seam } = m;

  const rowSpan = 6 * tile.w + 5 * seam;      // a nominal six-tile pond row
  const pondDepth = 3 * tile.h + 2 * seam;    // three rows deep
  const meldGap = Math.round(gap * 1.4);
  /** extent of a meld group along one axis, including inner seams */
  const meldSpan = (meld: Meld, base: TileRot, axis: 'x' | 'y'): number =>
    meld.tiles.reduce((a, t) => {
      const f = foot(m, calledRot(meld, t, base));
      return a + (axis === 'x' ? f.w : f.h) + 1;
    }, -1);

  // -------------------------------------------------------------------------
  // 1. the human's bottom block — hand, drawn tile, own called sets
  // -------------------------------------------------------------------------
  const sorted = sortTiles(view.hand);
  const drawn = view.drawnTile;
  const handStep = handSz.w + m.handSeam;
  const drawnGap = Math.round(handSz.w * 0.45);
  const handRowW = sorted.length > 0
    ? sorted.length * handStep - m.handSeam + (drawn !== null ? drawnGap + handSz.w : 0)
    : 0;

  const ownMelds = view.seats[0].melds;
  const ownMeldW = ownMelds.reduce((a, md) => a + meldSpan(md, 0, 'x') + meldGap, 0);
  const handY = H - rim - handSz.h;
  const beside = handRowW + ownMeldW <= W - 2 * rim;

  const hx = Math.round((W - (beside ? handRowW + ownMeldW : handRowW)) / 2);
  const hand: PlacedTile[] = [];
  sorted.forEach((t, i) => hand.push({ id: t, x: hx + i * handStep, y: handY, rot: 0, key: `h-${i}` }));
  if (drawn !== null) {
    hand.push({ id: drawn, x: hx + handRowW - handSz.w, y: handY, rot: 0, key: 'h-drawn' });
  }
  const handBox: Rect = { x: hx, y: handY, w: handRowW, h: handSz.h };

  const melds: PlacedTile[] = [];
  // beside the hand (the player's right), else a right-aligned row above it
  const ownMeldY = beside ? handY + handSz.h - tile.h : handY - 4 - tile.h;
  let ownX = beside ? hx + handRowW + meldGap : W - rim - ownMeldW + meldGap;
  if (ownMelds.length > 0) {
  }
  for (const meld of ownMelds) {
    let cx = ownX;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 0);
      const f = foot(m, rot);
      melds.push({ id: t, x: cx, y: ownMeldY + tile.h - f.h, rot, key: `m0-${melds.length}` });
      cx += f.w + 1;
    }
    ownX += meldSpan(meld, 0, 'x') + meldGap;
  }

  /** top of everything the human owns along the bottom edge */
  const bottomTop = Math.min(handY, ownMelds.length > 0 ? ownMeldY : handY);

  // -------------------------------------------------------------------------
  // 2. opponents' hands and called sets — one line along each seat's edge
  // -------------------------------------------------------------------------
  // A seat's concealed backs and its melds are laid out as ONE line hugging
  // that seat's edge (melds continue past the hand on that seat's right, the
  // way a real player stacks them), and the whole line is centred in the felt
  // left over between the across hand and the human's block. That keeps four
  // open hands on the table without a single collision.
  const backs: PlacedTile[] = [];
  const liveCount = (s: SeatIndex): number => clamp(view.seats[s].concealedCount, 0, 13);
  const n1 = liveCount(1);
  const n2 = liveCount(2);
  const n3 = liveCount(3);
  const spanOf = (n: number): number => (n > 0 ? n * (tile.w + 1) - 1 : 0);

  const t2y = rim;
  const l3x = rim;
  const r1x = W - rim - tile.h;
  const sideMin = t2y + tile.h + 4;
  const sideMax = bottomTop - 4;

  /** centre "hand + melds" in [lo, hi], tightening the gaps if it is snug */
  const line = (handSpan: number, spans: number[], lo: number, hi: number) => {
    const solid = handSpan + spans.reduce((a, b) => a + b, 0);
    let g = meldGap;
    if (spans.length > 0 && solid + g * spans.length > hi - lo) {
      g = clamp(Math.floor((hi - lo - solid) / spans.length), 1, meldGap);
    }
    const total = solid + g * spans.length;
    return { start: clamp(Math.round((lo + hi - total) / 2), lo, Math.max(lo, hi - total)), g };
  };

  // across (seat 2): reads right-to-left, so its melds sit to the screen-left
  const m2spans = view.seats[2].melds.map((md) => meldSpan(md, 180, 'x'));
  const l2 = line(spanOf(n2), m2spans, rim, W - rim);
  const t2x = l2.start + m2spans.reduce((a, b) => a + b, 0) + l2.g * m2spans.length;
  for (let i = 0; i < n2; i++) {
    backs.push({ id: 0, x: t2x + i * (tile.w + 1), y: t2y, rot: 180, faceDown: true, key: `b2-${i}` });
  }
  let m2x = t2x;
  view.seats[2].melds.forEach((meld, mi) => {
    m2x -= l2.g + m2spans[mi];
    let cx = m2x;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 180);
      melds.push({ id: t, x: cx, y: t2y, rot, key: `m2-${melds.length}` });
      cx += foot(m, rot).w + 1;
    }
  });

  // left (seat 3): reads top-to-bottom, melds continue below the hand
  const m3spans = view.seats[3].melds.map((md) => meldSpan(md, 90, 'y'));
  const l3 = line(spanOf(n3), m3spans, sideMin, sideMax);
  const l3y = l3.start;
  for (let i = 0; i < n3; i++) {
    backs.push({ id: 0, x: l3x, y: l3y + i * (tile.w + 1), rot: 90, faceDown: true, key: `b3-${i}` });
  }
  let m3y = l3y + spanOf(n3);
  view.seats[3].melds.forEach((meld, mi) => {
    m3y += l3.g;
    let cy = m3y;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 90);
      const f = foot(m, rot);
      melds.push({ id: t, x: l3x, y: cy, rot, key: `m3-${melds.length}` });
      cy += f.h + 1;
    }
    m3y += m3spans[mi];
  });

  // right (seat 1): reads bottom-to-top, melds continue above the hand
  const m1spans = view.seats[1].melds.map((md) => meldSpan(md, 270, 'y'));
  const l1 = line(spanOf(n1), m1spans, sideMin, sideMax);
  const r1y = l1.start + m1spans.reduce((a, b) => a + b, 0) + l1.g * m1spans.length;
  for (let i = 0; i < n1; i++) {
    backs.push({ id: 0, x: r1x, y: r1y + i * (tile.w + 1), rot: 270, faceDown: true, key: `b1-${i}` });
  }
  let m1y = r1y;
  view.seats[1].melds.forEach((meld, mi) => {
    m1y -= l1.g + m1spans[mi];
    let cy = m1y;
    for (const t of meld.tiles) {
      const rot = calledRot(meld, t, 270);
      const f = foot(m, rot);
      // keep called (sideways) tiles flush with this seat's edge
      melds.push({ id: t, x: r1x + tile.h - f.w, y: cy, rot, key: `m1-${melds.length}` });
      cy += f.h + 1;
    }
  });

  // -------------------------------------------------------------------------
  // 3. ponds — one per seat, against that seat's own edge
  // -------------------------------------------------------------------------
  const pondBoxes = {} as Record<SeatIndex, Rect>;
  // bottom: sits above the human's block; top: below the across hand
  pondBoxes[0] = {
    x: Math.round((W - rowSpan) / 2), y: bottomTop - gap * 2 - pondDepth, w: rowSpan, h: pondDepth,
  };
  pondBoxes[2] = { x: Math.round((W - rowSpan) / 2), y: t2y + tile.h + gap, w: rowSpan, h: pondDepth };
  // sides: centred in the felt left between the across hand and the human block
  const sideY = Math.round((sideMin + sideMax - rowSpan) / 2);
  pondBoxes[3] = { x: l3x + tile.h + gap, y: sideY, w: pondDepth, h: rowSpan };
  pondBoxes[1] = { x: r1x - gap - pondDepth, y: sideY, w: pondDepth, h: rowSpan };

  // the nominal (six-by-three) boxes never move, even when a long river grows
  // past them: the centre block is placed against these, so it never drifts
  const nominal: Record<SeatIndex, Rect> = {
    0: { ...pondBoxes[0] }, 1: { ...pondBoxes[1] },
    2: { ...pondBoxes[2] }, 3: { ...pondBoxes[3] },
  };

  const ponds = { 0: [], 1: [], 2: [], 3: [] } as Record<SeatIndex, PlacedTile[]>;
  for (const s of [0, 1, 2, 3] as SeatIndex[]) {
    const f = frameFor(s, pondBoxes[s]);
    const base = BASE_ROT[s];
    const river = view.seats[s].river;
    let du = 0;      // running offset along the seat's reading axis
    let row = 0;
    let inRow = 0;
    river.forEach((d, i) => {
      if (inRow === 6 && row < 2) { row += 1; inRow = 0; du = 0; }
      const rot = d.riichiDeclaration ? rot90(base) : base;
      // measured in the SEAT's own frame: a declaration tile lies sideways, so
      // it eats a tile-height of row and only a tile-width of depth
      const uLen = d.riichiDeclaration ? tile.h : tile.w;
      const vLen = d.riichiDeclaration ? tile.w : tile.h;
      const sideSeat = s === 1 || s === 3;
      const fw = sideSeat ? vLen : uLen;
      const fh = sideSeat ? uLen : vLen;
      const dv = row * (tile.h + seam) + Math.round((tile.h - vLen) / 2);
      const p = place(f, du, dv, fw, fh);
      ponds[s].push({
        id: d.tile,
        x: p.x,
        y: p.y,
        rot,
        dimmed: d.calledBy !== null,
        tsumogiri: d.tsumogiri,
        latest: view.lastDiscard !== null && view.lastDiscard.from === s && i === river.length - 1
          && d.calledBy === null,
        key: `p${s}-${i}`,
      });
      du += uLen + seam;
      inRow += 1;
    });
    // the last row may run past six tiles: grow the box so tests see the truth
    const grown = ponds[s].reduce((a, t) => {
      const fw = t.rot === 90 || t.rot === 270 ? tile.h : tile.w;
      const fh = t.rot === 90 || t.rot === 270 ? tile.w : tile.h;
      return {
        x0: Math.min(a.x0, t.x), y0: Math.min(a.y0, t.y),
        x1: Math.max(a.x1, t.x + fw), y1: Math.max(a.y1, t.y + fh),
      };
    }, { x0: pondBoxes[s].x, y0: pondBoxes[s].y, x1: pondBoxes[s].x + pondBoxes[s].w, y1: pondBoxes[s].y + pondBoxes[s].h });
    pondBoxes[s] = { x: grown.x0, y: grown.y0, w: grown.x1 - grown.x0, h: grown.y1 - grown.y0 };
  }

  // -------------------------------------------------------------------------
  // 4. riichi sticks — laid on the cloth between a pond and the centre
  // -------------------------------------------------------------------------
  const sticks: PlacedStick[] = [];
  const stickGap = 4;
  if (view.seats[0].riichi) {
    sticks.push({
      seat: 0, vertical: false,
      x: Math.round(nominal[0].x + (rowSpan - m.stick.w) / 2),
      y: nominal[0].y - stickGap - m.stick.h,
    });
  }
  if (view.seats[2].riichi) {
    sticks.push({
      seat: 2, vertical: false,
      x: Math.round(nominal[2].x + (rowSpan - m.stick.w) / 2),
      y: nominal[2].y + pondDepth + stickGap,
    });
  }
  if (view.seats[3].riichi) {
    sticks.push({
      seat: 3, vertical: true,
      x: nominal[3].x + pondDepth + stickGap,
      y: Math.round(nominal[3].y + (rowSpan - m.stick.w) / 2),
    });
  }
  if (view.seats[1].riichi) {
    sticks.push({
      seat: 1, vertical: true,
      x: nominal[1].x - stickGap - m.stick.h,
      y: Math.round(nominal[1].y + (rowSpan - m.stick.w) / 2),
    });
  }

  // -------------------------------------------------------------------------
  // 5. the centre block fills whatever rectangle is left in the middle
  // -------------------------------------------------------------------------
  const stickRoom = m.stick.h + stickGap * 2;
  const freeLeft = l3x + tile.h + gap + pondDepth + stickRoom;
  const freeRight = r1x - gap - pondDepth - stickRoom;
  const freeTop = nominal[2].y + pondDepth + stickRoom;
  const freeBottom = nominal[0].y - stickRoom;
  const availW = freeRight - freeLeft;
  const availH = freeBottom - freeTop;

  // dora tray: five slots, sized from the free width (label sits underneath)
  const trayPad = 4;
  const traySeam = 2;
  const doraW = clamp(Math.floor((availW - trayPad * 2 - traySeam * 4) / 5), 10, tile.w + 4);
  const doraH = Math.round(doraW * (tile.h / tile.w));
  const trayW = doraW * 5 + traySeam * 4 + trayPad * 2;
  const labelH = Math.max(9, Math.round(doraW * 0.62));
  const trayH = doraH + trayPad * 2 + labelH;
  const rowH = Math.max(12, Math.round(m.stick.h * 2.2));
  const cube = clamp(availH - trayH - rowH - 16, 34, m.cube);
  const centerW = Math.max(trayW, cube, Math.round(cube * 1.4));
  const centerH = trayH + 6 + cube + 6 + rowH;
  const center: CenterBlock = {
    x: Math.round(freeLeft + (availW - centerW) / 2),
    y: Math.round(freeTop + (availH - centerH) / 2),
    w: centerW,
    h: centerH,
    dora: { w: doraW, h: doraH },
    cube,
  };

  // snap everything to whole pixels (fractional origins blur tiles)
  const snap = (t: PlacedTile): PlacedTile => ({ ...t, x: Math.round(t.x), y: Math.round(t.y) });
  const snapRect = (r: Rect): Rect => ({
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h),
  });
  return {
    m,
    backs: backs.map(snap),
    ponds: { 0: ponds[0].map(snap), 1: ponds[1].map(snap), 2: ponds[2].map(snap), 3: ponds[3].map(snap) },
    melds: melds.map(snap),
    hand: hand.map(snap),
    handBox: snapRect(handBox),
    sticks: sticks.map((st) => ({ ...st, x: Math.round(st.x), y: Math.round(st.y) })),
    center,
    pondBoxes: {
      0: snapRect(pondBoxes[0]), 1: snapRect(pondBoxes[1]),
      2: snapRect(pondBoxes[2]), 3: snapRect(pondBoxes[3]),
    },
  };
}
