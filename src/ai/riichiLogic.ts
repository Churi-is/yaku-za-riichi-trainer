/**
 * Riichi declaration timing. Closed tenpai only (the engine only offers the
 * `riichi` flag on legal discards). Gated by riichiPatience, wait quality,
 * hand value, lateness, and table threat. Aggressive declares instantly;
 * defensive/balanced may hold dama for a better wait, more value, or safety.
 */
import type { PublicView } from '@engine/types';
import type { AIParams } from './types';
import { Rng } from './rng';
import {
  waits,
  ukeireAcceptance,
  estimateHan,
  isHandClosed,
  doraCount,
} from './handEval';
import { tableThreat } from './defense';

export interface RiichiEval {
  riichi: boolean;
  rationale: string;
}

/**
 * Decide whether to declare riichi on the current (closed, tenpai) hand.
 * The legal discard has already been chosen; this only sets the riichi flag.
 */
export function shouldRiichi(
  view: PublicView,
  params: AIParams,
  rng: Rng,
): RiichiEval {
  const seat = view.seats[view.viewer];

  // Engine only offers riichi to closed hands; double-guard here.
  if (!isHandClosed(seat.melds)) return { riichi: false, rationale: 'open hand' };

  // Must actually be tenpai (the engine guarantees this when riichi is legal).
  const waitKinds = waits(view.hand, seat.melds);
  if (waitKinds.length === 0) return { riichi: false, rationale: 'not tenpai' };

  const threat = tableThreat(view);

  // If someone is already riichi and we're the careful type, riichi commits
  // us to pushing; fold-prone archetypes lean away unless aggressive.
  const someoneRiichi = threat.level >= 0.85;

  const acceptance = ukeireAcceptance(view.hand, seat.melds, view.visibleCounts);
  const wideWait = acceptance.tiles;

  const value = estimateHan(view.hand, seat.melds, {
    seatWind: seat.seatWind,
    roundWind: view.roundWind,
    kuitan: view.settings.kuitan,
    riichi: false,
    doubleRiichi: false,
    tsumo: false,
    doraIndicators: view.doraIndicators,
    redDora: view.settings.redDora,
  });
  const dora = doraCount(view.hand, seat.melds, view.doraIndicators, view.settings.redDora);

  // Patience is the core axis: low patience (aggressive) → always declare.
  let p = 1 - params.riichiPatience;

  // Wide waits want riichi (locked in, ippatsu/ura upside); narrow waits prefer
  // to wait for a better shape — but only patient bots can afford to.
  if (wideWait >= 14) p += 0.18;
  else if (wideWait <= 6) p -= 0.28;

  // High-value hands lean dama when patient (already big, no need for the
  // stick and the forced push); low-value hands want riichi's han.
  if (value >= 4 || dora >= 3) p -= 0.15;
  if (value === 0) p += 0.2;

  // Late game: riichi only leaves a few draws but blocks folding.
  const late = 1 - Math.min(1, view.tilesRemaining / 40);
  p -= late * 0.2;

  // Declared threat: careful archetypes avoid riichi (forced push).
  if (someoneRiichi) p -= 0.35 * (params.riichiPatience + 0.3);

  // Aggressive archetype nearly always declares regardless of above.
  if (params.defenseThreshold > 0.7) p = Math.max(p, 0.9);

  p = Math.max(0.05, Math.min(0.98, p));
  const riichi = rng.chance(p);
  return {
    riichi,
    rationale: riichi
      ? `riichi (p=${p.toFixed(2)}, wait ${wideWait}, han ${value})`
      : `dama (p=${p.toFixed(2)}, wait ${wideWait}, han ${value})`,
  };
}
