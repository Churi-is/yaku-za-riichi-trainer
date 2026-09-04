/** ScoreStrip — every seat's points across the top, in wind order. */
import type { PublicView, SeatIndex, Wind } from '@engine/types';
import { WIND_LETTER } from './SeatPlate';

const WIND_ORDER: Wind[] = ['east', 'south', 'west', 'north'];

export interface ScoreStripProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  tools?: React.ReactNode;
}

export default function ScoreStrip({ view, seatName, tools }: ScoreStripProps) {
  const seats = ([0, 1, 2, 3] as SeatIndex[])
    .slice()
    .sort((a, b) => WIND_ORDER.indexOf(view.seats[a].seatWind) - WIND_ORDER.indexOf(view.seats[b].seatWind));

  return (
    <header className="score-strip">
      <div className="score-plates">
        {seats.map((s) => {
          const seat = view.seats[s];
          const cls = [
            'score-plate',
            s === 0 ? 'you' : '',
            view.turn === s ? 'turn' : '',
            seat.riichi ? 'riichi' : '',
          ].filter(Boolean).join(' ');
          return (
            <div className={cls} key={s}>
              <div className="l1">
                <span className="wind">{WIND_LETTER[seat.seatWind]}</span>
                <span className="name">{s === 0 ? 'You' : seatName(s)}</span>
                <span className="marks">
                  {view.dealer === s && <span className="pill gold">親</span>}
                  {seat.riichi && <span className="pill red">リ</span>}
                </span>
              </div>
              <span className="pts">{seat.points.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      {tools && <div className="strip-tools">{tools}</div>}
    </header>
  );
}
