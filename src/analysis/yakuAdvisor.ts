/**
 * analysis/yakuAdvisor — Overlay A: yaku feasibility ranking.
 *
 * PUBLIC-ONLY. Input is the player's own PublicView (own hand, melds, rivers,
 * dora, rules). Output is a ranked list of yaku with a DEFINITION (static), a
 * han label (static), and a MEASURED reachability. No tile advice, no waits,
 * no "you already have X" content — that is a hard product constraint.
 *
 * The estimate is not a heuristic score any more. Every number comes from
 * `yakuSim`: rollouts of the current hand against a shuffled pool of the tiles
 * the player cannot see. See that module for the method and its limits.
 *
 * Candidate selection is deliberately budget-based rather than prior-based, so
 * no hand-tuned "importance" constant can sneak back in:
 *
 *   1. play the hand for pure speed a few times and note which yaku the
 *      finished hands actually contained (discovery);
 *   2. add every direction the hand is structurally able to chase at all;
 *   3. give all of them a small number of rollouts (the scout pass) — hopeless
 *      directions abort almost immediately, so this is cheap;
 *   4. spend the rest of the budget on the survivors and report those.
 */
import type { PublicView, TileKind, YakuId } from '@engine/types';
import type { AdvisorOutcome, ProbabilityBand, YakuSuggestion } from './types';
import { YAKU_DEFS } from './yakuDefs';
import {
  DEFAULT_SIM, discoverCandidates, drawsRemaining, simulateYaku, unseenPool,
  type SimOptions,
} from './yakuSim';
import { countsFromIds, kindOf } from './tileUtil';
import { simulateFullGames, type FullGameResult } from '@sim/fullGameSim';

export interface AdvisorBudget {
  /** Speed-play runs used to discover which yaku the hand stumbles into. */
  discovery: number;
  /** Runs given to every candidate, to weed out the hopeless ones cheaply. */
  scout: number;
  /** How many survivors get the full run count. */
  finalists: number;
  /** Runs behind the numbers the player actually sees. */
  full: number;
}

/** Live overlay: tuned so a full refresh fits inside one AI turn, off-thread. */
export const ADVISOR_BUDGET: AdvisorBudget = {
  discovery: 20, scout: 16, finalists: 6, full: 60,
};

/**
 * Replay grading calls the advisor once per riichi/call turn and only needs
 * the coarse shape of the answer, so it pays a tenth of the price.
 */
export const FAST_BUDGET: AdvisorBudget = {
  discovery: 6, scout: 6, finalists: 3, full: 12,
};

/**
 * Directions the hand can physically chase. This is a LEGALITY/SUPPORT filter,
 * not a score: everything that passes gets simulated, and the simulation
 * decides what is worth showing.
 */
function structuralCandidates(view: PublicView): YakuId[] {
  const me = view.seats[view.viewer];
  const closed = me.isClosed;
  const tiles = view.drawnTile !== null ? [...view.hand, view.drawnTile] : view.hand;
  const counts = countsFromIds(tiles);
  for (const m of me.melds) for (const t of m.tiles) counts[kindOf(t)]++;

  const out: YakuId[] = ['tanyao'];
  if (closed) out.push('riichi', 'menzenTsumo', 'pinfu', 'chiitoitsu');

  let pairs = 0;
  let honors = 0;
  let edges = 0;
  const bySuit = [0, 0, 0];
  for (let k = 0; k < 34; k++) {
    const c = counts[k];
    if (!c) continue;
    if (c >= 2) pairs++;
    if (k >= 27) { honors += c; edges += c; } else {
      bySuit[Math.floor(k / 9)] += c;
      const r = k % 9;
      if (r === 0 || r === 8) edges += c;
    }
  }
  const best = Math.max(...bySuit);

  if (best >= 5) out.push('honitsu');
  if (best >= 7) out.push('chinitsu');
  if (pairs >= 2) out.push('toitoi', 'sanankou');
  if (edges >= 5) out.push('chanta');
  if (edges >= 5 && honors === 0) out.push('junchan');
  if (edges >= 8) out.push('honroutou');
  if (honors >= 9) out.push('tsuuiisou');
  out.push('ittsu', 'sanshokuDoujun', 'sanshokuDoukou'); // planFor() rejects thin support

  // Yakuhai: holding a single copy is enough support to be worth a rollout.
  const yakuhai: [TileKind, YakuId][] = [
    [31, 'yakuhaiHaku'], [32, 'yakuhaiHatsu'], [33, 'yakuhaiChun'],
  ];
  for (const [kind, id] of yakuhai) if (counts[kind] >= 1) out.push(id);
  const seatKind = 27 + ['east', 'south', 'west', 'north'].indexOf(me.seatWind);
  const roundKind = 27 + ['east', 'south', 'west', 'north'].indexOf(view.roundWind);
  if (counts[seatKind] >= 1) out.push('yakuhaiSeatWind');
  if (counts[roundKind] >= 1) out.push('yakuhaiRoundWind');
  const dragons = (counts[31] > 0 ? 1 : 0) + (counts[32] > 0 ? 1 : 0) + (counts[33] > 0 ? 1 : 0);
  if (dragons >= 2) out.push('shousangen');
  if (dragons === 3) out.push('daisangen');

  return [...new Set(out)];
}

export function yakuAdvisor(
  view: PublicView,
  opts: Partial<SimOptions> = {},
  budget: AdvisorBudget = ADVISOR_BUDGET,
): YakuSuggestion[] {
  const draws = drawsRemaining(view);
  if (draws <= 0) return [];

  // Seed from the position so the panel is stable while the hand is stable,
  // and changes only when the hand does.
  const seed = positionSeed(view);
  const base: Partial<SimOptions> = { ...opts, seed };

  const discovered = discoverCandidates(view, { ...base, runs: budget.discovery })
    .map((d) => d.id);
  const candidates = [...new Set([...discovered, ...structuralCandidates(view)])]
    .filter((id) => YAKU_DEFS.some((d) => d.id === id));

  const scouted = simulateYaku(view, candidates, { ...base, runs: budget.scout });
  const finalists = scouted
    .filter((r) => r.hits > 0)
    .slice(0, budget.finalists)
    .map((r) => r.id);

  const full = simulateYaku(view, finalists, { ...base, runs: budget.full });
  const results = full.length ? full : scouted.filter((r) => r.hits > 0);

  return results.slice(0, 5).map((r) => {
    const def = YAKU_DEFS.find((d) => d.id === r.id)!;
    return {
      id: r.id,
      name: def.name,
      hanLabel: def.hanLabel,
      description: def.description,
      band: bandOf(r.rate),
      approxPercent: Math.round(r.rate * 100),
      hits: r.hits,
      runs: r.runs,
      methodNote: methodNote(view, r.hits, r.runs, draws),
    };
  });
}

/** Bands for a real probability, not for a made-up score. */
export function bandOf(rate: number): ProbabilityBand {
  if (rate >= 0.6) return 'Very high';
  if (rate >= 0.4) return 'High';
  if (rate >= 0.2) return 'Medium';
  if (rate >= 0.08) return 'Low';
  return 'Very low';
}

/** Stable per-position seed: same hand, same numbers, no flicker. */
export function positionSeed(view: PublicView): number {
  let h = 2166136261;
  const mix = (n: number) => { h ^= n + 0x9e3779b9; h = Math.imul(h, 16777619); };
  for (const t of view.hand) mix(t);
  if (view.drawnTile !== null) mix(view.drawnTile);
  for (const s of [0, 1, 2, 3] as const) {
    mix(view.seats[s].river.length * 31);
    for (const m of view.seats[s].melds) mix(m.tiles[0]);
  }
  mix(view.tilesRemaining);
  return h >>> 0;
}

function methodNote(view: PublicView, hits: number, runs: number, draws: number): string {
  const pool = unseenPool(view).length;
  return [
    `Measured, not guessed: ${hits} of ${runs} simulated continuations reached this yaku.`,
    `Each run deals the ${pool} tiles you cannot see into a fresh random order and plays`,
    `your ${draws} remaining draws committed to this yaku, taking calls and ron when they`,
    'serve it. The engine judges the finished hand, so a yaku the rules would not award',
    'can never appear here. It measures whether the yaku is reachable if you chase it —',
    'not whether you win the hand: nobody else at the table is simulated.',
  ].join(' ');
}

export { DEFAULT_SIM };

// ---------------------------------------------------------------------------
// full-game mode
// ---------------------------------------------------------------------------

/**
 * The deep mode. Instead of asking whether a yaku is reachable if you chase
 * it, play the whole rest of the hand out — three AI opponents included — from
 * tables determinized out of the unseen pool, and report what actually
 * happened. Far slower, and it answers a different question, so the UI labels
 * it differently: these are hands that FINISHED with the yaku, against
 * opponents who were racing you.
 */
export function fullGameAdvisor(
  view: PublicView,
  runs: number,
  onProgress?: (done: number, total: number, partial: AdvisorOutcome) => void,
): AdvisorOutcome {
  const seed = positionSeed(view);
  const pack = (r: FullGameResult): AdvisorOutcome => ({
    mode: 'full',
    requested: runs,
    summary: {
      runs: r.runs, wins: r.wins, dealIns: r.dealIns, draws: r.draws,
      meanPoints: r.meanPoints,
    },
    suggestions: r.yaku
      .map((y) => {
        const def = YAKU_DEFS.find((d) => d.id === y.id);
        if (!def || r.runs === 0) return null;
        const rate = y.hits / r.runs;
        return {
          id: y.id,
          name: def.name,
          hanLabel: def.hanLabel,
          description: def.description,
          // The UI does not show a band word in this mode — see the panel —
          // but the field is part of the contract, so keep it meaningful by
          // scaling against how often the hand was won at all.
          band: bandOf(r.wins > 0 ? y.hits / r.wins : 0),
          approxPercent: Math.round(rate * 100),
          hits: y.hits,
          runs: r.runs,
          methodNote: `Out of ${r.runs} complete hands played from here — opponents `
            + 'included, dealt from the tiles you cannot see — this yaku was in the '
            + `hand you won ${y.hits} times. Unlike the quick mode this is not "can I `
            + 'reach it": it is how often the hand actually finished this way, with '
            + 'three players trying to finish first.',
        } as YakuSuggestion;
      })
      .filter((x): x is YakuSuggestion => x !== null)
      .slice(0, 5),
  });

  const result = simulateFullGames(view, {
    runs,
    seed,
    onProgress: onProgress
      ? (done, total, partial) => onProgress(done, total, pack(partial))
      : undefined,
  });
  return pack(result);
}

/** Quick mode, wrapped in the same envelope as the full-game mode. */
export function quickAdvisor(view: PublicView, runs: number): AdvisorOutcome {
  return {
    mode: 'quick',
    requested: runs,
    suggestions: yakuAdvisor(view, {}, { ...ADVISOR_BUDGET, full: runs }),
  };
}
