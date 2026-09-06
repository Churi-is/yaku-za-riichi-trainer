/**
 * Riichi declaration timing. Closed tenpai only (the engine only offers the
 * `riichi` flag on legal discards).
 *
 * Riichi is the DEFAULT: for a closed tenpai hand it is worth about a han and
 * a third once ippatsu and ura are counted, so the question is what would stop
 * us, not whether to bother. Each reason to hold dama is named and checked;
 * patience decides which of them a given archetype actually respects.
 */
import type { PublicView, SeatIndex, TileKind } from '@engine/types';
import { isLegalWin, scoreHand } from '@engine/index';
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
import { placementPressure } from './strategy';

/**
 * Conservative dama value: every live wait must be a legal ron without riichi.
 * Uses the public scorer on hypothetical completions, never a hidden draw.
 * Dora alone is NOT yaku, and a two-han minimum still applies.
 */
export function damaValue(view: PublicView, waiting: TileId[], waitKinds: TileKind[], discardTile: TileId): number {
  const seat = view.seats[view.viewer];
  const riverKinds = new Set([...seat.river.map((r) => kindOf(r.tile)), kindOf(discardTile)]);
  if (waitKinds.some((k) => riverKinds.has(k))) return 0; // permanent furiten
  const live = waitKinds.filter((k) => (view.visibleCounts[k] ?? 0) < 4);
  if (!live.length) return 0;
  const known = new Set([
    ...ownTiles(view), ...view.doraIndicators,
    ...Object.values(view.seats).flatMap((s) => [...s.river.map((r) => r.tile), ...s.melds.flatMap((m) => m.tiles)]),
  ]);
  let minimum = Infinity;
  for (const kind of live) {
    // Prefer a non-red unseen copy, so the estimate never relies on drawing red.
    const tile = [1, 2, 3, 0].map((copy) => kind * 4 + copy).find((id) => !known.has(id));
    if (tile === undefined) return 0;
    const score = scoreHand({
      hand: [...waiting, tile], melds: seat.melds, winningTile: tile,
      isTsumo: false, seatWind: seat.seatWind, roundWind: view.roundWind,
      isDealer: view.dealer === view.viewer, riichi: false, doubleRiichi: false,
      ippatsu: false, haitei: false, houtei: false, rinshan: false, chankan: false,
      tenhou: false, chiihou: false, renhou: false,
      doraIndicators: view.doraIndicators, uraIndicators: [], settings: view.settings,
      winnerSeat: view.viewer, loserSeat: ((view.viewer + 1) % 4) as SeatIndex, dealerSeat: view.dealer,
    });
    if (!isLegalWin(score, view.settings)) return 0;
    minimum = Math.min(minimum, score.points);
  }
  return minimum;
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
): boolean {
  const seat = view.seats[view.viewer];

  // Engine only offers riichi to closed hands; double-guard here.
  if (!isHandClosed(seat.melds)) return false;

  // The tenpai waiting hand after the riichi discard.
  let removed = false;
  const waiting = ownTiles(view).filter((t) => {
    if (!removed && t === discardTile) {
      removed = true;
      return false;
    }
    return true;
  });

  const waitKinds = waits(waiting, seat.melds);
  if (waitKinds.length === 0) return false;

  // If someone is already riichi and we're the careful type, riichi commits
  // us to pushing; fold-prone archetypes lean away unless aggressive.
  const someoneRiichi = Object.values(view.seats).some((s) => s.seat !== view.viewer && s.riichi);

  const acceptance = ukeireAcceptance(waiting, seat.melds, view.visibleCounts);
  const wideWait = acceptance.tiles;
  if (wideWait === 0) return false;

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
  const pressure = placementPressure(view, params);
  const dama = value >= 4 || dora >= 3 || pressure < 0 ? damaValue(view, waiting, waitKinds, discardTile) : 0;

  // ---- the decision ------------------------------------------------------
  // Riichi is the default for a closed tenpai hand. It is worth roughly a han
  // and a third once ippatsu and ura are priced in, it denies information to
  // nobody but ourselves, and the alternative — dama — only pays when the hand
  // is already big or the wait is hopeless. So this asks what would stop us,
  // not whether to bother.
  let decline = false;

  // A hand that is already worth a lot does not need the stick, and dama keeps
  // the option of folding. Only patient archetypes actually take that option.
  if (dama > 0 && (value >= 4 || dora >= 3) && params.riichiPatience >= 0.45 && wideWait <= 8) {
    decline = true;
  }

  if (!decline && pressure < -0.05 && dama > 0 && params.riichiPatience >= 0.4) {
    decline = true;
  }

  // A wait nobody will ever deal into, late, is not worth locking the hand.
  if (!decline && wideWait <= 3 && view.tilesRemaining < 30) {
    decline = true;
  }

  // Somebody else is committed. Pushing a cheap hand on a thin wait into a
  // declared riichi is how careful players lose their stack.
  if (!decline && someoneRiichi && params.riichiPatience >= 0.45 && value <= 1 && wideWait <= 8) {
    decline = true;
  }

  // Riichi in the last go-around buys almost no draws but forfeits folding.
  if (!decline && view.tilesRemaining < 8) {
    decline = true;
  }

  // The aggressive archetype declares regardless of all of the above.
  if (params.archetype === 'aggressive') {
    decline = false;
  }

  // Difficulty noise: a bot that never errs is not a character. The flip is a
  // mistake, applied to a decision, rather than the decision itself being a
  // dice roll re-thrown every turn.
  let riichi = !decline;
  if (rng.chance(params.efficiencyNoise * 0.5)) riichi = !riichi;

  return riichi;
}
