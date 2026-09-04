/** MainMenu — the parlour door. Owned by Worker D. */
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import Tile from '@ui/components/Tile';

export default function MainMenu() {
  const go = useSession((s) => s.go);
  const reset = useMatch((s) => s.reset);

  return (
    <div className="menu-shell">
      <span className="menu-kanji jp" aria-hidden="true">立直麻雀・道場</span>
      <div className="menu-crest jp" aria-hidden="true">雀</div>
      <h1 className="menu-title">
        Yakuza-Style
        <span className="accent">Mahjong Trainer</span>
      </h1>
      <p className="menu-sub">
        Single-player riichi against three AI opponents, each with their own
        style. Full Japanese rules: riichi, calls, dora, yaku and scoring.
      </p>
      <nav className="menu-list">
        <button className="menu-item primary" onClick={() => { reset(); go('settings'); }}>
          <span className="label">New Match</span>
          <span className="kan jp">対局</span>
        </button>
      </nav>
      <div className="tile-fan" aria-hidden="true">
        <Tile id={31 * 4} size="md" />
        <Tile id={32 * 4} size="md" />
        <Tile id={16} size="md" />
        <Tile id={33 * 4} size="md" />
        <Tile id={27 * 4} size="md" />
      </div>
      <p className="menu-foot">Browser-only · nothing saved between sessions</p>
    </div>
  );
}
