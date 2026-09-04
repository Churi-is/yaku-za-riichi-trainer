/**
 * Session summary computation (Worker D). Reduces a finished MatchLog (plus the
 * graded turns from @analysis) into the in-memory SessionSummary shown on the
 * final screen. Nothing here persists between sessions.
 */
import type { SeatIndex } from '@engine/types';
import type { MatchLog, SessionSummary } from './types';
import type { GradedTurn, Grade } from '@analysis/types';

const GRADES: Grade[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Blunder'];

const CATEGORY_LABELS: Record<string, string> = {
  efficiency: 'Tile efficiency',
  valueVsSpeed: 'Value vs. speed',
  callJudgment: 'Call judgment',
  riichiTiming: 'Riichi timing',
  pushFold: 'Push / fold',
  missedOpportunity: 'Missed opportunity',
  none: 'Clean play',
};

export function computeSummary(log: MatchLog, graded: GradedTurn[]): SessionSummary {
  const handsPlayed = log.hands.length;

  // Wins + yaku
  let wins = 0;
  const yakuCounts = new Map<string, number>();
  for (const hand of log.hands) {
    const r = hand.result;
    if (r.winner === 0 && r.score) {
      wins++;
      for (const y of r.score.yaku) {
        yakuCounts.set(y.name, (yakuCounts.get(y.name) ?? 0) + 1);
      }
    }
  }
  const yakuWon = [...yakuCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Placement + final points from last hand's deltas accumulated, or engine ranking
  const finalPoints = computeFinalPoints(log);
  const ranking = ([0, 1, 2, 3] as SeatIndex[]).sort((a, b) => finalPoints[b] - finalPoints[a]);
  const placement = ranking.indexOf(0) + 1;

  // Grade distribution
  const gradeDistribution = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const t of graded) gradeDistribution[t.grade] = (gradeDistribution[t.grade] ?? 0) + 1;

  // Wait-guess accuracy
  const attempted = log.waitGuesses.filter((w) => w.correct !== null).length;
  const correct = log.waitGuesses.filter((w) => w.correct === true).length;

  // Top mistakes
  const catCounts = new Map<string, number>();
  for (const t of graded) {
    if (t.category === 'none') continue;
    if (t.grade === 'Excellent' || t.grade === 'Good') continue;
    catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1);
  }
  const topMistakes = [...catCounts.entries()]
    .map(([category, count]) => ({ category: CATEGORY_LABELS[category] ?? category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    handsPlayed,
    wins,
    placement,
    finalPoints: finalPoints[0],
    yakuWon,
    gradeDistribution,
    waitGuessAccuracy: { attempted, correct },
    topMistakes,
  };
}

function computeFinalPoints(log: MatchLog): Record<SeatIndex, number> {
  // Start at 25000 and accumulate every hand's deltas.
  const pts: Record<number, number> = { 0: 25000, 1: 25000, 2: 25000, 3: 25000 };
  for (const hand of log.hands) {
    const d = hand.result.deltas;
    for (let s = 0; s < 4; s++) pts[s] += d[s as SeatIndex] ?? 0;
  }
  return pts as Record<SeatIndex, number>;
}
