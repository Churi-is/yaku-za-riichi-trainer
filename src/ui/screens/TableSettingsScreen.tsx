/** TableSettingsScreen — rule selection before every match. Owned by Worker D. */
import { DIFFICULTY_LABEL, opponentDifficulty, personalityById, rosterDifficulty } from '@ai/personalities';
import { OPPONENT_POSITIONS } from '@state/opponents';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import type { Difficulty, GameLength, TableSettings } from '@engine/types';

function Toggle({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <div className="setting-row">
      <span className="lab">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
      <button
        type="button"
        className={`toggle${on ? ' on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onClick}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

function Segmented<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="setting-row seg-row">
      <span className="lab">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={value === o.v ? 'on' : ''}
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function summaryChips(s: TableSettings): string[] {
  return [
    s.redDora ? 'Red fives: on' : 'Red fives: off',
    s.kuitan ? 'Open tanyao: on' : 'Open tanyao: off',
    s.twoHanMinimum ? '2-han minimum: on' : '2-han minimum: off',
    s.gameLength === 'east' ? 'Length: East only' : 'Length: Hanchan',
    s.opponentDifficulty === 'uniform' ? `Levels: All ${DIFFICULTY_LABEL[s.difficulty]}` : 'Levels: By character',
  ];
}

export default function TableSettingsScreen() {
  const go = useSession((s) => s.go);
  const settings = useSession((s) => s.settings);
  const setSettings = useSession((s) => s.setSettings);
  const opponents = useSession((s) => s.opponents);
  const start = useMatch((s) => s.start);

  const startMatch = () => {
    start(settings, Math.floor(Math.random() * 1e9), opponents);
    go('match');
  };

  return (
    <div className="screen screen-narrow stack">
      <div className="screen-head">
        <h1>Table Settings<span className="kan jp">ルール</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('opponents')}>← Opponents</button>
      </div>

      <div className="card">
        <div className="settings-grid">
          <div>
            <Toggle
              label="Red fives (aka dora)"
              hint="One red five per suit adds bonus han"
              on={settings.redDora}
              onClick={() => setSettings({ redDora: !settings.redDora })}
            />
            <Toggle
              label="Open tanyao (kuitan)"
              hint="All-simples counts even with an open hand"
              on={settings.kuitan}
              onClick={() => setSettings({ kuitan: !settings.kuitan })}
            />
            <Toggle
              label="Two-han minimum"
              hint="Hands under 2 han cannot win"
              on={settings.twoHanMinimum}
              onClick={() => setSettings({ twoHanMinimum: !settings.twoHanMinimum })}
            />
          </div>
          <div>
            <Segmented<GameLength>
              label="Game length"
              value={settings.gameLength}
              options={[{ v: 'east', l: 'East only' }, { v: 'hanchan', l: 'Hanchan' }]}
              onChange={(v) => setSettings({ gameLength: v })}
            />
            <Segmented<'character' | 'uniform'>
              label="Opponent levels"
              value={settings.opponentDifficulty ?? 'character'}
              options={[{ v: 'character', l: 'By character' }, { v: 'uniform', l: 'Same for all' }]}
              onChange={(v) => setSettings({ opponentDifficulty: v })}
            />
            {settings.opponentDifficulty === 'uniform' && <Segmented<Difficulty>
              label="Practice difficulty"
              value={settings.difficulty}
              options={[{ v: 'easy', l: 'Easy' }, { v: 'normal', l: 'Medium' }, { v: 'hard', l: 'Hard' }]}
              onChange={(v) => setSettings({ difficulty: v })}
            />}
            <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
              {settings.opponentDifficulty === 'uniform'
                ? 'Override execution for practice. All Special rules stay active; their estimated difficulty describes the character defaults.'
                : 'Regulars use their listed level. Special opponents have estimated strength in their descriptions, not a higher difficulty tier.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Your lineup</h3>
        <div className="lineup-summary">
          {OPPONENT_POSITIONS.map(({ seat, label }) => {
            const id = opponents[seat - 1];
            const p = id ? personalityById(id) : null;
            const difficulty = p ? rosterDifficulty({ ...p, difficulty: opponentDifficulty(p, settings) }) : null;
            return <div className="lineup-seat" key={seat}>
              <span className="lineup-position">{label}</span>
              <span className="lineup-name"><strong>{p?.name ?? 'Empty seat'}</strong>
                {p?.special && <span className="lineup-estimate">Estimated difficulty: {p.special.estimatedDifficulty}</span>}
              </span>
              {difficulty && <span className={`level level-${difficulty}`}>{DIFFICULTY_LABEL[difficulty]}</span>}
            </div>;
          })}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => go('opponents')}>Edit seats & characters</button>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Current rules</h3>
        <div className="rules-summary">
          {summaryChips(settings).map((c) => <span key={c} className="pill">{c}</span>)}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          A reminder of what you selected — not a how-to. Adjust anything above before you start.
        </p>
      </div>

      <div className="start-bar">
        <button className="btn btn-primary" disabled={!opponents.every(Boolean)} onClick={startMatch}>Start Match</button>
      </div>
    </div>
  );
}
