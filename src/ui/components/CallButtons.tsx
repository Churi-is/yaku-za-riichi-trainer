/** CallButtons — chi/pon/kan/ron/riichi/tsumo with confirmation. Owned by Worker D. */
import type { Action, LegalAction } from '@engine/types';

export interface CallButtonsProps {
  legal: LegalAction[];
  /** Enter riichi-discard selection mode (handled by parent). */
  onEnterRiichiMode: () => void;
  riichiMode: boolean;
  onCancelRiichi: () => void;
  onAct: (action: Action) => void;
}

/** Group legal actions into the call-window buttons. */
export default function CallButtons({
  legal, onEnterRiichiMode, riichiMode, onCancelRiichi, onAct,
}: CallButtonsProps) {
  const tsumo = legal.find((l) => l.action.type === 'tsumo');
  const ron = legal.find((l) => l.action.type === 'ron');
  const pass = legal.find((l) => l.action.type === 'pass');
  const pon = legal.find((l) => l.action.type === 'pon');
  const chis = legal.filter((l) => l.action.type === 'chi');
  const minkan = legal.find((l) => l.action.type === 'minkan');
  const ankans = legal.filter((l) => l.action.type === 'ankan');
  const kakans = legal.filter((l) => l.action.type === 'kakan');
  const hasRiichi = legal.some((l) => l.action.type === 'discard' && (l.action as { riichi?: boolean }).riichi);

  const isCallWindow = !!(ron || pon || minkan || chis.length) && !tsumo && legal.some((l) => l.action.type === 'pass');

  if (riichiMode) {
    return (
      <div className="call-bar">
        <span className="call-hint">Select a tile to discard for riichi</span>
        <button className="btn btn-sm" onClick={onCancelRiichi}>Cancel</button>
      </div>
    );
  }

  const buttons: React.ReactNode[] = [];

  if (tsumo) buttons.push(<button key="tsumo" className="btn btn-win" onClick={() => onAct(tsumo.action)}>Tsumo</button>);
  if (ron) buttons.push(<button key="ron" className="btn btn-win" onClick={() => onAct(ron.action)}>Ron</button>);
  if (pon) buttons.push(<button key="pon" className="btn btn-call" onClick={() => onAct(pon.action)}>{pon.label}</button>);
  chis.forEach((c, i) => buttons.push(
    <button key={`chi${i}`} className="btn btn-call" onClick={() => onAct(c.action)}>{c.label}</button>,
  ));
  if (minkan) buttons.push(<button key="minkan" className="btn btn-call" onClick={() => onAct(minkan.action)}>{minkan.label}</button>);
  ankans.forEach((k, i) => buttons.push(
    <button key={`ankan${i}`} className="btn btn-call" onClick={() => onAct(k.action)}>{k.label}</button>,
  ));
  kakans.forEach((k, i) => buttons.push(
    <button key={`kakan${i}`} className="btn btn-call" onClick={() => onAct(k.action)}>{k.label}</button>,
  ));
  if (hasRiichi) buttons.push(<button key="riichi" className="btn btn-riichi" onClick={onEnterRiichiMode}>Riichi</button>);
  if (pass) buttons.push(<button key="pass" className="btn" onClick={() => onAct(pass.action)}>Pass</button>);

  // No actions: reserve no space at all (mobile chrome stays minimal, §8).
  if (buttons.length === 0) return null;

  return (
    <div className="call-bar">
      {isCallWindow && <span className="call-hint">Call?</span>}
      {buttons}
    </div>
  );
}
