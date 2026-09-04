/** HandEndBanner — result of a finished hand with the reveal. Owned by Worker D. */
import type { HandResult, SeatIndex } from '@engine/types';
import Tile from './Tile';
import { sortTiles } from '@ui/tiles';

export interface HandEndBannerProps {
  result: HandResult;
  roundLabel: string;
  seatName: (seat: SeatIndex) => string;
  onContinue: () => void;
  continueLabel: string;
}

export default function HandEndBanner({ result, roundLabel, seatName, onContinue, continueLabel }: HandEndBannerProps) {
  const { reason, winner, loser, score } = result;

  return (
    <div className="scrim">
      <div className="card handend-card stack">
        <div className="row spread">
          <h2 style={{ margin: 0 }}>
            {reason === 'tsumo' && `${seatName(winner!)} — Tsumo`}
            {reason === 'ron' && `${seatName(winner!)} — Ron`}
            {reason === 'exhaustiveDraw' && 'Exhaustive Draw'}
          </h2>
          <span className="pill">{roundLabel}</span>
        </div>

        {reason !== 'exhaustiveDraw' && score && (
          <div className="stack" style={{ gap: 4 }}>
            {loser !== null && <div className="muted">Dealt in by {seatName(loser)}</div>}
            <div className="yaku-list">
              {score.yaku.map((y) => (
                <div className="score-line" key={y.id}>
                  <span>{y.name}</span>
                  <span className="muted">{y.yakuman ? 'Yakuman' : `${y.han} han`}</span>
                </div>
              ))}
              {score.dora > 0 && <div className="score-line"><span>Dora</span><span className="muted">{score.dora}</span></div>}
              {score.akaDora > 0 && <div className="score-line"><span>Red fives</span><span className="muted">{score.akaDora}</span></div>}
              {score.uraDora > 0 && <div className="score-line"><span>Ura dora</span><span className="muted">{score.uraDora}</span></div>}
            </div>
            <div className="score-line" style={{ fontWeight: 700, borderTop: '1px solid var(--panel-border)', paddingTop: 6 }}>
              <span>{score.limitName ? score.limitName.toUpperCase() : `${score.han} han ${score.fu} fu`}</span>
              <span className="accent" style={{ color: 'var(--accent)' }}>{score.points.toLocaleString()} pts</span>
            </div>
          </div>
        )}

        {reason === 'exhaustiveDraw' && (
          <div className="muted">
            Tenpai: {result.tenpaiSeats.length ? result.tenpaiSeats.map(seatName).join(', ') : 'nobody'}
          </div>
        )}

        <div>
          <h4>Reveal</h4>
          <div className="reveal-grid">
            {([0, 1, 2, 3] as SeatIndex[]).map((s) => (
              <div className="reveal-seat" key={s}>
                <strong>{seatName(s)}</strong>{' '}
                <span className="muted" style={{ fontSize: 12 }}>
                  {result.deltas[s] >= 0 ? '+' : ''}{result.deltas[s].toLocaleString()}
                </span>
                <div className="reveal-tiles">
                  {sortTiles(result.revealedHands[s] ?? []).map((t, i) => <Tile key={i} id={t} size="xs" />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={onContinue}>{continueLabel}</button>
      </div>
    </div>
  );
}
