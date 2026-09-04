/** PauseMenu — mid-match menu: table legend, rules reminder, resume or quit. */
import { useSession } from '@state/session';

export interface PauseMenuProps {
  onResume: () => void;
  onQuitToMenu: () => void;
}

export default function PauseMenu({ onResume, onQuitToMenu }: PauseMenuProps) {
  const settings = useSession((s) => s.settings);

  return (
    <div className="modal-backdrop" onClick={onResume}>
      <div className="modal card stack" onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ margin: 0 }}>
          <h2 style={{ margin: 0 }}>
            Paused
            <span className="kan jp" style={{ color: 'var(--gold-dim)', fontSize: '0.7em', marginLeft: 8 }}>休憩</span>
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onResume}>✕</button>
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
        </div>

        <div className="rules-summary">
          <span className="pill">{settings.redDora ? 'Red fives on' : 'No red fives'}</span>
          <span className="pill">{settings.kuitan ? 'Kuitan on' : 'Kuitan off'}</span>
          <span className="pill">{settings.twoHanMinimum ? '2-han minimum' : '1-han ok'}</span>
          <span className="pill">{settings.gameLength === 'east' ? 'East only' : 'Hanchan'}</span>
          <span className="pill">{settings.difficulty} opponents</span>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onResume}>Resume</button>
          <button className="btn btn-danger" onClick={onQuitToMenu}>Quit to menu</button>
        </div>
      </div>
    </div>
  );
}
