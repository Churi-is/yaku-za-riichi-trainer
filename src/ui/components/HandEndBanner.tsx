/** HandEndBanner — result of a finished hand with the reveal. */
import type { HandResult, Meld, SeatIndex } from '@engine/types';
import Tile from './Tile';
import { sortTiles } from '@ui/tiles';
import { useFocusTrap } from '@ui/hooks/useFocusTrap';

interface HandEndBannerProps {
  result: HandResult;
  roundLabel: string;
  seatName: (seat: SeatIndex) => string;
  onContinue: () => void;
  continueLabel: string;
  /** Public called sets per seat, so the reveal shows complete hands. */
  meldsOf?: (seat: SeatIndex) => Meld[];
}

const LIMIT_LABELS: Record<string, string> = {
  mangan: 'Mangan',
  haneman: 'Haneman',
  baiman: 'Baiman',
  sanbaiman: 'Sanbaiman',
  yakuman: 'Yakuman',
  doubleYakuman: 'Double yakuman',
  tripleYakuman: 'Triple yakuman',
};

function limitLabel(limitName: string, han: number, fu: number): string {
  return limitName ? LIMIT_LABELS[limitName] ?? limitName.toUpperCase() : `${han} han ${fu} fu`;
}

export default function HandEndBanner({ result, roundLabel, seatName, onContinue, continueLabel, meldsOf }: HandEndBannerProps) {
  const { reason, winner, loser, score } = result;
  const cardRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <div className="scrim">
      <div
        className="card handend-card stack"
        role="dialog"
        aria-modal="true"
        aria-label="Hand result"
        ref={cardRef}
        tabIndex={-1}
      >
        <div className="row spread">
          <h2 style={{ margin: 0 }}>
            {reason === 'tsumo' && `${seatName(winner!)} — Tsumo`}
            {reason === 'ron' && `${seatName(winner!)} — Ron`}
            {reason === 'exhaustiveDraw' && 'Exhaustive Draw'}
          </h2>
          <span className="pill gold">{roundLabel}</span>
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
              <span>{limitLabel(score.limitName, score.han, score.fu)}</span>
              <span style={{ color: 'var(--gold)' }}>{score.points.toLocaleString()} pts</span>
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
          <div className="reveal-table">
            {([0, 1, 2, 3] as SeatIndex[]).map((s) => (
              <div className={`reveal-seat${winner === s ? ' winner' : ''}`} key={s}>
                <span className="who">{seatName(s)}</span>
                <span className="delta">
                  {result.deltas[s] >= 0 ? '+' : ''}{result.deltas[s].toLocaleString()}
                </span>
                <div className="reveal-tiles">
                  {sortTiles(result.revealedHands[s] ?? []).map((t, i) => <Tile key={i} id={t} size="xs" />)}
                  {(meldsOf?.(s) ?? []).map((m, mi) => (
                    <span className="reveal-meld" key={`m${mi}`}>
                      {m.tiles.map((t, j) => <Tile key={j} id={t} size="xs" />)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary handend-continue" onClick={onContinue}>{continueLabel}</button>
      </div>
    </div>
  );
}
