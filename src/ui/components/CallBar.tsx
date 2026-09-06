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
  /** the human seat is furiten: ron is blocked until it clears */
  furiten?: boolean;
}

const KANJI: Record<string, string> = {
  tsumo: 'ツモ', ron: 'ロン', pon: 'ポン', kan: 'カン', riichi: 'リーチ', pass: 'パス',
};

export default function CallBar({
  legal, riichiMode, selected, onEnterRiichiMode, onCancelRiichi,
  onConfirmDiscard, onClearSelection, onAct, status, furiten = false,
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

  // ✕ puts a lifted tile back; with nothing lifted in riichi mode it leaves
  // riichi mode directly, so exiting never costs a second tap.
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
      <button
        className="call-btn pass slim"
        onClick={riichiMode ? onCancelRiichi : onClearSelection}
        aria-label={riichiMode ? 'Exit riichi choice' : 'Put the tile back'}
      >
        ✕
      </button>
    </div>
  );

  if (riichiMode) {
    return (
      <div className="call-bar">
        {confirm || <span className="call-hint">Pick the tile you'll declare riichi on</span>}
        {/* A live tsumo beats riichi: don't let the mode hide the winning button. */}
        {tsumo && <button className="call-btn win" onClick={() => onAct(tsumo.action)}>Tsumo<span className="kan">{KANJI.tsumo}</span></button>}
        {furiten && <FuritenChip />}
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
      {furiten && legal.length > 0 && <FuritenChip />}
      {!confirm && buttons.length === 0 && !furiten && canDiscard && (
        <span className="call-hint">Tap a tile, then tap again to discard</span>
      )}
      {!confirm && buttons.length === 0 && !canDiscard && status}
    </div>
  );
}

/**
 * Why is there no Ron button? The seat is furiten — a wait of theirs is in
 * their own river (or they passed on a ron chance this turn), so ron is
 * blocked while tsumo remains legal. At a real table you know your own
 * furiten; the chip says what the table isn't showing.
 */
function FuritenChip() {
  return (
    <span
      className="call-chip furiten"
      role="status"
      title="One of your waits is in your own discard pond (or you passed a ron chance this turn). Ron is blocked until it clears — tsumo still wins."
    >
      <span className="kan jp">振聴</span>
      Furiten — ron blocked, tsumo still wins
    </span>
  );
}
