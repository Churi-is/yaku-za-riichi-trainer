/** TableSettingsScreen — rule selection before every match. Owned by Worker D. */
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
  label, hint, value, options, onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { v: T; l: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  const activeHint = options.find((o) => o.v === value)?.hint;
  return (
    <div className="setting-row seg-row">
      <span className="lab">
        {label}
        {(hint || activeHint) && <span className="hint">{activeHint ?? hint}</span>}
      </span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={value === o.v ? 'on' : ''}
            aria-pressed={value === o.v}
            title={o.hint}
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
    `Opponents: ${s.difficulty[0].toUpperCase()}${s.difficulty.slice(1)}`,
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
    <div className="screen screen-narrow">
      <div className="screen-head">
        <h1>Table Settings<span className="kan jp">ルール</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('opponents')}>← Opponents</button>
      </div>

      <div className="screen-body stack">
      <div className="card">
        <div className="settings-grid">
          <div>
            <Toggle
              label="Red fives"
              hint="One red five per suit; each one drawn counts as one bonus han"
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
              options={[
                { v: 'east', l: 'East only', hint: 'East round: about 4 hands · ~15 minutes' },
                { v: 'hanchan', l: 'Hanchan', hint: 'East + South rounds: about 8 hands · ~30 minutes' },
              ]}
              onChange={(v) => setSettings({ gameLength: v })}
            />
            <Segmented<Difficulty>
              label="Opponent difficulty"
              value={settings.difficulty}
              options={[
                { v: 'easy', l: 'Easy', hint: 'Bots overcall, rarely fold, and play with readable mistakes' },
                { v: 'normal', l: 'Normal', hint: 'Competent efficiency and defense, with small errors' },
                { v: 'hard', l: 'Hard', hint: 'Tight suji defense, sharp riichi timing, and subtle tells' },
              ]}
              onChange={(v) => setSettings({ difficulty: v })}
            />
          </div>
        </div>
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
      </div>

      <div className="start-bar">
        <button className="btn btn-primary" onClick={startMatch}>Start Match</button>
      </div>
    </div>
  );
}
