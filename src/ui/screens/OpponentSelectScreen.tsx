/**
 * OpponentSelectScreen — pick the three players you will sit against.
 *
 * Who is at the table is a strategic choice, not decoration: a table of three
 * wall-types plays nothing like a table with Goro shoving at it. Each card
 * states the archetype and how the seat behaves, because a bot you cannot read
 * is just noise.
 */
import { PERSONALITIES } from '@ai/index';
import type { Archetype } from '@ai/types';
import { useSession } from '@state/session';

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  aggressive: 'Aggressive',
  balanced: 'Balanced',
  defensive: 'Defensive',
};

const ARCHETYPE_KANJI: Record<Archetype, string> = {
  aggressive: '攻',
  balanced: '中',
  defensive: '守',
};

export default function OpponentSelectScreen() {
  const go = useSession((s) => s.go);
  const opponents = useSession((s) => s.opponents);
  const setOpponents = useSession((s) => s.setOpponents);

  const toggle = (id: string) => {
    if (opponents.includes(id)) {
      setOpponents(opponents.filter((x) => x !== id));
    } else if (opponents.length < 3) {
      setOpponents([...opponents, id]);
    } else {
      // Full table: replace the one chosen longest ago, so tapping always does
      // something rather than silently refusing.
      setOpponents([...opponents.slice(1), id]);
    }
  };

  const seatLabel = (id: string) => {
    const i = opponents.indexOf(id);
    return i < 0 ? null : ['Right', 'Across', 'Left'][i];
  };

  return (
    <div className="screen screen-narrow stack">
      <div className="screen-head">
        <h1>Choose Your Table<span className="kan jp">対戦相手</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('menu')}>← Menu</button>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Pick three opponents. Seats fill in the order you tap them: right, across, then left.
        {' '}When all three seats are taken, tapping a fourth player swaps out the one chosen longest ago —
        tap a seated player to remove them instead.
      </p>

      <div className="roster">
        {PERSONALITIES.map((p) => {
          const seat = seatLabel(p.id);
          return (
            <button
              type="button"
              key={p.id}
              className={`roster-card${seat ? ' on' : ''}`}
              aria-pressed={seat !== null}
              onClick={() => toggle(p.id)}
            >
              <span className={`arch arch-${p.archetype}`}>
                <span className="jp">{ARCHETYPE_KANJI[p.archetype]}</span>
                {ARCHETYPE_LABEL[p.archetype]}
              </span>
              <span className="who">{p.name}</span>
              {seat && <span className="seat-tag">{seat}</span>}
              <span className="tag">{p.tagline}</span>
            </button>
          );
        })}
      </div>

      <div className="start-bar">
        <button
          className="btn btn-primary"
          disabled={opponents.length !== 3}
          onClick={() => go('settings')}
        >
          {opponents.length === 3
            ? 'Table settings →'
            : `Choose ${3 - opponents.length} more`}
        </button>
      </div>
    </div>
  );
}
