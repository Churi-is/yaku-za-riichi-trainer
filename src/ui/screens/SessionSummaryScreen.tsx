/** SessionSummaryScreen — end-of-match stats. Owned by Worker D. */
import { useMemo } from 'react';
import { useSession } from '@state/session';
import { gradeMatch } from '@state/analysisAdapter';
import { computeSummary } from '@replay/summary';
import type { Grade } from '@analysis/types';

const GRADES: Grade[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Blunder'];
const GRADE_COLOR: Record<Grade, string> = {
  Excellent: '#22c55e', Good: '#4ade80', Fair: '#fcd34d', Poor: '#fb923c', Blunder: '#ef4444',
};

export default function SessionSummaryScreen() {
  const go = useSession((s) => s.go);
  const matchLog = useSession((s) => s.matchLog);

  const summary = useMemo(() => {
    if (!matchLog) return null;
    const entries = matchLog.hands.flatMap((h) => h.entries);
    const graded = gradeMatch(entries);
    return computeSummary(matchLog, graded);
  }, [matchLog]);

  if (!matchLog || !summary) {
    return (
      <div className="screen stack">
        <div className="screen-head"><h1>Session Summary</h1></div>
        <p className="muted">No match recorded yet.</p>
        <button className="btn btn-primary" onClick={() => go('menu')}>Back to menu</button>
      </div>
    );
  }

  const totalGraded = GRADES.reduce((s, g) => s + summary.gradeDistribution[g], 0);
  const waitPct = summary.waitGuessAccuracy.attempted > 0
    ? Math.round((summary.waitGuessAccuracy.correct / summary.waitGuessAccuracy.attempted) * 100)
    : null;

  return (
    <div className="screen stack">
      <div className="screen-head">
        <h1>Session Summary<span className="kan jp">戦績</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('menu')}>Menu</button>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="num">{summary.handsPlayed}</div><div className="lbl">Hands played</div></div>
        <div className="stat"><div className="num">{summary.wins}</div><div className="lbl">Wins</div></div>
        <div className="stat"><div className="num">{ordinal(summary.placement)}</div><div className="lbl">Placement</div></div>
        <div className="stat"><div className="num">{summary.finalPoints.toLocaleString()}</div><div className="lbl">Final points</div></div>
        <div className="stat">
          <div className="num">{waitPct === null ? '—' : `${waitPct}%`}</div>
          <div className="lbl">Wait-guess accuracy{summary.waitGuessAccuracy.attempted > 0 ? ` (${summary.waitGuessAccuracy.correct}/${summary.waitGuessAccuracy.attempted})` : ''}</div>
        </div>
      </div>

      <div className="card stack">
        <h3>Grade distribution</h3>
        {totalGraded === 0 && <p className="muted">No graded turns.</p>}
        {GRADES.map((g) => {
          const n = summary.gradeDistribution[g];
          const pct = totalGraded ? (n / totalGraded) * 100 : 0;
          return (
            <div className="bar-row" key={g}>
              <span className="bar-label">{g}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: GRADE_COLOR[g] }} /></div>
              <span className="metric">{n}</span>
            </div>
          );
        })}
      </div>

      <div className="card stack">
        <h3>Yaku won with</h3>
        {summary.yakuWon.length === 0 && <p className="muted">No winning hands this match.</p>}
        <div className="rules-summary">
          {summary.yakuWon.map((y) => <span key={y.name} className="pill">{y.name} ×{y.count}</span>)}
        </div>
      </div>

      <div className="card stack">
        <h3>Most common mistakes</h3>
        {summary.topMistakes.length === 0 && <p className="muted">Clean match — no repeated mistake categories.</p>}
        {summary.topMistakes.map((m) => (
          <div className="bar-row" key={m.category}>
            <span className="bar-label" style={{ width: 140 }}>{m.category}</span>
            <span className="metric">{m.count}</span>
          </div>
        ))}
      </div>

      <div className="row">
        <button className="btn" onClick={() => go('replay')}>← Back to replay</button>
        <button className="btn btn-primary" onClick={() => go('settings')}>New match</button>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  return ['—', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
}
