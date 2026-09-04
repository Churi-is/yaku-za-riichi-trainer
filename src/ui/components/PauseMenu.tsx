/** PauseMenu — mid-match menu; can change overlay toggles. Owned by Worker D. */
import { useSession, type OverlayToggles } from '@state/session';

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
