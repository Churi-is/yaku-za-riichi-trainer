/**
 * analysis/grading — Worker C. Replay turn grading.
 *
 * Grades EVERY human action from the recorded log. Each entry carries the
 * PublicView from the human seat immediately before the action, so grading
 * reruns exactly the analysis the overlays show — the same yaku advisor, the
 * same opponent risk estimates, the same safety tables. That is what keeps
 * the live hints and post-game grades consistent (one analysis module, two
 * disclosure policies).
 *
 * Replay-only: alternatives and concrete tile advice live here and are never
 * surfaced during live play. Grading judges only what was knowable from the
 * public view — a correct push that happens to deal in is not a Blunder.
 */
import type { ActionLogEntry } from '@replay/types';
import type { Action, Meld, PublicView, TileId } from '@engine/types';
import type {
  AlternativeAction, Grade, GradedTurn, MistakeCategory,
} from './types';
import { FAST_BUDGET, yakuAdvisor } from './yakuAdvisor';
import { readOpponents } from './opponentRead';
import { safeKindsFor } from './tileSafety';
import { computeShanten, computeUkeire, computeUkeireWaiting } from './shanten';
import { computeWaits } from './waits';
import { countsFromIds, fullHand, kindLabel, kindOf, suitOfKind } from './tileUtil';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function gradeMatch(log: ActionLogEntry[]): GradedTurn[] {
  const out: GradedTurn[] = [];
  const byHand = new Map<number, ActionLogEntry[]>();
  for (const e of log) {
    const list = byHand.get(e.handId) ?? [];
    list.push(e);
    byHand.set(e.handId, list);
  }
  for (const entries of byHand.values()) {
    const sorted = [...entries].sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      if (entry.seat !== 0) continue;
      const next = sorted[i + 1] ?? null;
      out.push(gradeTurn(entry, next));
    }
  }
  return out.sort((a, b) => a.handId - b.handId || a.turnNumber - b.turnNumber);
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function gradeTurn(entry: ActionLogEntry, next?: ActionLogEntry | null): GradedTurn {
  const view = entry.viewBefore;
  if (!view) {
    return {
      handId: entry.handId,
      turnNumber: entry.seq,
      actionLabel: actionLabel(entry),
      grade: 'Fair', category: 'none',
      explanation: 'No public view was recorded for this action, so it cannot be judged.',
      alternatives: [],
      shantenBefore: 0, shantenAfter: 0, ukeireBefore: 0, ukeireAfter: 0,
    };
  }

  const a = entry.action;
  switch (a.type) {
    case 'discard':
      return a.riichi
        ? gradeRiichiDiscard(entry, view)
        : gradeDiscard(entry, view);
    case 'chi':
    case 'pon':
    case 'minkan':
      return gradeCall(entry, view);
    case 'kakan':
    case 'ankan':
      return gradeKan(entry, view);
    case 'pass':
      return gradePass(entry, view, next ?? null);
    case 'ron':
    case 'tsumo':
      return {
        handId: entry.handId,
        turnNumber: entry.seq,
        actionLabel: a.type === 'ron' ? 'Ron — won' : 'Tsumo — won',
        grade: 'Excellent', category: 'none',
        explanation: 'Won the hand — the strongest possible outcome this turn.',
        alternatives: [],
        shantenBefore: -1, shantenAfter: -1, ukeireBefore: 0, ukeireAfter: 0,
      };
    case 'draw':
      return gradeDraw(entry, view, next ?? null);
  }
}

/** Narrowed action by type — returns null when the action isn't that type. */
function asAction<T extends Action['type']>(
  entry: ActionLogEntry, type: T,
): Extract<Action, { type: T }> | null {
  return entry.action.type === type ? entry.action as Extract<Action, { type: T }> : null;
}

// --- discards ---------------------------------------------------------------

function gradeDiscard(entry: ActionLogEntry, view: PublicView): GradedTurn {
  const action = asAction(entry, 'discard');
  if (!action) throw new Error('gradeDiscard called on a non-discard');
  const discardedKind = kindOf(action.tile);
  const melds = view.seats[0].melds;
  const full = fullHand(view.hand, view.drawnTile);
  const beforeShanten = computeShanten(full, melds);
  const afterFull = full.filter((t) => t !== action.tile);
  const afterShanten = computeShanten(afterFull, melds);

  const alts = listAlternatives(full, view);
  // Compare ukeire only among alternatives at the best achievable shanten —
  // an option that costs a shanten step is never a comparable "better option".
  const bestShanten = alts.length > 0 ? Math.min(...alts.map((a) => a.shanten)) : afterShanten;
  const bestUkeire = alts.length > 0
    ? Math.max(...alts.filter((a) => a.shanten === bestShanten).map((a) => a.ukeire))
    : 0;
  const chosen = alts.find((a) => a.kind === discardedKind);
  const ukeireAfter = chosen?.ukeire ?? ukeireSum(computeUkeire(afterFull, melds, view.visibleCounts));

  let score = 45;
  let category: MistakeCategory = 'efficiency';
  const reasons: string[] = [];

  const shantenDelta = afterShanten - beforeShanten;
  if (shantenDelta < 0) { score += 28; reasons.push('the discard improved shanten'); }
  else if (shantenDelta === 0) { score += 12; }
  else {
    score -= 32;
    reasons.push(`the discard cost a shanten step (${beforeShanten} → ${afterShanten})`);
  }

  const ukeireRatio = bestUkeire > 0 ? ukeireAfter / bestUkeire : 1;
  if (ukeireRatio >= 0.95) score += 14;
  else if (ukeireRatio >= 0.75) score += 6;
  else if (ukeireRatio < 0.4) { score -= 10; reasons.push('a tile with notably better ukeire was available'); }

  const valueDelta = valueDeltaFor(full, afterFull, view);
  if (valueDelta < 0) {
    score -= 10;
    category = 'valueVsSpeed';
    reasons.push('the discard damages the hand\u2019s yaku direction');
  }

  const danger = dangerAssessment(view, discardedKind, afterShanten);
  if (danger.level === 'High' && danger.handWeak) {
    score -= 26;
    category = 'pushFold';
    reasons.push(`discarding ${kindLabel(discardedKind)} is unsafe against ${danger.against}`);
  } else if (danger.level === 'Medium' && danger.handWeak) {
    score -= 8;
    category = 'pushFold';
  }

  if (afterShanten === 0 && computeWaits(afterFull, melds).length >= 2) {
    reasons.push('the hand is tenpai — a riichi or dama wait is live');
  }
  // Missed opportunity: the hand was ALREADY tenpai before this discard and
  // stayed tenpai without declaring riichi. Dama can be correct (value plays,
  // multi-wait), so this is noted, not penalized.
  if (beforeShanten === 0 && afterShanten === 0) {
    reasons.push('the hand was already tenpai — the riichi/dama window was open before this discard');
    if (category === 'efficiency') category = 'missedOpportunity';
  }

  const grade = gradeOf(score);
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: `Discarded ${kindLabel(discardedKind)}`,
    grade,
    category,
    explanation: explain(grade, 'discard', reasons,
      `Shanten ${beforeShanten} → ${afterShanten}; ukeire ${ukeireAfter} of ${bestUkeire} best.`),
    alternatives: alts.map((a) => altToAlternative(a, discardedKind)),
    shantenBefore: beforeShanten,
    shantenAfter: afterShanten,
    ukeireBefore: bestUkeire,
    ukeireAfter,
  };
}

function gradeRiichiDiscard(entry: ActionLogEntry, view: PublicView): GradedTurn {
  const action = asAction(entry, 'discard');
  if (!action) throw new Error('gradeRiichiDiscard called on a non-discard');
  const melds = view.seats[0].melds;
  const full = fullHand(view.hand, view.drawnTile);
  const afterFull = full.filter((t) => t !== action.tile);
  const shantenAfter = computeShanten(afterFull, melds);
  const waitsNow = computeWaits(afterFull, melds);
  const waitCount = waitsNow.length;
  // Grading wants "is this hand worth a riichi", so it asks for the most
  // valuable REACHABLE yaku, not the most likely one — the advisor is ranked
  // by reachability, and cheap yaku are always the most reachable.
  const advisor = yakuAdvisor(view, {}, FAST_BUDGET);
  const topValue = advisor.reduce((m, s) => Math.max(m, hanPotential(s.id)), 1);
  const turnEarly = entry.seq <= 8;
  const risk = maxRisk(view);

  let score = 42;
  const reasons: string[] = [];
  let category: MistakeCategory = 'riichiTiming';

  if (shantenAfter === 0 && waitCount >= 2) { score += 20; reasons.push('tenpai with a multi-sided wait'); }
  else if (waitCount === 1) { score -= 6; reasons.push('riichi on a single wait is narrow'); }
  if (topValue >= 4) { score += 14; reasons.push('the hand carries strong value'); }
  if (turnEarly) { score += 8; reasons.push('declared early — maximum tempo advantage'); }
  if (risk === 'High') { score -= 10; reasons.push('late-game riichi against an active table'); }
  if (waitCount === 0) category = 'efficiency';

  const grade = gradeOf(score);
  const alts = listAlternatives(full, view);
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: `Riichi — discarded ${kindLabel(action.tile)}`,
    grade,
    category,
    explanation: explain(grade, 'riichi', reasons,
      `Wait shape: ${waitCount} winning kind${waitCount === 1 ? '' : 's'} (${waitsNow.map(kindLabel).join(', ') || 'none'}).`),
    alternatives: alts.map((a) => altToAlternative(a, -1)),
    shantenBefore: computeShanten(full, melds),
    shantenAfter,
    ukeireBefore: alts[0]?.ukeire ?? 0,
    ukeireAfter: ukeireSum(computeUkeire(afterFull, melds, view.visibleCounts)),
  };
}

// --- calls ------------------------------------------------------------------

function gradeCall(entry: ActionLogEntry, view: PublicView): GradedTurn {
  const action = entry.action;
  if (action.type !== 'chi' && action.type !== 'pon' && action.type !== 'minkan') {
    throw new Error('gradeCall called on a non-call');
  }
  const melds = view.seats[0].melds;
  const full = fullHand(view.hand, view.drawnTile);
  const beforeShanten = computeShanten(full, melds);
  const taken = action.type === 'chi' ? action.tiles : action.tiles;
  const afterTiles = full.filter((t) => !taken.includes(t));
  const afterMelds: Meld[] = [...melds, fakeMeld(entry, view)];
  const afterShanten = computeShanten(afterTiles, afterMelds);
  const beforeUkeire = ukeireSum(
    computeUkeireWaiting(view.hand, view.drawnTile, melds, view.visibleCounts),
  );

  let score = 40;
  const reasons: string[] = [];
  const category: MistakeCategory = 'callJudgment';

  const delta = afterShanten - beforeShanten;
  if (delta < 0) { score += 24; reasons.push('the call reduced shanten'); }
  else if (delta === 0) { score += 8; reasons.push('the call kept shanten equal'); }
  else { score -= 28; reasons.push(`the call set shanten back (${beforeShanten} → ${afterShanten})`); }

  // Yaku preservation: opening removes closed-only paths. The new view must
  // reflect the post-call hand (tiles used in the meld leave the hand) so the
  // advisor's structure counts stay honest.
  const openView: PublicView = {
    ...view,
    hand: afterTiles,
    drawnTile: null,
    seats: {
      ...view.seats,
      0: { ...view.seats[0], isClosed: false, melds: afterMelds },
    },
  };
  const openAdvisor = yakuAdvisor(openView, {}, FAST_BUDGET);
  if (openAdvisor.length === 0) {
    score -= 30;
    reasons.push('after opening, no yaku path remains — kuitan off and no honor/suit direction');
  } else {
    score += 6;
  }

  const grade = gradeOf(score);
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: `${action.type.toUpperCase()} call`,
    grade,
    category,
    explanation: explain(grade, 'call', reasons,
      `Shanten ${beforeShanten} → ${afterShanten}. The call opens the hand; closed-only yaku (pinfu, riichi, menzen) are gone.`),
    alternatives: [{
      label: 'Pass the call',
      reasoning: 'Keeping the hand closed preserves riichi/pinfu paths and stays flexible for defense.',
      score: 40 + (delta >= 0 ? 10 : 20),
    }],
    shantenBefore: beforeShanten,
    shantenAfter: afterShanten,
    ukeireBefore: beforeUkeire,
    ukeireAfter: ukeireSum(computeUkeire(afterTiles, afterMelds, view.visibleCounts)),
  };
}

function gradeKan(entry: ActionLogEntry, view: PublicView): GradedTurn {
  const melds = view.seats[0].melds;
  const full = fullHand(view.hand, view.drawnTile);
  const beforeShanten = computeShanten(full, melds);
  const afterMelds = [...melds, fakeMeld(entry, view)];
  const afterShanten = computeShanten(full, afterMelds);
  const risk = maxRisk(view);
  const openKan = entry.action.type === 'kakan' || entry.action.type === 'minkan';

  let score = 45;
  const reasons: string[] = [];
  if (afterShanten <= beforeShanten) { score += 18; reasons.push('the kan does not hurt the shape'); }
  else { score -= 18; reasons.push('the kan disrupts the hand'); }
  if (risk === 'High' && openKan) { score -= 8; reasons.push('declaring an open kan against a live danger increases exposure'); }

  const grade = gradeOf(score);
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: `${openKan ? 'Open kan' : 'Closed kan'} declared`,
    grade,
    category: entry.action.type === 'minkan' ? 'callJudgment' : 'none',
    explanation: explain(grade, 'kan', reasons,
      'A kan adds a dora indicator and an extra draw; it also exposes the hand and may cost a wait.'),
    alternatives: [],
    shantenBefore: beforeShanten,
    shantenAfter: afterShanten,
    ukeireBefore: 0,
    ukeireAfter: 0,
  };
}

function gradePass(entry: ActionLogEntry, view: PublicView, next: ActionLogEntry | null): GradedTurn {
  const reasons: string[] = [];
  const melds = view.seats[0].melds;
  const beforeShanten = computeShanten(fullHand(view.hand, view.drawnTile), melds);
  let afterShanten = beforeShanten;
  let afterUkeire = 0;
  if (next?.viewBefore) {
    const v2 = next.viewBefore;
    afterShanten = computeShanten(fullHand(v2.hand, v2.drawnTile), v2.seats[0].melds);
    afterUkeire = ukeireSum(
      computeUkeireWaiting(v2.hand, v2.drawnTile, v2.seats[0].melds, v2.visibleCounts),
    );
  }
  let score = 58;
  if (beforeShanten <= 1) { score += 8; reasons.push('the hand is already close; preserving it is sound'); }
  else { score += 4; }
  const grade = gradeOf(score);
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: 'Passed a call opportunity',
    grade,
    category: 'callJudgment',
    explanation: explain(grade, 'pass', reasons,
      'Passing keeps the hand closed and flexible. It is only an error if the call would have advanced a live yaku path.'),
    alternatives: [],
    shantenBefore: beforeShanten,
    shantenAfter: afterShanten,
    ukeireBefore: 0,
    ukeireAfter: afterUkeire,
  };
}

function gradeDraw(entry: ActionLogEntry, view: PublicView, next: ActionLogEntry | null): GradedTurn {
  const before = computeShanten(fullHand(view.hand, view.drawnTile), view.seats[0].melds);
  let after = before;
  let improved = false;
  if (next?.viewBefore) {
    const v2 = next.viewBefore;
    const s2 = computeShanten(fullHand(v2.hand, v2.drawnTile), v2.seats[0].melds);
    if (s2 < before) improved = true;
    after = s2;
  }
  let score = 52;
  if (improved) score += 12;
  if (before <= 1) score += 8;
  const grade = gradeOf(score);
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: 'Drew a tile',
    grade,
    category: 'none',
    explanation: explain(grade, 'draw', improved ? ['the draw improved the hand'] : [],
      'A draw is mostly luck; the grading watches whether the hand is progressing.'),
    alternatives: [],
    shantenBefore: before,
    shantenAfter: after,
    ukeireBefore: 0,
    ukeireAfter: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeMeld(entry: ActionLogEntry, view: PublicView): Meld {
  const a = entry.action;
  let tileIds: number[];
  let type: Meld['type'];
  let concealed = false;
  if (a.type === 'chi') {
    const called = view.lastDiscard?.tile ?? 0;
    tileIds = [...new Set([called, ...a.tiles])];
    type = 'chi';
  } else if (a.type === 'minkan') {
    const called = view.lastDiscard?.tile ?? 0;
    tileIds = [...new Set([called, ...a.tiles])].slice(0, 3);
    type = 'minkan';
  } else if (a.type === 'pon') {
    const called = view.lastDiscard?.tile ?? 0;
    tileIds = [...new Set([called, ...a.tiles])].slice(0, 3);
    type = 'pon';
  } else if (a.type === 'kakan') {
    tileIds = [a.tile];
    type = 'kakan';
  } else if (a.type === 'ankan') {
    tileIds = [a.kind * 4, a.kind * 4 + 1, a.kind * 4 + 2];
    type = 'ankan';
    concealed = true;
  } else {
    tileIds = [];
    type = 'pon';
  }
  return {
    type,
    tiles: tileIds,
    calledFrom: null,
    calledTile: a.type === 'ankan' ? null : (view.lastDiscard?.tile ?? null),
    concealed,
  };
}

interface AltCandidate {
  kind: number;
  shanten: number;
  ukeire: number;
  safe: boolean;
  valueKeep: number;
  label: string;
  reasoning: string;
}

function listAlternatives(full: TileId[], view: PublicView): AltCandidate[] {
  const melds = view.seats[0].melds;
  const seen = new Set<number>();
  const out: AltCandidate[] = [];
  const safeSet = new Set<number>([
    ...safeKindsFor(view, 1), ...safeKindsFor(view, 2), ...safeKindsFor(view, 3),
  ]);
  for (const t of full) {
    const k = kindOf(t);
    if (seen.has(k)) continue;
    seen.add(k);
    const after = full.filter((x) => x !== t);
    const shanten = computeShanten(after, melds);
    const ukeire = ukeireSum(computeUkeire(after, melds, view.visibleCounts));
    out.push({
      kind: k,
      shanten,
      ukeire,
      safe: safeSet.has(k),
      valueKeep: valueDeltaFor(full, after, view),
      label: `Discard ${kindLabel(k)}`,
      reasoning: `${shanten}-shanten, ${ukeire} ukeire${safeSet.has(k) ? ', safe classes only' : ', unproven against the table'}`,
    });
  }
  return out.sort((a, b) => scoreAlt(b) - scoreAlt(a));
}

function scoreAlt(a: AltCandidate): number {
  return a.shanten * -100 + a.ukeire * 2 + (a.safe ? 15 : 0) + a.valueKeep * 3;
}

function altToAlternative(a: AltCandidate, chosenKind: number): AlternativeAction {
  return {
    label: a.kind === chosenKind ? `${a.label} (chosen)` : a.label,
    reasoning: `${a.reasoning}.`,
    score: scoreAlt(a) / 100,
  };
}

function valueDeltaFor(full: TileId[], after: TileId[], view: PublicView): number {
  const before = countsFromIds(full);
  const post = countsFromIds(after);
  const meldSuits = new Set(view.seats[0].melds.map((m) => suitOfKind(kindOf(m.tiles[0] ?? 0))));
  let delta = 0;
  for (let k = 0; k < 34; k++) {
    if (post[k] < before[k]) {
      const b = before[k];
      if (b === 3) delta -= 3; // breaking a triplet
      if (b === 2) delta -= 1; // breaking a pair
      const suit = suitOfKind(k);
      if (meldSuits.has(suit)) delta -= 1; // diluting a melded suit
      if (k >= 31) delta -= 1; // dragons are value
    }
  }
  return delta;
}

function dangerAssessment(view: PublicView, kind: number, ownShanten: number):
  { level: 'Low' | 'Medium' | 'High'; handWeak: boolean; against: string } {
  const reads = readOpponents(view);
  let level: 'Low' | 'Medium' | 'High' = 'Low';
  const riichiSeats: string[] = [];
  for (const r of reads) {
    if (r.dealInRisk === 'High') { level = 'High'; riichiSeats.push(`seat ${r.seat + 1}`); }
    else if (r.dealInRisk === 'Medium' && level === 'Low') level = 'Medium';
  }
  const safe = safeKindsFor(view, 1).includes(kind)
    || safeKindsFor(view, 2).includes(kind)
    || safeKindsFor(view, 3).includes(kind);
  const handWeak = ownShanten >= 2;
  return { level: safe ? 'Low' : level, handWeak, against: riichiSeats.join(', ') || 'a likely tenpai seat' };
}

function maxRisk(view: PublicView): 'Low' | 'Medium' | 'High' {
  let risk: 'Low' | 'Medium' | 'High' = 'Low';
  for (const r of readOpponents(view)) {
    if (r.dealInRisk === 'High') return 'High';
    if (r.dealInRisk === 'Medium') risk = 'Medium';
  }
  return risk;
}

function hanPotential(id: string): number {
  const map: Record<string, number> = {
    riichi: 1, menzenTsumo: 1, pinfu: 1, tanyao: 1, ippatsu: 1, chankan: 1,
    haitei: 1, houtei: 1, rinshan: 1, yakuhaiHaku: 1, yakuhaiHatsu: 1,
    yakuhaiChun: 1, yakuhaiRoundWind: 1, yakuhaiSeatWind: 1,
    doubleRiichi: 2, chiitoitsu: 2, toitoi: 2, honroutou: 2,
    sanshokuDoujun: 2, ittsu: 2, chanta: 2, shousangen: 2, sanankou: 2,
    sankantsu: 2, sanshokuDoukou: 2, honitsu: 3, junchan: 3, ryanpeikou: 3,
    chinitsu: 6,
  };
  return map[id] ?? 1;
}

function ukeireSum(u: { kind: number; count: number }[]): number {
  return u.reduce((n, x) => n + x.count, 0);
}

function explain(grade: Grade, kind: string, reasons: string[], detail: string): string {
  const lead: Record<Grade, string> = {
    Excellent: 'Excellent: ',
    Good: 'Good: ',
    Fair: 'Fair: ',
    Poor: 'Poor: ',
    Blunder: 'Blunder: ',
  };
  const why = reasons.length > 0 ? reasons.join('; ') + '.' : 'No clear error found.';
  return `${lead[grade]}${kind} decision — ${why} (${detail})`;
}

export function gradeOf(score: number): Grade {
  if (score >= 86) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 54) return 'Fair';
  if (score >= 34) return 'Poor';
  return 'Blunder';
}

function actionLabel(entry: ActionLogEntry): string {
  const a = entry.action;
  switch (a.type) {
    case 'discard': return a.riichi ? 'Riichi discard' : `Discarded ${kindLabel(kindOf(a.tile))}`;
    case 'chi': case 'pon': case 'minkan': return `${a.type.toUpperCase()} call`;
    case 'kakan': return 'Added kan';
    case 'ankan': return 'Closed kan';
    case 'pass': return 'Passed';
    case 'ron': return 'Ron — won';
    case 'tsumo': return 'Tsumo — won';
    case 'draw': return 'Drew a tile';
  }
}
