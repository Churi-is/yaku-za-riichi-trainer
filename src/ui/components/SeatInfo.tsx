/** SeatInfo — an opponent seat: name, wind, points, tile backs, melds. Owned by Worker D. */
import type { PublicSeatView, SeatIndex, Wind } from '@engine/types';
import Tile from './Tile';
import MeldArea from './MeldArea';

const WIND_LABEL: Record<Wind, string> = { east: 'E', south: 'S', west: 'W', north: 'N' };

export interface SeatInfoProps {
  seat: PublicSeatView;
  personalityName: string;
  isTurn: boolean;
  isDealer: boolean;
  thinking?: boolean;
}

export default function SeatInfo({ seat, personalityName, isTurn, isDealer, thinking }: SeatInfoProps) {
  const backs = Math.min(seat.concealedCount, 13);
  return (
    <div className={`opp${isTurn ? ' turn' : ''}${seat.riichi ? ' riichi' : ''}`}>
      <div className="opp-name">
        {personalityName} {isDealer && <span className="pill" style={{ fontSize: 10 }}>Dealer</span>}
      </div>
      <div className="opp-meta">
        Seat {WIND_LABEL[seat.seatWind]} · {seat.points.toLocaleString()} pts
        {seat.riichi && <span style={{ color: 'var(--accent-red)' }}> · RIICHI</span>}
        {thinking && isTurn && <span> · thinking…</span>}
      </div>
      <div className="opp-backs" aria-label={`${backs} concealed tiles`}>
        {Array.from({ length: backs }).map((_, i) => <Tile key={i} id={0} size="xs" faceDown />)}
      </div>
      <MeldArea melds={seat.melds} size="xs" />
    </div>
  );
}

export function seatIndexOf(seat: PublicSeatView): SeatIndex {
  return seat.seat;
}
