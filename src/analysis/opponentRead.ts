/**
 * analysis/opponentRead — Worker C. Overlay B: per-opponent reading.
 *
 * PUBLIC-ONLY. Builds hand-direction signals, river cues, threat state and a
 * deal-in risk estimate for each opponent from melds + discards + riichi
 * state alone. Everything is phrased probabilistically ("possibly", "likely")
 * and every signal carries a `why` explaining the method — the tooltip is the
 * pedagogy. No hidden information is ever referenced.
 */
import type { PublicView, SeatIndex } from '@engine/types';
import type { OpponentRead, ReadSignal, RiskLevel } from './types';
import { estimateHand } from './handEstimate';
import { safetyRankingFor, safeKindsFor } from './tileSafety';
import { kindLabel, kindOf, suitOfKind } from './tileUtil';

/** Seats to read, in display order. */
const OPPONENTS: SeatIndex[] = [1, 2, 3];

export function readOpponents(view: PublicView): OpponentRead[] {
  return OPPONENTS.map((seat) => opponentRead(view, seat));
}

export function opponentRead(view: PublicView, seat: SeatIndex): OpponentRead {
  const est = estimateHand(view, seat, { late: view.tilesRemaining <= 12 });

  const handDirection: ReadSignal[] = est.directions.map((d) => ({
    text: d.name,
    why: d.detail,
  }));

  const riverCues = riverCueSignals(view, seat);
  const threat = buildThreat(view, seat, est);
  const risk = dealInRisk(view, seat, est, threat);

  const safe = safeKindsFor(view, seat).slice(0, 5);
  const dangerous = safetyRankingFor(view, seat)
    .filter((v) => v.score <= 1.5 && !safe.includes(v.kind))
    .slice(0, 5)
    .map((v) => v.kind);

  return {
    seat,
    handDirection: handDirection.slice(0, 4),
    riverCues: riverCues.slice(0, 5),
    threat,
    dealInRisk: risk.level,
    dealInRiskWhy: risk.why,
    safeTiles: safe,
    dangerTiles: dangerous,
  };
}

function riverCueSignals(view: PublicView, seat: SeatIndex): ReadSignal[] {
  const seatView = view.seats[seat];
  const river = seatView.river;
  const cues: ReadSignal[] = [];
  const cue = (text: string, why: string) => cues.push({ text, why });

  const honorDiscards = river
    .map((d, i) => ({ kind: kindOf(d.tile), turn: d.turnNumber, i }))
    .filter((d) => d.kind >= 27);

  const earlyHonors = honorDiscards.filter((d) => d.turn <= 4);
  const lateHonors = honorDiscards.filter((d) => d.turn >= 10);

  if (earlyHonors.length >= 2) {
    cue('Early honor discards — likely a fast numbered hand',
      'Honors thrown in the opening turns are usually not needed; opponents discard them first when their hand is numerical and close. Two early honors is a strong pace tell.');
  }
  if (lateHonors.length >= 1) {
    cue('Late honor discards — possibly defensive or shifting',
      'Honors held into the late game are often the hand\'s only "safe" tiles. Letting them go now can signal folding, or a wait re-build that has given up on the honor.');
  }

  const numeric = river.filter((d) => kindOf(d.tile) < 27);
  const suitTotals: Record<string, number> = { m: 0, p: 0, s: 0 };
  for (const d of numeric) suitTotals[suitOfKind(kindOf(d.tile))]++;
  const suits: string[] = ['m', 'p', 's'];
  const sorted = suits.slice().sort((a, b) => suitTotals[b] - suitTotals[a]);
  if (numeric.length >= 5 && suitTotals[sorted[0]] / numeric.length >= 0.5) {
    const s = sorted[0];
    cue(`Possible suit preference in ${s} — ${Math.round((suitTotals[s] / numeric.length) * 100)}% of number discards`,
      'Discard streams show what a hand is not using. A single suit dominating the stream is consistent with a honitsu/flush attempt in the other suits.');
  }

  // "Tightening" — the last few discards are all safe classes (honors/edge).
  const tail = river.slice(-4);
  const safeTail = tail.filter((d) => {
    const k = kindOf(d.tile);
    return k >= 27 || k % 9 === 0 || k % 9 === 8;
  }).length;
  if (tail.length >= 3 && safeTail >= 3) {
    cue('Tightening discards — possibly on defense or near-tenpai',
      'The seat\'s last discards are all honors/terminals — the safest classes. Players do this when protecting against a riichi, or when their own hand is already shaped and only needs one safe discard.');
  }

  // Dangerous-tile class mention via suji.
  const noSuji = safetyRankingFor(view, seat).filter((v) => v.tier === 'danger').slice(0, 2);
  if (noSuji.length > 0) {
    cue(`Likely dangerous tile class: ${noSuji.map((v) => kindLabel(v.kind)).join(', ')}`,
      'Why this looks dangerous: after their discards, no suji group covers these kinds — a discard from this class has no public protection and may be live.');
  }

  if (seatView.riichi) {
    cue('Riichi declared — likely a shaped hand; watch the discard tempo',
      'Riichi reveals tenpai. Every discard after riichi is (almost) safe to them, but the wait is hidden — only suji/kabe can narrow it.');
  }

  if (seatView.melds.length >= 2) {
    cue('Possibly a fast hand — multiple open melds',
      'Two or more visible melds normally means the hand is three tiles from complete. The call pattern also reveals their suit.');
  }

  return cues;
}

function buildThreat(
  view: PublicView,
  seat: SeatIndex,
  est: ReturnType<typeof estimateHand>,
): OpponentRead['threat'] {
  const seatView = view.seats[seat];
  const riichi = seatView.riichi;

  // Likely-tenpai: heuristic evidence + late hand + riichi.
  const late = view.tilesRemaining <= 12;
  const callPattern = seatView.melds.length >= 2;
  const likelyTenpai = est.likelyTenpai || (late && callPattern && seatView.river.length >= 10);

  let note: string;
  if (riichi) {
    note = 'Riichi declared: tenpai confirmed and the hand is a threat to everyone.';
  } else if (likelyTenpai) {
    note = 'Public evidence (meld count, discard tempo, late turn) suggests they may already be tenpai.';
  } else if (callPattern) {
    note = 'Open melds make an early tenpai plausible, but it is not confirmed.';
  } else {
    note = 'No strong evidence of tenpai yet; treat as developing.';
  }
  return { riichi, likelyTenpai, note };
}

function dealInRisk(
  view: PublicView,
  seat: SeatIndex,
  est: ReturnType<typeof estimateHand>,
  threat: OpponentRead['threat'],
): { level: RiskLevel; why: string } {
  const seatView = view.seats[seat];
  let score = 30;
  const reasons: string[] = [];

  if (threat.riichi) { score += 35; reasons.push('riichi confirms tenpai'); }
  if (threat.likelyTenpai) { score += 20; reasons.push('public evidence of tenpai'); }
  if (est.meldCount >= 2) score += 15;
  if (est.meldCount === 1) score += 5;
  if (view.tilesRemaining <= 12) { score += 10; reasons.push('late game — fewer safe discards remain'); }
  if (seatView.river.length >= 12 && !threat.riichi) { score += 5; }
  // A very defensive river (many honors late, low suji exposure) lowers risk.
  const lateHonorCount = seatView.river.filter((d) => d.turnNumber >= 8 && kindOf(d.tile) >= 27).length;
  const directHonors = seatView.river.filter((d) => d.tile % 4 === 0 && kindOf(d.tile) >= 27).length;
  void directHonors;
  if (lateHonorCount >= 2) { score -= 10; reasons.push('their late river is safety-oriented'); }
  if (est.open && est.meldCount === 0) score -= 5;

  const level: RiskLevel = score >= 65 ? 'High' : score >= 45 ? 'Medium' : 'Low';
  const why = reasons.length === 0
    ? 'Baseline estimate: no immediate threat signals yet. Risk rises sharply if they reach tenpai.'
    : `Estimate from ${reasons.join(', ')}. This is a heuristic — risk changes as the river grows.`;
  return { level, why };
}
