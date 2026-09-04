/** OverlayToggleBar — the three independent overlay toggles. Owned by Worker D. */
import { useSession } from '@state/session';

export default function OverlayToggleBar() {
  const overlays = useSession((s) => s.overlays);
  const toggle = useSession((s) => s.toggleOverlay);

  return (
    <div className="overlay-toggle-bar" role="group" aria-label="Training overlays">
      <button
        className={`btn btn-sm${overlays.yakuAdvisor ? ' on' : ''}`}
        aria-pressed={overlays.yakuAdvisor}
        onClick={() => toggle('yakuAdvisor')}
      >
        Yaku
      </button>
      <button
        className={`btn btn-sm${overlays.opponentReading ? ' on' : ''}`}
        aria-pressed={overlays.opponentReading}
        onClick={() => toggle('opponentReading')}
      >
        Reads
      </button>
      <button
        className={`btn btn-sm${overlays.waitGuessing ? ' on' : ''}`}
        aria-pressed={overlays.waitGuessing}
        onClick={() => toggle('waitGuessing')}
      >
        Waits
      </button>
    </div>
  );
}
