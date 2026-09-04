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
  /** Sideways ('left'/'right') or flat ('top'/'bottom') seat rendering. */
  orientation?: 'top' | 'bottom' | 'left' | 'right';
  /** Dense chip frame for the mobile skeletons (backs ladder §5.5). */
  compact?: boolean;
}

export default function SeatInfo({
  seat, personalityName, isTurn, isDealer, thinking, orientation = 'bottom', compact = false,
}: SeatInfoProps) {
  const backs = Math.min(seat.concealedCount, 13);
  const side = orientation === 'left' || orientation === 'right' ? orientation : undefined;
  const cls = [
    'opp',
    compact ? 'opp-compact' : '',
    isTurn ? 'turn' : '',
    seat.riichi ? 'riichi' : '',
    side ? `opp-side opp-side-${side}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className="opp-name">
        {personalityName} {isDealer && <span className="pill" style={{ fontSize: 10 }}>Dealer</span>}
      </div>
      <div className="opp-meta">
        Seat {WIND_LABEL[seat.seatWind]} · {seat.points.toLocaleString()} pts
        {seat.riichi && <span style={{ color: 'var(--accent-red)' }}> · RIICHI</span>}
        {thinking && isTurn && <span> · thinking…</span>}
      </div>
      <div className="opp-backs" aria-label={`${backs} concealed tiles`}>
        {compact ? (
          <>
            <div className="backs-grid mini">
              {Array.from({ length: backs }).map((_, i) => (
                <Tile key={i} id={0} size="xxs" faceDown orientation={side ?? 'upright'} />
              ))}
            </div>
            {backs > 0 && <span className="backs-count">{backs}</span>}
          </>
        ) : (
          Array.from({ length: backs }).map((_, i) => (
            <Tile key={i} id={0} size="xs" faceDown />
          ))
        )}
      </div>
      <MeldArea melds={seat.melds} size="xs" orientation={side ?? 'upright'} />
    </div>
  );
}

export function seatIndexOf(seat: PublicSeatView): SeatIndex {
  return seat.seat;
}
