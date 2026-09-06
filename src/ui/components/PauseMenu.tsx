/** PauseMenu — mid-match menu: table legend, rules reminder, resume or quit.
 *  Quitting abandons the match, so it takes a deliberate second tap. */
import { useState } from 'react';
import { useSession } from '@state/session';
import { useFocusTrap } from '@ui/hooks/useFocusTrap';

export interface PauseMenuProps {
  onResume: () => void;
  onQuitToMenu: () => void;
}

const DIFFICULTY_WORD: Record<string, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard',
};

export default function PauseMenu({ onResume, onQuitToMenu }: PauseMenuProps) {
  const settings = useSession((s) => s.settings);
  const [confirming, setConfirming] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  const difficultyWord = DIFFICULTY_WORD[settings.difficulty] ?? settings.difficulty;

  return (
    <div className="modal-backdrop" onClick={confirming ? undefined : onResume}>
      <div
        className="modal card stack"
        role="dialog"
        aria-modal="true"
        aria-label="Paused"
        ref={trapRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row spread" style={{ margin: 0 }}>
          <h2 style={{ margin: 0 }}>
            Paused
            <span className="kan jp" style={{ color: 'var(--gold-dim)', fontSize: '0.7em', marginLeft: 8 }}>休憩</span>
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onResume} aria-label="Resume the match">✕</button>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h4 style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Reading the table
          </h4>
          <ul className="legend">
            <li><span className="lg lg-ring" aria-hidden="true" />The discard that was just made</li>
            <li><span className="lg lg-pip" aria-hidden="true" />Discarded straight off the draw (tsumogiri)</li>
            <li><span className="lg lg-turn" aria-hidden="true" />A sideways tile is that seat&apos;s riichi declaration</li>
            <li><span className="lg lg-draw" aria-hidden="true" />The gold line marks the tile you just drew</li>
            <li><span className="lg lg-cube" aria-hidden="true" />The centre cube shows each seat&apos;s wind; the lit one is to act</li>
          </ul>
          <ul className="legend">
            <li>
              <span className="pos-key" aria-hidden="true">▼ ▶ ▲ ◀</span>
              Seat positions on the score strip, in fixed order: you (bottom), right, across, left
            </li>
            <li>
              <span className="pos-key" aria-hidden="true">残 69</span>
              Tiles left in the live wall
            </li>
            <li>
              <span className="pos-key jp" aria-hidden="true">振聴</span>
              Furiten: ron is blocked for that seat — a wait of theirs is in their own pond
            </li>
          </ul>
        </div>

        <div className="rules-summary">
          <span className="pill">{settings.redDora ? 'Red fives on' : 'No red fives'}</span>
          <span className="pill">{settings.kuitan ? 'Kuitan on' : 'Kuitan off'}</span>
          <span className="pill">{settings.twoHanMinimum ? '2-han minimum' : '1-han ok'}</span>
          <span className="pill">{settings.gameLength === 'east' ? 'East only' : 'Hanchan'}</span>
          <span className="pill">{difficultyWord} opponents</span>
        </div>

        {confirming ? (
          <div className="stack" style={{ gap: 10 }} role="alertdialog" aria-label="Abandon match?">
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Abandon this match and return to the menu? The hand in progress will be lost.
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setConfirming(false)}>Keep playing</button>
              <button className="btn btn-danger" onClick={onQuitToMenu}>Abandon match</button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={onResume}>Resume</button>
            <button className="btn btn-danger" onClick={() => setConfirming(true)}>Quit to menu</button>
          </div>
        )}
      </div>
    </div>
  );
}
