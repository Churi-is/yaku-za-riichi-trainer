/**
 * YakuAdvisorPanel (Overlay A) — the yaku the hand can still reach, with the
 * measured reachability of each. Reads ONLY from the analysis module. Renders
 * nothing else: no tiles to keep or seek, no waits, no reference to which
 * tiles fit a yaku. Owned by D.
 *
 * Two modes, and the panel is explicit about which one produced the numbers,
 * because they answer different questions:
 *   quick — "reachable if you commit to it", your hand only;
 *   full  — "hands that finished this way", opponents included.
 */
import type { PublicView } from '@engine/types';
import { useYakuAdvisor } from '@ui/hooks/useYakuAdvisor';
import Tooltip from '@ui/components/Tooltip';
import { bandClass } from './bandClass';

export interface YakuAdvisorPanelProps {
  view: PublicView;
  open?: boolean;
  onToggleOpen?: () => void;
}

export default function YakuAdvisorPanel({ view, open = true, onToggleOpen }: YakuAdvisorPanelProps) {
  const { outcome, pending, progress } = useYakuAdvisor(view, open);
  const suggestions = outcome?.suggestions ?? [];
  const full = outcome?.mode === 'full';
  const summary = outcome?.summary;
  const pct = outcome && outcome.requested > 0
    ? Math.min(100, Math.round((progress / outcome.requested) * 100))
    : 0;

  return (
    <div className="overlay-panel">
      <button type="button" className="panel-head" onClick={onToggleOpen} aria-expanded={open}>
        <h4>
          Yaku Advisor
          <span className="estimate-tag">{full ? 'full games' : 'simulated'}</span>
          {pending && suggestions.length > 0 && <span className="sim-dot" aria-hidden="true" />}
        </h4>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="panel-body">
          {pending && full && (
            <div className="sim-progress" role="status" aria-label="Simulating full games">
              <div className="bar"><span style={{ width: `${pct}%` }} /></div>
              <span className="lab">{progress} / {outcome?.requested} hands played</span>
            </div>
          )}
          {summary && summary.runs > 0 && (
            <p className="sim-summary">
              Across {summary.runs} complete hands you won{' '}
              <strong>{Math.round((summary.wins / summary.runs) * 100)}%</strong>, dealt in{' '}
              {Math.round((summary.dealIns / summary.runs) * 100)}%, drew{' '}
              {Math.round((summary.draws / summary.runs) * 100)}%.
            </p>
          )}
          {suggestions.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              {pending
                ? 'Simulating the rest of the hand…'
                : full
                  ? 'You did not win any of the simulated hands from this position.'
                  : 'No yaku came out of the simulation — nothing here is realistically reachable yet.'}
            </p>
          ) : (
            <div>
              {suggestions.map((s, i) => (
                <div className="yaku-item" key={`${s.id}-${i}`}>
                  <span className="yaku-name">{s.name}</span>
                  <span className="yaku-han">{s.hanLabel} han</span>
                  <div className="yaku-def">{s.description}</div>
                  <div className="yaku-meter">
                    {/* In full-game mode a band word would lie: 10% of hands is
                        a big number there and a small one in quick mode. Show
                        the measurement and let the summary give it scale. */}
                    <span className={full ? 'band band-outcome' : bandClass(s.band)}>
                      {full
                        ? `~${s.approxPercent}% of hands`
                        : `${s.band}${typeof s.approxPercent === 'number' ? ` · ~${s.approxPercent}%` : ''}`}
                    </span>
                    {typeof s.hits === 'number' && typeof s.runs === 'number' && (
                      <span className="yaku-runs" title="successful runs out of simulated runs">
                        {s.hits}/{s.runs} runs
                      </span>
                    )}
                    <Tooltip content={s.methodNote} />
                  </div>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 10.5, marginTop: 8, marginBottom: 0 }}>
                {full
                  ? 'How often the hand actually finished this way, opponents included.'
                  : 'Reachability if you commit to it — not your chance of winning.'}
                {' '}Never tells you which tiles to keep or discard.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
