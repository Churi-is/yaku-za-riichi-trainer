/**
 * YakuAdvisorPanel (Overlay A) — the yaku the hand can still reach, with the
 * measured reachability of each. Reads ONLY from the analysis module. Renders
 * nothing else: no tiles to keep or seek, no waits, no reference to which
 * tiles fit a yaku. Owned by D.
 *
 * The percentage is a simulation result, so the raw sample is shown next to it
 * — "35% (21/60)" is an honest way to say "this is measured, and this is how
 * precisely". The tooltip carries the method.
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
  const { suggestions, pending } = useYakuAdvisor(view, open);

  return (
    <div className="overlay-panel">
      <button type="button" className="panel-head" onClick={onToggleOpen} aria-expanded={open}>
        <h4>
          Yaku Advisor <span className="estimate-tag">simulated</span>
          {pending && suggestions.length > 0 && <span className="sim-dot" aria-hidden="true" />}
        </h4>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="panel-body">
          {suggestions.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              {pending
                ? 'Simulating the rest of the hand…'
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
                    <span className={bandClass(s.band)}>
                      {s.band}
                      {typeof s.approxPercent === 'number' ? ` · ~${s.approxPercent}%` : ''}
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
                Reachability if you commit to it — not your chance of winning. Never tells you
                which tiles to keep or discard.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
