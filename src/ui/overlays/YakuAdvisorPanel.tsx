/**
 * YakuAdvisorPanel (Overlay A) — top 5 yaku with name, han, definition, band.
 * Reads ONLY from @analysis (via the adapter). Renders nothing else: no tiles
 * to keep/seek, no waits, no reference to which tiles fit a yaku. Owned by D.
 */
import type { PublicView } from '@engine/types';
import { suggestYaku } from '@state/analysisAdapter';
import Tooltip from '@ui/components/Tooltip';
import { bandClass } from './bandClass';

export interface YakuAdvisorPanelProps {
  view: PublicView;
  open?: boolean;
  onToggleOpen?: () => void;
}

export default function YakuAdvisorPanel({ view, open = true, onToggleOpen }: YakuAdvisorPanelProps) {
  const suggestions = suggestYaku(view).slice(0, 5);

  return (
    <div className="overlay-panel">
      <button type="button" className="panel-head" onClick={onToggleOpen} aria-expanded={open}>
        <h4>Yaku Advisor <span className="estimate-tag">estimate</span></h4>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="panel-body">
          {suggestions.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              No clear direction yet — keep your options open.
            </p>
          ) : (
            <div>
              {suggestions.map((s, i) => (
                <div className="yaku-item" key={`${s.id}-${i}`}>
                  <span className="yaku-name">{s.name}</span>
                  <span className="yaku-han">{s.hanLabel} han</span>
                  <div className="yaku-def">{s.description}</div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span className={bandClass(s.band)}>
                      {s.band}{typeof s.approxPercent === 'number' ? ` · ~${s.approxPercent}%` : ''}
                    </span>
                    <Tooltip content={s.methodNote} />
                  </div>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 10.5, marginTop: 8, marginBottom: 0 }}>
                Definitions and likelihoods only. This panel never tells you which tiles to keep or discard.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
