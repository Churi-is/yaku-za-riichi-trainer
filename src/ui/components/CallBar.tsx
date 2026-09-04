/** CallBar — the player's plate plus chi/pon/kan/riichi/ron/tsumo/pass.
 *  Sits under the hand like a real table's action row. */
import type { Action, LegalAction, PublicSeatView, Wind } from '@engine/types';
import { WIND_KANJI } from './SeatPlate';

export interface CallBarProps {
  legal: LegalAction[];
  riichiMode: boolean;
  onEnterRiichiMode: () => void;
  onCancelRiichi: () => void;
  onAct: (action: Action) => void;
  me: PublicSeatView;
  isDealer: boolean;
}

const KANJI: Record<string, string> = {
  tsumo: 'ツモ', ron: 'ロン', pon: 'ポン', kan: 'カン', riichi: 'リーチ', pass: 'パス',
};

export default function CallBar({
  legal, riichiMode, onEnterRiichiMode, onCancelRiichi, onAct, me, isDealer,
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

  const plate = (
    <div className="player-plate">
      <span className={`wind-badge${isDealer ? ' dealer' : ''}`}>{WIND_KANJI[me.seatWind as Wind]}</span>
      <span><strong>You</strong> <span className="muted">{me.points.toLocaleString()}</span></span>
      {me.riichi && <span className="pill red">RIICHI</span>}
    </div>
  );

  if (riichiMode) {
    return (
      <div className="call-bar">
        {plate}
        <span className="call-hint">Select a tile to discard for riichi</span>
        <button className="call-btn ghost" onClick={onCancelRiichi}>Cancel<span className="kan">戻</span></button>
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
      {plate}
      {buttons}
    </div>
  );
}
