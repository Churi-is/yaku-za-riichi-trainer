/** PersonalitiesIntro — shown at match start so the player learns each seat. Owned by Worker D. */
import type { SeatPersonality } from '@state/gameLoop';

export interface PersonalitiesIntroProps {
  personalities: SeatPersonality[];
  onStart: () => void;
}

const ARCHETYPE_HINT: Record<string, string> = {};

export default function PersonalitiesIntro({ personalities, onStart }: PersonalitiesIntroProps) {
  return (
    <div className="scrim">
      <div className="card handend-card stack">
        <h2 style={{ margin: 0 }}>Your table</h2>
        <p className="muted" style={{ margin: 0 }}>
          Three opponents, three styles. Start building a read on each before the first discard.
        </p>
        <div className="stack">
          {personalities.map((p) => (
            <div className="card" key={p.seat} style={{ padding: 12 }}>
              <div className="row spread">
                <strong>{p.name}</strong>
                <span className="pill">Seat {p.seat}</span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.tagline}{ARCHETYPE_HINT[p.id] ?? ''}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onStart}>Deal</button>
      </div>
    </div>
  );
}
