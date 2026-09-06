/** Manual seat assignment. A roster click affects ONLY the selected seat. */
import { useState } from 'react';
import { PERSONALITIES, REGULAR_PERSONALITIES, SPECIAL_PERSONALITIES, DEFAULT_OPPONENTS, DIFFICULTY_LABEL, rosterDifficulty } from '@ai/personalities';
import type { Archetype, RosterDifficulty } from '@ai/types';
import type { Difficulty } from '@engine/types';
import { useSession } from '@state/session';
import { OPPONENT_POSITIONS, type OpponentSeat } from '@state/opponents';
import OpponentTable, { OPPONENT_DRAG_TYPE } from '../components/OpponentTable';
import SpecialDescription from '../components/SpecialDescription';

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  aggressive: 'Attacker', balanced: 'All-rounder', defensive: 'Defender',
};
const ARCHETYPE_KANJI: Record<Archetype, string> = {
  aggressive: '攻', balanced: '中', defensive: '守',
};
const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];
const CATEGORIES: RosterDifficulty[] = [...LEVELS, 'special'];

export default function OpponentSelectScreen() {
  const go = useSession((s) => s.go);
  const opponents = useSession((s) => s.opponents);
  const setOpponents = useSession((s) => s.setOpponents);
  const seatOpponent = useSession((s) => s.seatOpponent);
  const clearOpponent = useSession((s) => s.clearOpponent);
  const [activeSeat, setActiveSeat] = useState<OpponentSeat>(1);
  const [filter, setFilter] = useState<RosterDifficulty | 'all'>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('Choose a seat, then a character. The other seats stay put.');

  const position = OPPONENT_POSITIONS[activeSeat - 1];
  const seatedCount = opponents.filter(Boolean).length;
  const query = search.trim().toLowerCase();
  const roster = PERSONALITIES.filter((p) =>
    (filter === 'all' || rosterDifficulty(p) === filter)
    && `${p.name} ${p.title} ${p.archetype} ${p.tagline} ${p.special?.rule ?? ''}`.toLowerCase().includes(query));

  const selectSeat = (seat: OpponentSeat) => {
    setActiveSeat(seat);
    setNotice(`${OPPONENT_POSITIONS[seat - 1].label} seat selected. Choose a character below to place them here.`);
  };

  const assign = (seat: OpponentSeat, id: string) => {
    const p = PERSONALITIES.find((bot) => bot.id === id);
    if (!p) return; // Ignore unrelated drag payloads.
    const source = opponents.indexOf(id);
    const targetLabel = OPPONENT_POSITIONS[seat - 1].label;
    seatOpponent(seat, id);
    setActiveSeat(seat);
    setNotice(source === seat - 1
      ? `${p.name} is already at ${targetLabel}. Choose another seat to move them.`
      : source >= 0 && opponents[seat - 1]
        ? `Swapped ${p.name} to ${targetLabel}. The two opponents exchanged seats.`
        : `Placed ${p.name} at ${targetLabel}. Other opponents stay in their seats.`);
  };

  const quickTable = (level: Difficulty | 'mixed' | 'special') => {
    const ids: string[] = [];
    if (level === 'special') {
      const pool = [...SPECIAL_PERSONALITIES];
      while (ids.length < 3) ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
      setOpponents(ids);
      setNotice('Special table ready. Each opponent has a unique rule, not a higher difficulty tier.');
      return;
    }
    for (const tier of level === 'mixed' ? LEVELS : [level, level, level]) {
      const pool = REGULAR_PERSONALITIES.filter((p) => p.difficulty === tier && !ids.includes(p.id));
      ids.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
    setOpponents(ids);
    setNotice(level === 'mixed'
      ? 'Mixed table ready: one Easy, one Medium, one Hard. You can rearrange any seat.'
      : `${DIFFICULTY_LABEL[level]} table ready. You can rearrange any seat.`);
  };

  return (
    <div className="screen opponents-screen">
      <div className="screen-head">
        <h1>Choose Your Table<span className="kan jp">対戦相手</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('menu')}>← Menu</button>
      </div>
      <div className="screen-body">
      <div className="roster-intro">
        <p>Familiar faces. Very different games.</p>
        <span>{PERSONALITIES.length} opponents · {CATEGORIES.map((level) =>
          `${PERSONALITIES.filter((p) => rosterDifficulty(p) === level).length} ${DIFFICULTY_LABEL[level].toLowerCase()}`).join(' · ')}</span>
      </div>

      <div className="opponent-layout">
        <aside className="seating-panel card">
          <div className="section-eyebrow"><span>01 / Take your seats</span><span>{seatedCount} / 3</span></div>
          <OpponentTable opponents={opponents} activeSeat={activeSeat} onSelect={selectSeat} onAssign={assign} />
          <div className="seat-edit-line">
            <div><strong>Editing {position.label}</strong><span>{position.hint}</span></div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!opponents[activeSeat - 1]}
              aria-label={`Clear ${position.label} seat`}
              onClick={() => {
                clearOpponent(activeSeat);
                setNotice(`${position.label} seat cleared. The other seats have not moved.`);
              }}
            >Clear seat</button>
          </div>
          <p className="assignment-status" role="status" aria-live="polite">{notice}</p>
          <details className="seating-extras">
            <summary>Quick tables & seating tips</summary>
            <p className="seating-tip">Already seated? Choosing that character swaps them into the selected seat. You can also drag a card onto the table.</p>
            <div className="quick-tables">
              <span className="section-eyebrow">Quick tables</span>
              <div className="quick-table-actions">
                <button type="button" className="btn btn-sm" onClick={() => quickTable('easy')}>Easy-going</button>
                <button type="button" className="btn btn-sm" onClick={() => quickTable('mixed')}>Mixed table</button>
                <button type="button" className="btn btn-sm" onClick={() => quickTable('hard')}>Boss table</button>
                <button type="button" className="btn btn-sm special-preset" onClick={() => quickTable('special')}>Special table</button>
              </div>
              <button type="button" className="reset-table" onClick={() => {
                setOpponents(DEFAULT_OPPONENTS);
                setNotice('Default table restored: Ichiban right, Kiryu across, Date left.');
              }}>Restore default table</button>
            </div>
          </details>
        </aside>

        <section className="roster-section" aria-label="Character roster">
          <div className="roster-toolbar">
            <div className="roster-target">
              <span className="section-eyebrow">02 / Choose for {position.label}</span>
              <div className="seat-shortcuts" role="group" aria-label="Assignment seat">
                {OPPONENT_POSITIONS.map(({ seat, label }) => (
                  <button type="button" key={seat} aria-label={`Assign to ${label}`}
                    aria-pressed={activeSeat === seat} className={activeSeat === seat ? 'on' : ''}
                    onClick={() => selectSeat(seat)}>{label}</button>
                ))}
              </div>
            </div>
            <label className="roster-search">
              <span className="sr-only">Find a character</span>
              <span aria-hidden="true">⌕</span>
              <input type="search" placeholder="Find a character or style…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <div className="roster-filters" role="group" aria-label="Difficulty filter">
              {(['all', ...CATEGORIES] as const).map((level) => (
                <button type="button" key={level} className={filter === level ? 'on' : ''}
                  aria-pressed={filter === level} onClick={() => setFilter(level)}>
                  {level === 'all' ? 'All' : DIFFICULTY_LABEL[level]}
                  <span>{level === 'all' ? PERSONALITIES.length : PERSONALITIES.filter((p) => rosterDifficulty(p) === level).length}</span>
                </button>
              ))}
            </div>
          </div>
          {filter === 'special' && <div className="special-roster-note">
            <strong>Different rules. Not a harder tier.</strong>
            <span>Estimated difficulty is in each description. Gimmicks stay active at every practice level.</span>
          </div>}
          <div className="roster">
            {roster.map((p) => {
              const category = rosterDifficulty(p);
              const assigned = opponents.indexOf(p.id);
              const here = assigned === activeSeat - 1;
              const action = here ? 'Seated here' : assigned >= 0 ? `Swap to ${position.label}` : `Place at ${position.label}`;
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`roster-card${p.special ? ' special-card' : ''}${assigned >= 0 ? ' seated' : ''}${here ? ' on' : ''}`}
                  aria-label={`${p.name} — ${action}. ${DIFFICULTY_LABEL[category]} ${ARCHETYPE_LABEL[p.archetype]}`}
                  aria-describedby={`style-${p.id}${p.special ? ` special-${p.id}` : ''}`}
                  aria-pressed={here}
                  onClick={() => assign(activeSeat, p.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(OPPONENT_DRAG_TYPE, p.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <span className="roster-card-head">
                    <span className={`character-mark arch-${p.archetype}`} aria-hidden="true">{p.shortName.slice(0, 2).toUpperCase()}</span>
                    <span className="character-heading"><span className="who">{p.name}</span><span className="character-title">{p.title}</span></span>
                    <span className={`level level-${category}`}>{DIFFICULTY_LABEL[category]}</span>
                  </span>
                  {p.special && <SpecialDescription special={p.special} id={`special-${p.id}`} />}
                  <span className="tag" id={`style-${p.id}`}>{p.tagline}</span>
                  <span className="roster-tell"><strong>Read:</strong> {p.tell}</span>
                  <span className="roster-card-foot">
                    <span className={`arch arch-${p.archetype}`}><span className="jp" aria-hidden="true">{ARCHETYPE_KANJI[p.archetype]}</span> {ARCHETYPE_LABEL[p.archetype]}</span>
                    <span className="seat-tag">{assigned >= 0 ? `✓ ${OPPONENT_POSITIONS[assigned].label}` : action}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {roster.length === 0 && <div className="roster-empty card">
            <h3>No characters found</h3><p>Try a different name or difficulty.</p>
            <button className="btn btn-sm" onClick={() => { setSearch(''); setFilter('all'); }}>Show everyone</button>
          </div>}
          <p className="roster-disclaimer">Fan-made Yakuza / Like a Dragon matchups. Playing styles and native levels are imagined for this trainer; table settings can override levels. All bots use public information only.</p>
        </section>
      </div>
      </div>

      <div className="start-bar roster-start">
        <span>{seatedCount === 3 ? 'Your table is ready' : `${3 - seatedCount} empty ${seatedCount === 2 ? 'seat' : 'seats'}`}</span>
        <button className="btn btn-primary" disabled={seatedCount !== 3} onClick={() => go('settings')}>
          {seatedCount === 3 ? 'Table settings →' : 'Fill all three seats to continue'}
        </button>
      </div>
    </div>
  );
}
