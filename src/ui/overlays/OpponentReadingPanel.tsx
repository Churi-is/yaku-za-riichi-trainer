/**
 * OpponentReadingPanel (Overlay B) — per-opponent hand direction, river cues,
 * threat state, and Low/Medium/High deal-in risk, all probabilistic, each with
 * a "why" tooltip. Reads ONLY from @analysis. Owned by Worker D.
 */
import type { PublicView, SeatIndex } from '@engine/types';
import { readOpponents } from '@state/analysisAdapter';
import Tooltip from '@ui/components/Tooltip';

export interface OpponentReadingPanelProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  open?: boolean;
  onToggleOpen?: () => void;
}

export default function OpponentReadingPanel({ view, seatName, open = true, onToggleOpen }: OpponentReadingPanelProps) {
  const reads = readOpponents(view);

  return (
    <div className="overlay-panel">
      <button type="button" className="panel-head" onClick={onToggleOpen} aria-expanded={open}>
        <h4>Opponent Reads <span className="estimate-tag">estimate</span></h4>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="panel-body">
          {reads.map((r) => (
            <div className="read-seat" key={r.seat}>
              <div className="read-head">
                <strong>{seatName(r.seat)}</strong>
                <span className={`risk risk-${r.dealInRisk}`}>
                  {r.dealInRisk} risk
                  {' '}<Tooltip content={r.dealInRiskWhy} label="?" />
                </span>
              </div>
              <div className="muted" style={{ fontSize: 11.5, margin: '2px 0' }}>
                {r.threat.riichi ? '● Riichi' : r.threat.likelyTenpai ? '◐ Likely tenpai' : '○ Building'} — {r.threat.note}
              </div>
              {r.handDirection.map((sig, i) => (
                <div className="signal" key={`d${i}`}>
                  <span className="dot">▸</span>
                  <span>{sig.text} <Tooltip content={sig.why} /></span>
                </div>
              ))}
              {r.riverCues.map((sig, i) => (
                <div className="signal" key={`c${i}`}>
                  <span className="dot">·</span>
                  <span>{sig.text} <Tooltip content={sig.why} /></span>
                </div>
              ))}
              {r.handDirection.length === 0 && r.riverCues.length === 0 && (
                <div className="muted" style={{ fontSize: 11.5 }}>No strong tells yet.</div>
              )}
            </div>
          ))}
          <p className="muted" style={{ fontSize: 10.5, marginTop: 6, marginBottom: 0 }}>
            All reads are probabilistic inferences from public info (melds, rivers, riichi).
          </p>
        </div>
      )}
    </div>
  );
}
