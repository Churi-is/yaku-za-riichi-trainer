/** ScoreStrip — every seat's points across the top, in turn (wind) order. */
import type { PublicView, SeatIndex, Wind } from '@engine/types';
import { PERSONALITIES } from '@ai/personalities';
import { specialStatus } from '@ai/specialStyles';
import { WIND_LETTER } from './SeatPlate';

const WIND_ORDER: Wind[] = ['east', 'south', 'west', 'north'];

/** where each seat sits relative to the viewer, so the strip maps to the felt */
const POSITION: Record<SeatIndex, { glyph: string; title: string }> = {
  0: { glyph: '▼', title: 'you (bottom)' },
  1: { glyph: '▶', title: 'right' },
  2: { glyph: '▲', title: 'across' },
  3: { glyph: '◀', title: 'left' },
};

export interface ScoreStripProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  tools?: React.ReactNode;
}

/** Fallback for unnamed/custom seats; roster characters have explicit short names. */
function shortName(name: string): string {
  const first = name.split(/\s+/)[0];
  return first.length >= 3 ? first : name;
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
          const personality = s === 0 ? null : PERSONALITIES.find((p) => p.id === seat.aiPersonalityId);
          const status = personality?.special ? specialStatus(personality.special.style, seat) : null;
          const cls = [
            'score-plate',
            s === 0 ? 'you' : '',
            view.turn === s ? 'turn' : '',
            seat.riichi ? 'riichi' : '',
          ].filter(Boolean).join(' ');
          return (
            <div className={cls} key={s}>
              <div className="l1">
                <span className="wind" title={`${seat.seatWind} seat`}>{WIND_LETTER[seat.seatWind]}</span>
                <span className="name" title={s === 0 ? 'You' : seatName(s)}>
                  {s === 0 ? 'You' : personality?.shortName ?? shortName(seatName(s))}
                </span>
                <span className="pos" aria-hidden="true" title={POSITION[s].title}>{POSITION[s].glyph}</span>
              </div>
              <div className="l2">
                <span className="pts">{seat.points.toLocaleString()}</span>
                <span className="marks">
                  {view.dealer === s && <span className="mark dealer" title="dealer">親</span>}
                  {seat.riichi && <span className="mark riichi" title="riichi declared">リ</span>}
                </span>
              </div>
              {status && <div className="special-bot-status" aria-label={`${personality!.name}: ${status}`}
                title={`${personality!.special!.rule}. Estimated difficulty: ${personality!.special!.estimatedDifficulty}`}>
                {status}
              </div>}
            </div>
          );
        })}
      </div>
      {tools && <div className="strip-tools">{tools}</div>}
    </header>
  );
}
