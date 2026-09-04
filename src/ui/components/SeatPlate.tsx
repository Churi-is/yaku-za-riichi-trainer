/** SeatPlate — a compact name/wind/status plate on the felt. */
import type { PublicSeatView, Wind } from '@engine/types';

export const WIND_KANJI: Record<Wind, string> = { east: '東', south: '南', west: '西', north: '北' };
export const WIND_LETTER: Record<Wind, string> = { east: 'E', south: 'S', west: 'W', north: 'N' };

export interface SeatPlateProps {
  seat: PublicSeatView;
  name: string;
  isTurn: boolean;
  isDealer: boolean;
  thinking?: boolean;
  /** Vertical writing for the side seats. */
  vertical?: boolean;
}

export default function SeatPlate({ seat, name, isTurn, isDealer, thinking, vertical }: SeatPlateProps) {
  const cls = [
    'seat-plate',
    isTurn ? 'turn' : '',
    seat.riichi ? 'riichi' : '',
    vertical ? 'plate-v' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <span className="wd">{WIND_KANJI[seat.seatWind]}</span>
      <span className="nm">{name}</span>
      {isDealer && <span className="st" title="dealer">親</span>}
      {seat.riichi && <span className="st" style={{ color: 'var(--red-hi)' }} title="riichi">リ</span>}
      {thinking && isTurn && <span className="st">…</span>}
    </div>
  );
}
