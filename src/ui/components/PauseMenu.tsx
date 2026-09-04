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

  return (
    <div className="modal-backdrop" onClick={onResume}>
      <div className="modal card stack" onClick={(e) => e.stopPropagation()}>
        <h2>Paused</h2>
        <div className="stack">
          <h4 style={{ margin: 0 }}>Overlays</h4>
          {(Object.keys(OVERLAY_LABELS) as (keyof OverlayToggles)[]).map((k) => (
            <div className="setting-row" key={k}>
              <span>{OVERLAY_LABELS[k]}</span>
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
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary" onClick={onResume} style={{ flex: 1 }}>Resume</button>
          <button className="btn btn-danger" onClick={onQuitToMenu}>Quit to menu</button>
        </div>
      </div>
    </div>
  );
}
