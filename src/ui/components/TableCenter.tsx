/**
 * TableCenter — the middle of the table: the dead-wall dora tray, the round
 * cube (which doubles as the "whose turn is it" compass), the honba/riichi
 * sticks and the live wall count.
 *
 * Every size comes from the layout model so the block always fits the free
 * rectangle between the four ponds — nothing here is content-sized, so it can
 * never grow into a river.
 */
import type { CSSProperties } from 'react';
import type { PublicView, SeatIndex, Wind } from '@engine/types';
import type { CenterBlock } from '@ui/table/layout';
import Tile from './Tile';

const WIND_KANJI: Record<Wind, string> = { east: '東', south: '南', west: '西', north: '北' };
const WIND_LABEL: Record<Wind, string> = { east: 'East', south: 'South', west: 'West', north: 'North' };

/** where each seat sits on screen, relative to the viewer at the bottom */
const SEAT_POS: { seat: SeatIndex; cls: string }[] = [
  { seat: 0, cls: 'b' }, { seat: 1, cls: 'r' }, { seat: 2, cls: 't' }, { seat: 3, cls: 'l' },
];

interface TableCenterProps {
  view: PublicView;
  center: CenterBlock;
  /** an opponent is deciding right now */
  thinking?: boolean;
}

export default function TableCenter({ view, center, thinking = false }: TableCenterProps) {
  const indicators = view.doraIndicators;
  const hidden = Math.max(0, 5 - indicators.length);
  const slot: CSSProperties = { '--tw': `${center.dora.w}px`, '--th': `${center.dora.h}px` } as CSSProperties;

  return (
    <div
      className="center-block"
      style={{ width: center.w, height: center.h, '--cube': `${center.cube}px` } as CSSProperties}
    >
      <div className="dora-tray" aria-label={`${indicators.length} dora indicator${indicators.length === 1 ? '' : 's'}`}>
        <div className="dora-slots">
          {indicators.map((id, i) => <Tile key={i} id={id} size="rv" style={slot} />)}
          {Array.from({ length: hidden }).map((_, i) => (
            <Tile key={`h${i}`} id={0} size="rv" faceDown style={slot} />
          ))}
        </div>
        <span className="dora-label">Dora</span>
      </div>

      <div
        className="wind-cube"
        aria-label={`Round ${WIND_LABEL[view.roundWind]} ${view.roundNumber}, ${view.turn === 0 ? 'your turn' : 'opponent to act'}`}
      >
        {SEAT_POS.map((p) => {
          const seat = view.seats[p.seat];
          const on = view.turn === p.seat;
          return (
            <span
              key={p.cls}
              className={[
                'seat-mark', p.cls,
                on ? 'on' : '',
                view.dealer === p.seat ? 'dealer' : '',
                seat.riichi ? 'riichi' : '',
                on && thinking ? 'thinking' : '',
              ].filter(Boolean).join(' ')}
            >
              {WIND_KANJI[seat.seatWind]}
            </span>
          );
        })}
        <span className="big">{WIND_KANJI[view.roundWind]}</span>
        <span className="rnd">{view.roundNumber}</span>
      </div>

      <div className="sticks-row">
        {view.honba > 0 && (
          <span className="stick-group" title={`${view.honba} honba`}>
            <span className="stick-honba" />
            <span className="n">{view.honba}</span>
          </span>
        )}
        {view.riichiSticks > 0 && (
          <span className="stick-group" title={`${view.riichiSticks} riichi stick${view.riichiSticks === 1 ? '' : 's'}`}>
            <span className="stick-riichi" />
            <span className="n">{view.riichiSticks}</span>
          </span>
        )}
        <span
          className="wall-count"
          role="img"
          aria-label={`${view.tilesRemaining} tiles left in the live wall`}
          title={`${view.tilesRemaining} tiles left in the live wall`}
        >
          <span className="wall-kanji jp" aria-hidden="true">残</span>{view.tilesRemaining}
        </span>
      </div>
    </div>
  );
}
