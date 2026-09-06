import { useState } from 'react';
import { DIFFICULTY_LABEL, personalityById, rosterDifficulty } from '@ai/personalities';
import { OPPONENT_POSITIONS, type OpponentSeat, type OpponentSeats } from '@state/opponents';

export const OPPONENT_DRAG_TYPE = 'application/x-riichi-opponent';

interface Props {
  opponents: OpponentSeats;
  activeSeat: OpponentSeat;
  onSelect: (seat: OpponentSeat) => void;
  onAssign: (seat: OpponentSeat, id: string) => void;
}

/** The same geometry as the match: seat 1 right, 2 across, 3 left, you below. */
export default function OpponentTable({ opponents, activeSeat, onSelect, onAssign }: Props) {
  const [dropSeat, setDropSeat] = useState<OpponentSeat | null>(null);
  return (
    <div className="seat-map" role="group" aria-label="Table seats">
      <div className="seat-map-felt" aria-hidden="true" />
      {OPPONENT_POSITIONS.map(({ seat, label, japanese }) => {
        const id = opponents[seat - 1];
        const p = id ? personalityById(id) : null;
        const category = p ? rosterDifficulty(p) : null;
        return (
          <button
            type="button"
            key={seat}
            className={`map-seat map-seat-${seat}${activeSeat === seat ? ' active' : ''}${dropSeat === seat ? ' drop-target' : ''}`}
            aria-label={`Edit ${label} seat: ${p ? `${p.name}, ${DIFFICULTY_LABEL[category!]}` : 'Empty'}`}
            aria-pressed={activeSeat === seat}
            onClick={() => onSelect(seat)}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(OPPONENT_DRAG_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropSeat(seat);
            }}
            onDragLeave={() => setDropSeat(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropSeat(null);
              const dragged = e.dataTransfer.getData(OPPONENT_DRAG_TYPE);
              if (dragged) onAssign(seat, dragged);
            }}
          >
            <span className="map-position"><span className="jp" aria-hidden="true">{japanese}</span> {label}</span>
            <strong>{p?.shortName ?? '+ Empty'}</strong>
            {p
              ? <span className={`level level-${category}`}>{DIFFICULTY_LABEL[category!]}</span>
              : <span className="map-empty-hint">Choose a bot</span>}
          </button>
        );
      })}
      <div className="map-center" aria-hidden="true">
        <span className="jp">麻雀</span>
        <span>YOUR TABLE</span>
        <i />
      </div>
      <div className="map-human">
        <span className="human-tiles" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <strong>You</strong>
        <span>Fixed seat</span>
      </div>
    </div>
  );
}
