/** OverlayToggleBar — the three independent trainer toggles (score strip). */
import { useSession } from '@state/session';
import type { OverlayToggles } from '@state/session';

const TABS: { key: keyof OverlayToggles; label: string; kan: string }[] = [
  { key: 'yakuAdvisor', label: 'Yaku', kan: '役' },
  { key: 'opponentReading', label: 'Reads', kan: '読' },
  { key: 'waitGuessing', label: 'Waits', kan: '待' },
];

export default function OverlayToggleBar() {
  const overlays = useSession((s) => s.overlays);
  const toggle = useSession((s) => s.toggleOverlay);

  return (
    <div className="overlay-toggle-bar" role="group" aria-label="Training overlays" style={{ display: 'contents' }}>
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab-btn${overlays[t.key] ? ' on' : ''}`}
          aria-label={t.label}
          aria-pressed={overlays[t.key]}
          title={`${t.label} overlay`}
          onClick={() => toggle(t.key)}
        >
          <span className="kan">{t.kan}</span>
          <span className="en">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
