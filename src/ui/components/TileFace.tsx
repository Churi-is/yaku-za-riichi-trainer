/**
 * TileFace — hand-drawn SVG tile art (man kanji, pin circles, sou bamboo,
 * honors). Rendering the faces as vectors keeps them crisp at every tile size
 * on the board and in the hand, and reads far more like a real set than a
 * glyph in a box. Owned by Worker D.
 */
import type { TileId } from '@engine/types';
import { decodeTile, isRedFiveId } from '@ui/tiles';

const INK = '#232733';
const BLUE = '#1d5aa8';
const GREEN = '#1e7a46';
const RED = '#bf2b30';
const IVORY = '#f6f1e2';

const NUM_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

interface Dot { x: number; y: number; r: number; c: string }

const PIN: Record<number, Dot[]> = {
  2: [{ x: 30, y: 26, r: 9, c: GREEN }, { x: 30, y: 58, r: 9, c: BLUE }],
  3: [{ x: 18, y: 24, r: 8, c: BLUE }, { x: 30, y: 42, r: 8, c: GREEN }, { x: 42, y: 60, r: 8, c: RED }],
  4: [{ x: 20, y: 26, r: 8, c: BLUE }, { x: 40, y: 26, r: 8, c: GREEN }, { x: 20, y: 58, r: 8, c: GREEN }, { x: 40, y: 58, r: 8, c: BLUE }],
  5: [{ x: 18, y: 24, r: 7.5, c: BLUE }, { x: 42, y: 24, r: 7.5, c: GREEN }, { x: 30, y: 42, r: 7.5, c: RED }, { x: 18, y: 60, r: 7.5, c: GREEN }, { x: 42, y: 60, r: 7.5, c: BLUE }],
  6: [{ x: 21, y: 22, r: 7, c: GREEN }, { x: 39, y: 22, r: 7, c: GREEN }, { x: 21, y: 42, r: 7, c: RED }, { x: 39, y: 42, r: 7, c: RED }, { x: 21, y: 62, r: 7, c: RED }, { x: 39, y: 62, r: 7, c: RED }],
  7: [{ x: 16, y: 18, r: 6.5, c: GREEN }, { x: 30, y: 24, r: 6.5, c: GREEN }, { x: 44, y: 30, r: 6.5, c: GREEN }, { x: 21, y: 50, r: 6.5, c: RED }, { x: 39, y: 50, r: 6.5, c: RED }, { x: 21, y: 68, r: 6.5, c: RED }, { x: 39, y: 68, r: 6.5, c: RED }],
  8: [{ x: 21, y: 16, r: 6, c: BLUE }, { x: 39, y: 16, r: 6, c: BLUE }, { x: 21, y: 33, r: 6, c: BLUE }, { x: 39, y: 33, r: 6, c: BLUE }, { x: 21, y: 51, r: 6, c: BLUE }, { x: 39, y: 51, r: 6, c: BLUE }, { x: 21, y: 68, r: 6, c: BLUE }, { x: 39, y: 68, r: 6, c: BLUE }],
  9: [{ x: 17, y: 20, r: 6, c: RED }, { x: 30, y: 20, r: 6, c: RED }, { x: 43, y: 20, r: 6, c: RED }, { x: 17, y: 42, r: 6, c: GREEN }, { x: 30, y: 42, r: 6, c: GREEN }, { x: 43, y: 42, r: 6, c: GREEN }, { x: 17, y: 64, r: 6, c: BLUE }, { x: 30, y: 64, r: 6, c: BLUE }, { x: 43, y: 64, r: 6, c: BLUE }],
};

interface Stick { x: number; y: number; c: string; h?: number }

const SOU: Record<number, Stick[]> = {
  2: [{ x: 30, y: 26, c: GREEN }, { x: 30, y: 58, c: BLUE }],
  3: [{ x: 30, y: 24, c: BLUE }, { x: 20, y: 58, c: GREEN }, { x: 40, y: 58, c: GREEN }],
  4: [{ x: 21, y: 26, c: BLUE }, { x: 39, y: 26, c: GREEN }, { x: 21, y: 58, c: GREEN }, { x: 39, y: 58, c: BLUE }],
  5: [{ x: 18, y: 24, c: BLUE }, { x: 42, y: 24, c: GREEN }, { x: 30, y: 42, c: RED }, { x: 18, y: 60, c: GREEN }, { x: 42, y: 60, c: BLUE }],
  6: [{ x: 17, y: 24, c: GREEN }, { x: 30, y: 24, c: GREEN }, { x: 43, y: 24, c: GREEN }, { x: 17, y: 60, c: GREEN }, { x: 30, y: 60, c: GREEN }, { x: 43, y: 60, c: GREEN }],
  7: [{ x: 30, y: 18, c: RED, h: 16 }, { x: 17, y: 44, c: GREEN, h: 16 }, { x: 30, y: 44, c: GREEN, h: 16 }, { x: 43, y: 44, c: GREEN, h: 16 }, { x: 17, y: 68, c: GREEN, h: 16 }, { x: 30, y: 68, c: GREEN, h: 16 }, { x: 43, y: 68, c: GREEN, h: 16 }],
  8: [{ x: 15, y: 26, c: GREEN, h: 17 }, { x: 25, y: 26, c: GREEN, h: 17 }, { x: 35, y: 26, c: GREEN, h: 17 }, { x: 45, y: 26, c: GREEN, h: 17 }, { x: 15, y: 58, c: GREEN, h: 17 }, { x: 25, y: 58, c: GREEN, h: 17 }, { x: 35, y: 58, c: GREEN, h: 17 }, { x: 45, y: 58, c: GREEN, h: 17 }],
  9: [{ x: 17, y: 20, c: RED, h: 15 }, { x: 30, y: 20, c: RED, h: 15 }, { x: 43, y: 20, c: RED, h: 15 }, { x: 17, y: 42, c: GREEN, h: 15 }, { x: 30, y: 42, c: GREEN, h: 15 }, { x: 43, y: 42, c: GREEN, h: 15 }, { x: 17, y: 64, c: BLUE, h: 15 }, { x: 30, y: 64, c: BLUE, h: 15 }, { x: 43, y: 64, c: BLUE, h: 15 }],
};

function PinDot({ d }: { d: Dot }) {
  return (
    <g>
      <circle cx={d.x} cy={d.y} r={d.r} fill={d.c} />
      <circle cx={d.x} cy={d.y} r={d.r * 0.62} fill={IVORY} />
      <circle cx={d.x} cy={d.y} r={d.r * 0.3} fill={d.c} />
    </g>
  );
}

function Bamboo({ s }: { s: Stick }) {
  const h = s.h ?? 20;
  const w = 7;
  return (
    <g>
      <rect x={s.x - w / 2} y={s.y - h / 2} width={w} height={h} rx={w / 2} fill={s.c} />
      <rect x={s.x - w / 2} y={s.y - 1.5} width={w} height={3} fill="rgba(0,0,0,0.28)" />
      <rect x={s.x - 1} y={s.y - h / 2 + 2} width={2} height={h - 4} rx={1} fill="rgba(255,255,255,0.28)" />
    </g>
  );
}

function Bird() {
  return (
    <g>
      <path d="M24 56 L14 70 M26 58 L22 72 M30 58 L30 72" stroke={BLUE} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <ellipse cx="31" cy="45" rx="11" ry="13" fill={GREEN} />
      <path d="M24 42 Q34 34 40 44 Q33 50 24 46 Z" fill={RED} opacity="0.9" />
      <circle cx="36" cy="27" r="6.4" fill={GREEN} />
      <path d="M42 25 L50 28 L42 31 Z" fill={RED} />
      <circle cx="37.5" cy="25.5" r="1.5" fill={IVORY} />
    </g>
  );
}

export interface TileFaceProps {
  id: TileId;
}

export default function TileFace({ id }: TileFaceProps) {
  const { suit, rank } = decodeTile(id);
  const red = isRedFiveId(id);
  let art: React.ReactNode = null;

  if (suit === 'm') {
    const num = red ? RED : INK;
    art = (
      <>
        <text x="30" y="37" textAnchor="middle" fontSize="31" fontWeight="700" fill={num} style={{ fontFamily: 'var(--font-jp)' }}>{NUM_KANJI[rank - 1]}</text>
        <text x="30" y="72" textAnchor="middle" fontSize="31" fontWeight="700" fill={red ? RED : '#b3282d'} style={{ fontFamily: 'var(--font-jp)' }}>萬</text>
      </>
    );
  } else if (suit === 'p') {
    if (rank === 1) {
      art = (
        <g>
          <circle cx="30" cy="42" r="16" fill={red ? RED : BLUE} />
          <circle cx="30" cy="42" r="12" fill={IVORY} />
          <circle cx="30" cy="42" r="8.5" fill={red ? RED : GREEN} />
          <circle cx="30" cy="42" r="4.6" fill={IVORY} />
          <circle cx="30" cy="42" r="2.4" fill={red ? RED : RED} />
        </g>
      );
    } else {
      const dots = PIN[rank].map((d) => (red ? { ...d, c: RED } : d));
      art = <>{dots.map((d, i) => <PinDot key={i} d={d} />)}</>;
    }
  } else if (suit === 's') {
    if (rank === 1) art = <Bird />;
    else {
      const sticks = SOU[rank].map((s) => (red ? { ...s, c: RED } : s));
      art = <>{sticks.map((s, i) => <Bamboo key={i} s={s} />)}</>;
    }
  } else if (rank <= 4) {
    art = <text x="30" y="56" textAnchor="middle" fontSize="42" fontWeight="700" fill={INK} style={{ fontFamily: 'var(--font-jp)' }}>{['東', '南', '西', '北'][rank - 1]}</text>;
  } else if (rank === 5) {
    art = (
      <g fill="none" stroke="#7fa6c9">
        <rect x="10" y="12" width="40" height="60" strokeWidth="3.4" rx="2" />
        <rect x="16" y="18" width="28" height="48" strokeWidth="1.6" rx="1" />
      </g>
    );
  } else if (rank === 6) {
    art = <text x="30" y="56" textAnchor="middle" fontSize="42" fontWeight="700" fill={GREEN} style={{ fontFamily: 'var(--font-jp)' }}>發</text>;
  } else {
    art = <text x="30" y="56" textAnchor="middle" fontSize="42" fontWeight="700" fill={RED} style={{ fontFamily: 'var(--font-jp)' }}>中</text>;
  }

  return (
    <svg viewBox="0 0 60 84" aria-hidden="true" focusable="false">
      {art}
    </svg>
  );
}
