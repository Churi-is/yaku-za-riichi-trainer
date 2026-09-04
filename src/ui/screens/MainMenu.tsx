/** MainMenu — entry screen. Owned by Worker D. */
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

export default function MainMenu() {
  const go = useSession((s) => s.go);
  const matchLog = useSession((s) => s.matchLog);
  const reset = useMatch((s) => s.reset);

  return (
    <div className="menu-hero">
      <div>
        <h1 className="menu-title">
          Yakuza-Style <span className="accent">Mahjong Trainer</span>
        </h1>
        <p className="menu-sub">
          Single-player riichi practice with three live coaching overlays —
          yaku direction, opponent reads, and wait guessing — plus turn-by-turn
          grading after every match. You already know how to play; this sharpens
          your judgment.
        </p>
      </div>
      <div className="menu-actions">
        <button className="btn btn-primary" onClick={() => { reset(); go('settings'); }}>
          New Match
        </button>
        {matchLog && (
          <>
            <button className="btn" onClick={() => go('replay')}>Review Last Match</button>
            <button className="btn" onClick={() => go('summary')}>Session Summary</button>
          </>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Browser-only · nothing saved between sessions
      </p>
    </div>
  );
}
