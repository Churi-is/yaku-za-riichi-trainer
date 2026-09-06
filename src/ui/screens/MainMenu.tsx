/** MainMenu — the parlour door. */
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
        Sit down against three opponents who each play their own way, or learn
        the game in the dojo — a basics course for new players, then a strategy
        course in tile efficiency and judgement.
      </p>
      <nav className="menu-list">
        <button className="menu-item primary" onClick={() => { reset(); go('opponents'); }}>
          <span className="label">Play a Match</span>
          <span className="sub">Choose three opponents and sit down</span>
          <span className="kan jp">対局</span>
        </button>
        <button className="menu-item" onClick={() => go('dojo')}>
          <span className="label">The Dojo</span>
          <span className="sub">Learn to read a hand, one lesson at a time</span>
          <span className="kan jp">道場</span>
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
