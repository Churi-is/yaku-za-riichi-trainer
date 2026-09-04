/** TableCenter — the middle of the table: dead wall dora tray, wind cube,
 *  honba/riichi sticks and the live wall count. */
import type { PublicView, Wind } from '@engine/types';
import Tile from './Tile';

const WIND_KANJI: Record<Wind, string> = { east: '東', south: '南', west: '西', north: '北' };
const WIND_LABEL: Record<Wind, string> = { east: 'East', south: 'South', west: 'West', north: 'North' };
const CORNERS: { wind: Wind; cls: string }[] = [
  { wind: 'east', cls: 'tl' }, { wind: 'south', cls: 'tr' },
  { wind: 'west', cls: 'br' }, { wind: 'north', cls: 'bl' },
];

export interface TableCenterProps {
  view: PublicView;
}

export default function TableCenter({ view }: TableCenterProps) {
  const indicators = view.doraIndicators;
  const hidden = Math.max(0, 5 - indicators.length);
  return (
    <div className="center-block">
      <div className="dora-tray" aria-label="dora indicators">
        <div className="dora-tiles">
          {indicators.map((id, i) => <Tile key={i} id={id} size="rv" />)}
          {Array.from({ length: hidden }).map((_, i) => <Tile key={`h${i}`} id={0} size="rv" faceDown />)}
        </div>
        <span className="lbl">Dora</span>
      </div>

      <div className="wind-cube" aria-label={`${WIND_LABEL[view.roundWind]} ${view.roundNumber}`}>
        {CORNERS.map((c) => (
          <span key={c.cls} className={`corner ${c.cls}${c.wind === view.roundWind ? ' on' : ''}`}>
            {WIND_KANJI[c.wind]}
          </span>
        ))}
        <span className="big">{WIND_KANJI[view.roundWind]}</span>
        <span className="rnd">{WIND_LABEL[view.roundWind]} {view.roundNumber}</span>
      </div>

      <div className="sticks-row">
        {view.honba > 0 && (
          <span className="stick-group" title={`honba ${view.honba}`}>
            {Array.from({ length: Math.min(view.honba, 4) }).map((_, i) => <span key={i} className="stick-honba" />)}
            {view.honba > 4 && <span className="n">×{view.honba}</span>}
          </span>
        )}
        {view.riichiSticks > 0 && (
          <span className="stick-group" title={`${view.riichiSticks} riichi sticks`}>
            {Array.from({ length: Math.min(view.riichiSticks, 4) }).map((_, i) => <span key={i} className="stick-riichi" />)}
            {view.riichiSticks > 4 && <span className="n">×{view.riichiSticks}</span>}
          </span>
        )}
        <span className="wall-count">{view.tilesRemaining} left</span>
      </div>
    </div>
  );
}
