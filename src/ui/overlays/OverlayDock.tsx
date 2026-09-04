/**
 * OverlayDock — the trainer panels, docked in the layout instead of floating
 * over the table. Portrait: a bottom sheet between felt and hand. Landscape:
 * a column beside the felt. It auto-minimises while a call window is open so
 * rivers, dora and the call prompt always stay visible, and re-expands after.
 * All active panels stay mounted (headers included) so any combination of
 * toggles works mid-hand.
 */
import { useEffect, useState } from 'react';
import type { PublicView, SeatIndex } from '@engine/types';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import { useOrientation } from '@ui/hooks/useOrientation';
import YakuAdvisorPanel from './YakuAdvisorPanel';
import OpponentReadingPanel from './OpponentReadingPanel';
import WaitGuessingPanel from './WaitGuessingPanel';

type PanelKey = 'yakuAdvisor' | 'opponentReading' | 'waitGuessing';

export interface OverlayDockProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  /** A call window is open right now: keep the felt clear. */
  callWindow: boolean;
}

export default function OverlayDock({ view, seatName, callWindow }: OverlayDockProps) {
  const overlays = useSession((s) => s.overlays);
  const practicePrompts = useMatch((s) => s.practicePrompts);
  const { orient } = useOrientation();

  const [min, setMin] = useState(false);
  const [open, setOpen] = useState<Record<PanelKey, boolean>>({
    yakuAdvisor: true, opponentReading: true, waitGuessing: true,
  });

  const promptActive = overlays.waitPracticeMode && practicePrompts.some((p) => p.active);

  // Never cover a call prompt; reopen once it resolves.
  useEffect(() => { setMin(callWindow); }, [callWindow]);
  // A live practice prompt must be visible (non-blocking but not hidden).
  useEffect(() => {
    if (promptActive) {
      setMin(false);
      setOpen((o) => (o.waitGuessing ? o : { ...o, waitGuessing: true }));
    }
  }, [promptActive]);

  const toggleOpen = (k: PanelKey) => {
    setOpen((o) => {
      const next = { ...o, [k]: !o[k] };
      // On a phone one panel at a time stays legible; landscape stacks them.
      if (orient === 'portrait' && next[k]) {
        (Object.keys(next) as PanelKey[]).forEach((key) => { if (key !== k) next[key] = false; });
      }
      return next;
    });
  };

  const anyActive = overlays.yakuAdvisor || overlays.opponentReading || overlays.waitGuessing;
  if (!anyActive) return null;

  return (
    <aside className={`overlay-dock${min ? ' min' : ''}`} aria-label="Training overlays">
      <div className="dock-head" onClick={() => setMin((m) => !m)}>
        <span className="title">Trainer<span className="kan">指導</span></span>
        <span className="spacer" />
        <button
          type="button"
          className="dock-min-btn"
          onClick={(e) => { e.stopPropagation(); setMin((m) => !m); }}
          aria-label={min ? 'Expand trainer panels' : 'Minimise trainer panels'}
        >
          {min ? '▲' : '▼'}
        </button>
      </div>
      <div className="dock-body">
        {overlays.yakuAdvisor && (
          <YakuAdvisorPanel view={view} open={open.yakuAdvisor} onToggleOpen={() => toggleOpen('yakuAdvisor')} />
        )}
        {overlays.opponentReading && (
          <OpponentReadingPanel view={view} seatName={seatName} open={open.opponentReading} onToggleOpen={() => toggleOpen('opponentReading')} />
        )}
        {overlays.waitGuessing && (
          <WaitGuessingPanel view={view} seatName={seatName} open={open.waitGuessing} onToggleOpen={() => toggleOpen('waitGuessing')} />
        )}
      </div>
    </aside>
  );
}
