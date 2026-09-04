/**
 * WaitGuessingPanel (Overlay C) — up to ~3 ranked wait guesses per tenpai
 * opponent with confidence + one-line reasoning, plus a practice-mode
 * sub-toggle. On an opponent's riichi, practice mode prompts the player to
 * submit a guess before that opponent's next discard; it's recorded and
 * resolved at round end. The prompt is NON-BLOCKING. Reads from @analysis.
 * Owned by Worker D.
 */
import { useState } from 'react';
import type { PublicView, SeatIndex, TileKind } from '@engine/types';
import { guessWaits } from '@state/analysisAdapter';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import Tooltip from '@ui/components/Tooltip';
import Tile from '@ui/components/Tile';

export interface WaitGuessingPanelProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  open?: boolean;
  onToggleOpen?: () => void;
}

const CONF_CLASS: Record<string, string> = {
  'Very high': 'band band-vhigh', High: 'band band-high', Medium: 'band band-med',
  Low: 'band band-low', 'Very low': 'band band-vlow',
};

/** A compact tile-kind picker (one representative id per kind). */
function KindPicker({ selected, onToggle }: { selected: Set<TileKind>; onToggle: (k: TileKind) => void }) {
  const groups: { label: string; kinds: TileKind[] }[] = [
    { label: 'm', kinds: Array.from({ length: 9 }, (_, i) => i) },
    { label: 'p', kinds: Array.from({ length: 9 }, (_, i) => i + 9) },
    { label: 's', kinds: Array.from({ length: 9 }, (_, i) => i + 18) },
    { label: 'z', kinds: Array.from({ length: 7 }, (_, i) => i + 27) },
  ];
  return (
    <div>
      {groups.map((g) => (
        <div className="wait-tile-picker" key={g.label}>
          {g.kinds.map((k) => (
            <Tile
              key={k}
              id={k * 4 + 1}
              size="xs"
              onClick={() => onToggle(k)}
              selected={selected.has(k)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function WaitGuessingPanel({ view, seatName, open = true, onToggleOpen }: WaitGuessingPanelProps) {
  const overlays = useSession((s) => s.overlays);
  const toggleOverlay = useSession((s) => s.toggleOverlay);
  const practicePrompts = useMatch((s) => s.practicePrompts);
  const submitWaitGuess = useMatch((s) => s.submitWaitGuess);
  const dismissPractice = useMatch((s) => s.dismissPractice);
  const waitGuesses = useMatch((s) => s.waitGuesses);

  const reads = guessWaits(view);
  const tenpaiReads = reads.filter((r) => r.tenpaiLikely);

  const [picks, setPicks] = useState<Record<number, Set<TileKind>>>({});

  const togglePick = (seat: SeatIndex, k: TileKind) => {
    setPicks((prev) => {
      const cur = new Set(prev[seat] ?? []);
      if (cur.has(k)) cur.delete(k); else cur.add(k);
      return { ...prev, [seat]: cur };
    });
  };

  const activePractice = overlays.waitPracticeMode
    ? practicePrompts.filter((p) => p.active)
    : [];

  return (
    <div className="overlay-panel">
      <button type="button" className="panel-head" onClick={onToggleOpen} aria-expanded={open}>
        <h4>Wait Guessing <span className="estimate-tag">estimate</span></h4>
        {activePractice.length > 0 && <span className="badge">guess!</span>}
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="panel-body">
          <label className="row" style={{ fontSize: 12, gap: 6, marginBottom: 6 }}>
            <button
              type="button"
              className={`toggle${overlays.waitPracticeMode ? ' on' : ''}`}
              role="switch"
              aria-checked={overlays.waitPracticeMode}
              onClick={() => toggleOverlay('waitPracticeMode')}
              style={{ transform: 'scale(0.8)' }}
            >
              <span className="knob" />
            </button>
            Practice mode
            <Tooltip content="When an opponent declares riichi, you'll be asked to guess their wait before their next discard. Guesses are scored at round end and reviewed in the replay." />
          </label>

          {activePractice.map((p) => {
            const already = waitGuesses.some((g) => g.seat === p.seat);
            if (already) return null;
            const sel = picks[p.seat] ?? new Set<TileKind>();
            return (
              <div className="practice-prompt" key={`prompt${p.seat}`}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                  Guess {seatName(p.seat)}'s wait
                </div>
                <div className="muted" style={{ fontSize: 11 }}>Tap the tile kinds you think they're waiting on.</div>
                <KindPicker selected={sel} onToggle={(k) => togglePick(p.seat, k)} />
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={sel.size === 0}
                    onClick={() => { submitWaitGuess(p.seat, [...sel]); }}
                  >
                    Submit guess
                  </button>
                  <button className="btn btn-sm" onClick={() => dismissPractice(p.seat)}>Skip</button>
                </div>
              </div>
            );
          })}

          {tenpaiReads.length === 0 && (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>No opponent looks tenpai yet.</p>
          )}
          {tenpaiReads.map((r) => (
            <div className="wait-seat" key={r.seat}>
              <strong>{seatName(r.seat)}</strong>
              {r.guesses.length === 0 && (
                <div className="muted" style={{ fontSize: 11.5 }}>Tenpai likely, but the wait is unclear.</div>
              )}
              {r.guesses.map((g, i) => (
                <div className="guess" key={i}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={CONF_CLASS[g.confidence] ?? 'band band-vlow'}>{g.confidence}</span>
                    <span className="guess-label">{g.label}</span>
                  </div>
                  <div className="guess-reason">{g.reasoning}</div>
                </div>
              ))}
            </div>
          ))}
          <p className="muted" style={{ fontSize: 10.5, marginTop: 6, marginBottom: 0 }}>
            Guesses are estimates from public info; verify them in the post-match reveal.
          </p>
        </div>
      )}
    </div>
  );
}
