/** PauseMenu — mid-match menu; overlay toggles, simulation depth, table legend. */
import { SIM_DEPTHS, useSession, type OverlayToggles, type SimDepth } from '@state/session';
import { formatDuration } from '@ui/hooks/useYakuAdvisor';

export interface PauseMenuProps {
  onResume: () => void;
  onQuitToMenu: () => void;
}

const OVERLAY_LABELS: Record<keyof OverlayToggles, string> = {
  yakuAdvisor: 'Yaku advisor',
  opponentReading: 'Opponent reading',
  waitGuessing: 'Wait guessing',
  waitPracticeMode: 'Wait practice mode',
};

export default function PauseMenu({ onResume, onQuitToMenu }: PauseMenuProps) {
  const overlays = useSession((s) => s.overlays);
  const toggle = useSession((s) => s.toggleOverlay);
  const settings = useSession((s) => s.settings);
  const sim = useSession((s) => s.sim);
  const simCost = useSession((s) => s.simCost);
  const setSim = useSession((s) => s.setSim);

  // Estimates come from what this device has actually managed, not from a
  // constant: every completed run folds its real cost back into simCost.
  const costOf = (depth: SimDepth, full = sim.fullGame) =>
    formatDuration((full ? simCost.full : simCost.quick) * depth);

  return (
    <div className="modal-backdrop" onClick={onResume}>
      <div className="modal card stack" onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ margin: 0 }}>
          <h2 style={{ margin: 0 }}>Paused<span className="kan jp" style={{ color: 'var(--gold-dim)', fontSize: '0.7em', marginLeft: 8 }}>休憩</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={onResume}>✕</button>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h4 style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>Overlays</h4>
          {(Object.keys(OVERLAY_LABELS) as (keyof OverlayToggles)[]).map((k) => (
            <div className="setting-row" key={k} style={{ padding: '6px 0' }}>
              <span className="lab">{OVERLAY_LABELS[k]}</span>
              <button
                type="button"
                className={`toggle${overlays[k] ? ' on' : ''}`}
                role="switch"
                aria-checked={overlays[k]}
                aria-label={OVERLAY_LABELS[k]}
                onClick={() => toggle(k)}
              >
                <span className="knob" />
              </button>
            </div>
          ))}
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h4 style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Simulation
          </h4>
          <div className="setting-row seg-row" style={{ padding: '4px 0' }}>
            <span className="lab">
              Depth
              <small className="sub">Runs per yaku. More runs, steadier numbers.</small>
            </span>
            <div className="seg" role="group" aria-label="Simulation depth">
              {SIM_DEPTHS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={sim.depth === d ? 'on' : ''}
                  aria-pressed={sim.depth === d}
                  onClick={() => setSim({ depth: d })}
                >
                  {d}
                  <small className="cost">{costOf(d)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row" style={{ padding: '6px 0' }}>
            <span className="lab">
              Full game simulation
              <small className="sub">
                Plays whole hands out against the opponents instead of asking whether a
                yaku is reachable — a different, harder question, and a far slower one:
                {' '}{costOf(sim.depth, true)} at depth {sim.depth}, restarted whenever
                the position changes.
              </small>
            </span>
            <button
              type="button"
              className={`toggle${sim.fullGame ? ' on' : ''}`}
              role="switch"
              aria-checked={sim.fullGame}
              aria-label="Full game simulation"
              onClick={() => setSim({ fullGame: !sim.fullGame })}
            >
              <span className="knob" />
            </button>
          </div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h4 style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>Reading the table</h4>
          <ul className="legend">
            <li><span className="lg lg-ring" aria-hidden="true" />The discard that was just made</li>
            <li><span className="lg lg-pip" aria-hidden="true" />Discarded straight off the draw (tsumogiri)</li>
            <li><span className="lg lg-turn" aria-hidden="true" />A sideways tile is that seat's riichi declaration</li>
            <li><span className="lg lg-draw" aria-hidden="true" />The gold line marks the tile you just drew</li>
            <li><span className="lg lg-cube" aria-hidden="true" />The centre cube shows each seat's wind; the lit one is to act</li>
          </ul>
        </div>

        <div className="rules-summary">
          <span className="pill">{settings.redDora ? 'Red fives on' : 'No red fives'}</span>
          <span className="pill">{settings.kuitan ? 'Kuitan on' : 'No kuitan'}</span>
          <span className="pill">{settings.twoHanMinimum ? '2-han min' : '1-han ok'}</span>
          <span className="pill">{settings.gameLength === 'east' ? 'East only' : 'Hanchan'}</span>
          <span className="pill">{settings.difficulty} opponents</span>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary" onClick={onResume} style={{ flex: 1 }}>Resume</button>
          <button className="btn btn-danger" onClick={onQuitToMenu}>Quit to menu</button>
        </div>
      </div>
    </div>
  );
}
