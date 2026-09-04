/**
 * analysis/yakuAdvisor — Worker C. Overlay A: yaku feasibility ranking.
 *
 * PUBLIC-ONLY. Input is the player's own PublicView (own hand, melds, rivers,
 * dora, rules). Output is a ranked list of yaku with a DEFINITION (static),
 * han label (static), and an ESTIMATED probability band. The only
 * hand-dependent field is the estimate. No tile advice, no waits, no
 * "you already have X" content — that is a hard product constraint.
 */
import type { PublicView, YakuId } from '@engine/types';
import type { ProbabilityBand, YakuSuggestion } from './types';
import { YAKU_DEFS, YakuDef } from './yakuDefs';
import { computeShantenWaiting } from './shanten';
import {
  countsFromIds, fullHand, isDragonKind, isHonorKind, isSimpleKind,
  isTerminalKind, isWindKind, kindOf, suitOfKind, WIND_KIND,
} from './tileUtil';

/** Optional numeric engine floor (Worker A). Shanten at 0/1 makes riichi live. */
export type ShantenProbe = { shanten: number } | null;

export function yakuAdvisor(view: PublicView, shantenProbe?: ShantenProbe): YakuSuggestion[] {
  const hand = fullHand(view.hand, view.drawnTile);
  const melds = view.seats[0].melds;
  const open = melds.some((m) => !m.concealed);
  const closed = view.seats[0].isClosed;
  const settings = view.settings;

  // The player's whole hand is their concealed tiles plus their own melds —
  // both are public to the player, so counting both is allowed.
  const allTiles = [...hand, ...melds.flatMap((m) => m.tiles)];
  const counts = countsFromIds(allTiles);
  const totalTiles = allTiles.length;

  // Feature extraction --------------------------------------------------------
  const honorCount = allTiles.filter((t) => isHonorKind(kindOf(t))).length;
  const simpleCount = allTiles.filter((t) => isSimpleKind(kindOf(t))).length;
  const terminalCount = allTiles.filter((t) => isTerminalKind(kindOf(t))).length;
  const suitCounts: Record<string, number> = { m: 0, p: 0, s: 0 };
  for (const t of allTiles) {
    const s = suitOfKind(kindOf(t));
    if (s !== 'z') suitCounts[s]++;
  }

  const handSuit = (s: string) => suitCounts[s];
  const suits: string[] = ['m', 'p', 's'];
  const bestSuit = suits.slice().sort((a, b) => handSuit(b) - handSuit(a))[0];
  const bestSuitShare = handSuit(bestSuit) / Math.max(1, totalTiles);

  const pairKinds: number[] = [];
  const tripletKinds: number[] = [];
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 3) tripletKinds.push(k);
    else if (counts[k] === 2) pairKinds.push(k);
  }
  const dragonTripletKinds = tripletKinds.filter((k) => isDragonKind(k));
  const dragonPairKinds = pairKinds.filter((k) => isDragonKind(k));
  const windTripletKinds = tripletKinds.filter((k) => isWindKind(k));
  const windPairKinds = pairKinds.filter((k) => isWindKind(k));

  const riichiAvailable = closed && !view.seats[0].riichi && view.tilesRemaining >= 4;
  const shantenNow = shantenProbe
    ? shantenProbe.shanten
    : computeShantenWaiting(view.hand, view.drawnTile, melds);
  const nearTenpai = shantenNow <= 1;

  const candidates: { def: YakuDef; score: number; note?: string }[] = [];
  const consider = (id: YakuId, score: number, note?: string) => {
    const def = YAKU_DEFS.find((d) => d.id === id);
    if (!def) return;
    if (def.closedOnly && open) return; // impossible once open
    if (def.openOnly && !open) return;
    if (id === 'tanyao' && open && !settings.kuitan) return;
    if (settings.twoHanMinimum && def.hanClosed === 1 && !hasHanPartner(candidates, score)) {
      score *= 0.55; // single-han path devalued under 2-han minimum
    }
    candidates.push({ def, score, note });
  };

  // --- big hands first -------------------------------------------------------
  if (bestSuitShare >= 0.85) consider('chinitsu', 30 + bestSuitShare * 60, 'suit concentration');
  else if (bestSuitShare >= 0.7) consider('chinitsu', bestSuitShare * 70, 'moderate single-suit concentration');
  if (bestSuitShare >= 0.55) consider('honitsu', bestSuitShare * 90, 'dominant suit in hand + melds');
  else if (bestSuitShare >= 0.38) consider('honitsu', bestSuitShare * 70, 'some concentration but still mixed');

  // Dragons and winds
  if (dragonTripletKinds.length === 3) consider('daisangen', 99, 'all three dragon triplets present');
  if (dragonTripletKinds.length === 2 && dragonPairKinds.length >= 1) {
    consider('daisangen', 80, 'two dragon triplets plus a dragon pair');
    consider('shousangen', 95, 'two dragon triplets plus a dragon pair');
  } else if (dragonPairKinds.length >= 2) {
    consider('shousangen', 55, 'two dragon pairs');
  }
  for (const k of dragonTripletKinds) consider(dragonYakuId(k), 96, 'dragon triplet complete');
  for (const k of windTripletKinds) consider(windYakuId(k, view), 95, 'wind triplet complete');
  if (dragonPairKinds.length >= 1) consider('yakuhaiHaku', 40, 'dragon pair needs one more copy');
  if (windPairKinds.length >= 1) consider('yakuhaiRoundWind', 38, 'round/seat wind pair');

  // Toitoi / sanankou / honroutou
  const triplets = tripletKinds.length;
  if (triplets >= 4) consider('toitoi', 90 + triplets, 'four triplets built');
  else if (triplets >= 3) {
    consider('toitoi', 70 + triplets * 5, 'three triplets');
    consider('sanankou', 85 + triplets, 'three concealed-ready triplets');
  } else if (triplets >= 2) {
    consider('toitoi', 55, 'two triplets');
    consider('sanankou', 60, 'two triplets');
  }
  if (honorCount + terminalCount === totalTiles) consider('honroutou', 80, 'all tiles are terminals or honors');
  if (honorCount + terminalCount >= totalTiles - 2) consider('honroutou', 50, 'mostly terminals/honors');

  // Chiitoitsu
  if (pairKinds.length >= 6) consider('chiitoitsu', 92 + pairKinds.length, 'six or seven pairs');
  else if (pairKinds.length >= 4) consider('chiitoitsu', 55 + pairKinds.length * 5, 'several pairs');

  // Pinfu / riichi / menzen tsumo / ippatsu
  if (closed && honorCount === 0) {
    if (pairKinds.length <= 1 && nearTenpai) consider('pinfu', 78, 'closed, no honors, no value pair');
    else if (pairKinds.length <= 1) consider('pinfu', 55, 'closed, no honor tiles');
  }
  if (riichiAvailable && nearTenpai) {
    consider('riichi', 92, 'closed, near-tenpai, wall not empty');
    consider('menzenTsumo', 70, 'closed hand can win by tsumo');
    if (view.seats[0].ippatsu) consider('ippatsu', 85, 'riichi declared and no one has called');
  } else if (closed) {
    consider('menzenTsumo', 45 + (nearTenpai ? 30 : 0), 'closed hand — tsumo is always a yaku');
  }

  // Tanyao
  if (simpleCount === totalTiles && !open && honorCount === 0) consider('tanyao', 90, 'all simples');
  else if (simpleCount / Math.max(1, totalTiles) >= 0.85) consider('tanyao', 75, 'nearly all simples');
  else if (simpleCount / Math.max(1, totalTiles) >= 0.7) consider('tanyao', 50, 'mostly simples');

  // Sequences: sanshoku doujun, ittsu, chanta, junchan, ryanpeikou
  const seqs = sequenceAnalysis(hand, melds);
  if (seqs.sanshoku >= 1) consider('sanshokuDoujun', 60 + seqs.sanshoku * 15, 'same sequence in 2-3 suits');
  else if (seqs.crossRank >= 3) consider('sanshokuDoujun', 35, 'same ranks across suits');
  if (seqs.ittsu >= 1) consider('ittsu', 55 + seqs.ittsu * 20, 'almost a full 1-9 run in one suit');
  if (seqs.ryanpeikou >= 1) consider('ryanpeikou', 60 + seqs.ryanpeikou * 15, 'duplicated sequences in a closed hand');

  // Chanta / junchan via edge-tile distribution
  const edgeShare = (terminalCount + honorCount) / Math.max(1, totalTiles);
  if (edgeShare >= 0.85 && !open) consider('junchan', 55, 'all edges, no honors');
  else if (edgeShare >= 0.7) consider('junchan', 40, 'mostly edge tiles');
  if (edgeShare >= 0.7 && honorCount >= 1) consider('chanta', 50, 'every group touches a terminal or honor');
  else if (edgeShare >= 0.55) consider('chanta', 35, 'many terminal/honor tiles');

  // Sanshoku doukou
  if (tripletKinds.filter((k) => suitOfKind(k) !== 'z').length >= 3) {
    consider('sanshokuDoukou', 55, 'three same-rank triplets');
  }

  // Kans
  const kanCount = melds.filter((m) => m.type === 'ankan' || m.type === 'minkan' || m.type === 'kakan').length;
  if (kanCount >= 3) consider('sankantsu', 75 + kanCount, 'multiple kans');
  else if (kanCount >= 2) consider('sankantsu', 50, 'two kans');
  if (kanCount >= 4) consider('suukantsu', 99, 'four kans');

  // End-game conditions
  if (view.tilesRemaining <= 4) consider('haitei', 35, 'last tiles — self-draw on the final tile becomes possible');
  if (view.tilesRemaining <= 4 && !open) consider('houtei', 30, 'last tiles — the final discard is a possible ron');

  // Yakuman edges
  if (honorCount >= 11 && terminalCount === 0) consider('tsuuiisou', 60, 'all honors');
  if (terminalCount >= 11 && honorCount === 0) consider('chinroutou', 60, 'all terminals');
  if (totalTiles >= 10) {
    const uniqueEnds = new Set<number>();
    let t = 0;
    for (const tile of hand) {
      const k = kindOf(tile);
      if (isTerminalKind(k) || isHonorKind(k)) { uniqueEnds.add(k); t++; }
    }
    if (uniqueEnds.size >= 11 && t === totalTiles) consider('kokushi', 45, 'almost all thirteen orphans present');
    else if (uniqueEnds.size >= 9) consider('kokushi', 30, 'many orphan-tile kinds');
  }

  // --- scoring leftovers -----------------------------------------------------
  const scored = candidates
    .map((c) => ({ ...c, score: clampScore(c.score) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((c) => {
    const band = bandOf(c.score);
    return {
      id: c.def.id,
      name: c.def.name,
      hanLabel: c.def.hanLabel,
      description: c.def.description,
      band,
      approxPercent: Math.round(c.score / 5) * 5,
      methodNote: methodNoteFor(c.def, c.note, view, open),
    };
  });
}

function clampScore(s: number): number {
  return Math.max(2, Math.min(99, s));
}

export function bandOf(score: number): ProbabilityBand {
  if (score >= 90) return 'Very high';
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Very low';
}

function hasHanPartner(existing: { def: YakuDef; score: number; note?: string }[], score: number): boolean {
  return existing.some((c) => c.score >= 45) || score >= 45;
}



function dragonYakuId(kind: number): YakuId {
  if (kind === 31) return 'yakuhaiHaku';
  if (kind === 32) return 'yakuhaiHatsu';
  return 'yakuhaiChun';
}

function windYakuId(kind: number, view: PublicView): YakuId {
  const round = WIND_KIND[view.roundWind];
  const seat = WIND_KIND[view.seats[0].seatWind];
  if (kind === seat) return 'yakuhaiSeatWind';
  return 'yakuhaiRoundWind';
}

/** Sequence detection over the visible tiles (hand + melds), public only. */
function sequenceAnalysis(hand: number[], melds: PublicView['seats'][0]['melds']) {
  const counts = countsFromIds(hand);
  for (const m of melds) for (const t of m.tiles) counts[kindOf(t)]++;
  const baseOf = (s: string) => (s === 'm' ? 0 : s === 'p' ? 9 : 18);
  const seqAt = (s: string, r: number): number => {
    const b = baseOf(s);
    return Math.min(counts[b + r] ?? 0, counts[b + r + 1] ?? 0, counts[b + r + 2] ?? 0);
  };
  const runInSuit = (s: string, start: number, len: number): boolean => {
    const b = baseOf(s);
    for (let i = 0; i < len; i++) if ((counts[b + start + i] ?? 0) < 1) return false;
    return true;
  };

  let sanshoku = 0;   // ranks where the same sequence exists in all three suits
  let crossRank = 0;  // ranks where at least two suits hold the same sequence
  let ryanpeikou = 0; // duplicated (2+ copy) identical sequences
  for (let r = 0; r < 7; r++) {
    const present = ['m', 'p', 's'].filter((s) => seqAt(s, r) >= 1).length;
    if (present >= 3) sanshoku++;
    if (present >= 2) crossRank++;
    for (const s of ['m', 'p', 's']) {
      if (seqAt(s, r) >= 2) ryanpeikou++;
    }
  }
  let ittsu = 0;
  for (const s of ['m', 'p', 's'] as const) {
    if (runInSuit(s, 0, 9)) ittsu++;
    else if (runInSuit(s, 0, 6) && runInSuit(s, 6, 3)) ittsu++;
  }
  return { sanshoku, crossRank, ittsu, ryanpeikou };
}

function methodNoteFor(def: YakuDef, note: string | undefined, view: PublicView, open: boolean): string {
  const rules = [
    view.settings.kuitan ? 'kuitan on' : 'kuitan off',
    view.settings.twoHanMinimum ? 'two-han minimum on' : 'two-han minimum off',
  ].join(', ');
  const state = open ? 'open hand' : 'closed hand';
  const basis = note ?? 'hand structure';
  return `Estimate method: ${basis} scored against the current ${state}; remaining visible copies, meld state and the rule set (${rules}) constrain it. This is an estimate, not a guarantee.`;
}
