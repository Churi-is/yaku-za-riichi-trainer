/** PersonalitiesIntro — shown at match start so the player learns each seat.
 *  The three opponents are introduced in their table positions. */
import SpecialDescription from './SpecialDescription';
import { DIFFICULTY_LABEL, rosterDifficulty } from '@ai/personalities';
import type { SeatPersonality } from '@state/gameLoop';
import { useFocusTrap } from '@ui/hooks/useFocusTrap';

interface PersonalitiesIntroProps {
  personalities: SeatPersonality[];
  onStart: () => void;
}

const AREA: Record<number, string> = { 1: 's1', 2: 's2', 3: 's3' };
/** Position names relative to you: right, across, left. */
const POSITION: Record<number, string> = { 1: '下家 · right', 2: '対面 · across', 3: '上家 · left' };

export default function PersonalitiesIntro({ personalities, onStart }: PersonalitiesIntroProps) {
  // 対局 = "the game/match" (対面, "across the table", belonged on a seat card).
  const cardRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <div className="scrim">
      <div
        className="card handend-card intro-card stack"
        role="dialog"
        aria-modal="true"
        aria-label="Your table"
        ref={cardRef}
        tabIndex={-1}
      >
        <h2 style={{ margin: 0 }}>Your table<span className="kan jp" style={{ color: 'var(--gold-dim)', fontSize: '0.7em', marginLeft: 8 }}>対局</span></h2>
        <p className="muted" style={{ margin: 0 }}>
          Three opponents, three styles. Start building a read on each before the first discard.
        </p>
        <div className="intro-table">
          {personalities.map((p) => (
            <div className={`card intro-seat ${AREA[p.seat] ?? 's2'}`} key={p.seat} style={{ padding: 10 }}>
              <div className="nm">{p.name}</div>
              <div className="character-title">{p.title}</div>
              <div className="wd jp">{POSITION[p.seat] ?? ''}</div>
              <span className={`level level-${rosterDifficulty(p)}`} style={{ marginTop: 5 }}>{DIFFICULTY_LABEL[rosterDifficulty(p)]}</span>
              {p.special && <SpecialDescription special={p.special} />}
              <div className="tl">{p.tagline}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary intro-deal" onClick={onStart}>Deal<span className="kan jp" style={{ marginLeft: 8, opacity: 0.85 }}>配牌</span></button>
      </div>
    </div>
  );
}
