/** OverlayToggleBar — the three independent overlay toggles (pills). Owned by Worker D. */
import { useSession } from '@state/session';

export type OverlayKey = 'yakuAdvisor' | 'opponentReading' | 'waitGuessing';

export interface OverlayToggleBarProps {
  /** Overlay currently expanded into the mobile sheet, if any (PLAN-MOBILE-LAYOUT §10). */
  expanded?: OverlayKey | null;
  onToggle?: (key: OverlayKey | null) => void;
}

const LABELS: Record<OverlayKey, string> = {
  yakuAdvisor: 'Yaku',
  opponentReading: 'Reads',
  waitGuessing: 'Waits',
};

export default function OverlayToggleBar({ expanded, onToggle }: OverlayToggleBarProps) {
  const overlays = useSession((s) => s.overlays);
  const toggle = useSession((s) => s.toggleOverlay);

  const handle = (key: OverlayKey) => {
    const wasOn = overlays[key];
    toggle(key);
    if (onToggle) {
      // Mobile sheet: turning an overlay on expands it; turning off an
      // expanded overlay closes the sheet. Pills keep their "on" state.
      if (!wasOn) onToggle(key);
      else if (expanded === key) onToggle(null);
    }
  };

  return (
    <div className="overlay-toggle-bar" role="group" aria-label="Training overlays">
      {(Object.keys(LABELS) as OverlayKey[]).map((key) => {
        const on = overlays[key];
        return (
          <button
            key={key}
            className={`btn btn-sm${on ? ' on' : ''}${expanded === key ? ' expanded' : ''}`}
            aria-pressed={on}
            aria-expanded={on && expanded === key}
            onClick={() => handle(key)}
          >
            {LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
