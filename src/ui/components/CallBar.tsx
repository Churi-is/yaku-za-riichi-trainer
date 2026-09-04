/**
 * CallBar — the action row under the felt: chi/pon/kan/riichi/ron/tsumo/pass,
 * the discard confirmation, and (when there is nothing to do) whose turn it is.
 *
 * On a phone the hand tiles are necessarily small, so discarding is two-step:
 * tapping a tile lifts it, and this bar shows the confirmation. That makes the
 * costliest mistake in the game — a fat-fingered discard — impossible.
 */
import type { Action, LegalAction, TileId } from '@engine/types';
import { tileFace } from '@ui/tiles';
import Tile from './Tile';

export interface CallBarProps {
  legal: LegalAction[];
  riichiMode: boolean;
  /** tile lifted out of the hand, awaiting confirmation */
  selected: TileId | null;
  onEnterRiichiMode: () => void;
  onCancelRiichi: () => void;
  onConfirmDiscard: () => void;
  onClearSelection: () => void;
  onAct: (action: Action) => void;
  /** shown when the player has nothing to decide */
  status?: React.ReactNode;
}

const KANJI: Record<string, string> = {
  tsumo: 'ツモ', ron: 'ロン', pon: 'ポン', kan: 'カン', riichi: 'リーチ', pass: 'パス',
};

export default function CallBar({
  legal, riichiMode, selected, onEnterRiichiMode, onCancelRiichi,
  onConfirmDiscard, onClearSelection, onAct, status,
}: CallBarProps) {
  const tsumo = legal.find((l) => l.action.type === 'tsumo');
  const ron = legal.find((l) => l.action.type === 'ron');
  const pass = legal.find((l) => l.action.type === 'pass');
  const pon = legal.find((l) => l.action.type === 'pon');
  const chis = legal.filter((l) => l.action.type === 'chi');
  const minkan = legal.find((l) => l.action.type === 'minkan');
  const ankans = legal.filter((l) => l.action.type === 'ankan');
  const kakans = legal.filter((l) => l.action.type === 'kakan');
  const hasRiichi = legal.some((l) => l.action.type === 'discard' && (l.action as { riichi?: boolean }).riichi);
  const canDiscard = legal.some((l) => l.action.type === 'discard');

  const confirm = selected !== null && (
    <div className="discard-confirm">
      <Tile id={selected} size="sm" />
      <button
        className={`call-btn confirm${riichiMode ? ' riichi' : ''}`}
        onClick={onConfirmDiscard}
      >
        {riichiMode ? 'Riichi + discard' : 'Discard'}
        <span className="kan">{tileFace(selected).label}</span>
      </button>
      <button className="call-btn pass slim" onClick={onClearSelection} aria-label="Put the tile back">✕</button>
    </div>
  );

  if (riichiMode) {
    return (
      <div className="call-bar">
        {confirm || <span className="call-hint">Pick the tile you'll declare riichi on</span>}
        {!confirm && (
          <button className="call-btn pass" onClick={onCancelRiichi}>Cancel<span className="kan">戻</span></button>
        )}
      </div>
    );
  }

  const buttons: React.ReactNode[] = [];
  if (tsumo) buttons.push(<button key="tsumo" className="call-btn win" onClick={() => onAct(tsumo.action)}>Tsumo<span className="kan">{KANJI.tsumo}</span></button>);
  if (ron) buttons.push(<button key="ron" className="call-btn win" onClick={() => onAct(ron.action)}>Ron<span className="kan">{KANJI.ron}</span></button>);
  if (pon) buttons.push(<button key="pon" className="call-btn" onClick={() => onAct(pon.action)}>{pon.label}<span className="kan">{KANJI.pon}</span></button>);
  chis.forEach((c, i) => buttons.push(
    <button key={`chi${i}`} className="call-btn" onClick={() => onAct(c.action)}>{c.label}<span className="kan">チー</span></button>,
  ));
  if (minkan) buttons.push(<button key="minkan" className="call-btn" onClick={() => onAct(minkan.action)}>{minkan.label}<span className="kan">{KANJI.kan}</span></button>);
  ankans.forEach((k, i) => buttons.push(
    <button key={`ankan${i}`} className="call-btn" onClick={() => onAct(k.action)}>{k.label}<span className="kan">{KANJI.kan}</span></button>,
  ));
  kakans.forEach((k, i) => buttons.push(
    <button key={`kakan${i}`} className="call-btn" onClick={() => onAct(k.action)}>{k.label}<span className="kan">{KANJI.kan}</span></button>,
  ));
  if (hasRiichi) buttons.push(<button key="riichi" className="call-btn riichi" onClick={onEnterRiichiMode}>Riichi<span className="kan">{KANJI.riichi}</span></button>);
  if (pass) buttons.push(<button key="pass" className="call-btn pass" onClick={() => onAct(pass.action)}>Pass<span className="kan">{KANJI.pass}</span></button>);

  return (
    <div className="call-bar">
      {confirm}
      {buttons}
      {!confirm && buttons.length === 0 && canDiscard && (
        <span className="call-hint">Tap a tile, then tap again to discard</span>
      )}
      {!confirm && buttons.length === 0 && !canDiscard && status}
    </div>
  );
}
