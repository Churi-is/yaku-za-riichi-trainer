/**
 * Riichi declaration timing. Closed tenpai only (the engine only offers the
 * `riichi` flag on legal discards).
 *
 * Riichi is the DEFAULT: for a closed tenpai hand it is worth about a han and
 * a third once ippatsu and ura are counted, so the question is what would stop
 * us, not whether to bother. Each reason to hold dama is named and checked;
 * patience decides which of them a given archetype actually respects.
 */
import type { PublicView } from '@engine/types';
import type { AIParams } from './types';
import type { TileId } from '@engine/types';
import { Rng } from './rng';
import {
  waits,
  ukeireAcceptance,
  estimateHan,
  isHandClosed,
  doraCount,
  ownTiles,
  kindOf,
} from './handEval';
import { tableThreat } from './defense';

export interface RiichiEval {
  riichi: boolean;
  rationale: string;
}

/**
 * Decide whether to declare riichi on the current (closed, tenpai) hand.
 * `discardTile` is the tile chosen to discard; the riichi is evaluated on the
 * resulting tenpai waiting hand. Called only when the engine offers a riichi
 * discard, so the hand is closed and the discard leaves it tenpai.
 */
export function shouldRiichi(
  view: PublicView,
  params: AIParams,
  rng: Rng,
  discardTile: TileId,
): RiichiEval {
  const seat = view.seats[view.viewer];

  // Engine only offers riichi to closed hands; double-guard here.
  if (!isHandClosed(seat.melds)) return { riichi: false, rationale: 'open hand' };

  // The tenpai waiting hand after the riichi discard.
  const dk = kindOf(discardTile);
  let removed = false;
  const waiting = ownTiles(view).filter((t) => {
    if (!removed && kindOf(t) === dk) {
      removed = true;
      return false;
    }
    return true;
  });

  const waitKinds = waits(waiting, seat.melds);
  if (waitKinds.length === 0) return { riichi: false, rationale: 'not tenpai' };

  const threat = tableThreat(view);

  // If someone is already riichi and we're the careful type, riichi commits
  // us to pushing; fold-prone archetypes lean away unless aggressive.
  const someoneRiichi = threat.level >= 0.85;

  const acceptance = ukeireAcceptance(waiting, seat.melds, view.visibleCounts);
  const wideWait = acceptance.tiles;

  const value = estimateHan(waiting, seat.melds, {
    seatWind: seat.seatWind,
    roundWind: view.roundWind,
    kuitan: view.settings.kuitan,
    riichi: false,
    doubleRiichi: false,
    tsumo: false,
    doraIndicators: view.doraIndicators,
    redDora: view.settings.redDora,
  });
  const dora = doraCount(waiting, seat.melds, view.doraIndicators, view.settings.redDora);

  // ---- the decision ------------------------------------------------------
  // Riichi is the default for a closed tenpai hand. It is worth roughly a han
  // and a third once ippatsu and ura are priced in, it denies information to
  // nobody but ourselves, and the alternative — dama — only pays when the hand
  // is already big or the wait is hopeless. So this asks what would stop us,
  // not whether to bother.
  let reason = '';
  let decline = false;

  // A hand that is already worth a lot does not need the stick, and dama keeps
  // the option of folding. Only patient archetypes actually take that option.
  if ((value >= 4 || dora >= 3) && params.riichiPatience >= 0.45 && wideWait <= 8) {
    decline = true;
    reason = 'dama: already valuable, narrow wait';
  }

  // A wait nobody will ever deal into, late, is not worth locking the hand.
  if (!decline && wideWait <= 3 && view.tilesRemaining < 30) {
    decline = true;
    reason = 'dama: dead wait, late';
  }

  // Somebody else is committed. Pushing a cheap hand on a thin wait into a
  // declared riichi is how careful players lose their stack.
  if (!decline && someoneRiichi && params.riichiPatience >= 0.45 && value <= 1 && wideWait <= 8) {
    decline = true;
    reason = 'dama: cheap hand into a live riichi';
  }

  // Riichi in the last go-around buys almost no draws but forfeits folding.
  if (!decline && view.tilesRemaining < 8) {
    decline = true;
    reason = 'dama: no draws left to win on';
  }

  // The aggressive archetype declares regardless of all of the above.
  if (params.archetype === 'aggressive') {
    decline = false;
    reason = '';
  }

  // Difficulty noise: a bot that never errs is not a character. The flip is a
  // mistake, applied to a decision, rather than the decision itself being a
  // dice roll re-thrown every turn.
  let riichi = !decline;
  if (rng.chance(params.efficiencyNoise * 0.5)) riichi = !riichi;

  return {
    riichi,
    rationale: riichi
      ? `riichi (wait ${wideWait}, han ${value}, dora ${dora})`
      : `${reason || 'dama'} (wait ${wideWait}, han ${value})`,
  };
}
