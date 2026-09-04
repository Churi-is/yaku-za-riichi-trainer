/** ScoreBoard — round, honba, riichi sticks, seat/round winds. Owned by Worker D. */
import type { PublicView } from '@engine/types';

export interface ScoreBoardProps {
  view: PublicView;
}

export default function ScoreBoard({ view }: ScoreBoardProps) {
  const wind = view.roundWind[0].toUpperCase() + view.roundWind.slice(1);
  return (
    <div className="round-badge">
      <div className="big">{wind} {view.roundNumber}</div>
      <div className="sticks">
        Honba {view.honba} · Sticks {view.riichiSticks}
      </div>
    </div>
  );
}
