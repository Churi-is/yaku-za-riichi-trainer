/**
 * Opt-in Special opponents: different objectives, not stronger difficulty knobs.
 * The ordinary player is unchanged. These policies select only offered actions,
 * including legal passes/discards when a character deliberately declines a win.
 * PublicView is the ONLY information source; no wall, ura, or opponent hands.
 */
import { scoreHand } from '@engine/index';
import type { Action, LegalAction, PublicView, TileId } from '@engine/types';
import type { AIDecision, AIParams, SpecialStyle } from './types';
import { decideAction, shouldFold } from './player';
import { chooseDiscard } from './efficiency';
import { buildSafetyContext, dangerOf } from './defense';
import { damaValue } from './riichiLogic';
import { doraCount, evaluateDiscards, kindOf, ownTiles, shanten, waits, type DiscardEval } from './handEval';
import { racingGear } from './specialStyles';
import type { Rng } from './rng';

type DiscardAction = Extract<Action, { type: 'discard' }>;
interface Candidate {
  offer: LegalAction;
  action: DiscardAction;
  evaluation: DiscardEval;
}

const isWin = (action: Action): boolean => action.type === 'ron' || action.type === 'tsumo';
const decision = (offer: LegalAction, rationale: string): AIDecision => ({ action: offer.action, rationale });

function ordinary(view: PublicView, legal: LegalAction[], params: AIParams, rng: Rng): AIDecision {
  return decideAction(view, legal, { params, rng });
}

/** Keep physical-copy choices (including red fives) and respect kuikae. */
function discardCandidates(view: PublicView, legal: LegalAction[]): Candidate[] {
  const offers = legal.filter((l) => l.action.type === 'discard' && !l.action.riichi);
  if (!offers.length) return [];
  const byKind = new Map(evaluateDiscards(ownTiles(view), view.seats[view.viewer].melds, view.visibleCounts)
    .map((e) => [e.kind, e]));
  return offers.flatMap((offer) => {
    const action = offer.action as DiscardAction;
    const evaluation = byKind.get(kindOf(action.tile));
    return evaluation ? [{ offer, action, evaluation }] : [];
  });
}

function tileValue(view: PublicView, tile: TileId): number {
  return doraCount([tile], [], view.doraIndicators, view.settings.redDora);
}

/** The chicken actively optimizes the WRONG objective, at every practice level. */
function sabotage(view: PublicView, legal: LegalAction[]): AIDecision {
  const candidates = discardCandidates(view, legal);
  if (candidates.length) {
    const safety = buildSafetyContext(view);
    const damage = (c: Candidate) => c.evaluation.acceptance
      - tileValue(view, c.action.tile) * 8 - dangerOf(kindOf(c.action.tile), safety) * 3;
    candidates.sort((a, b) => b.evaluation.shanten - a.evaluation.shanten
      || damage(a) - damage(b) || a.action.tile - b.action.tile);
    const worst = candidates[0];
    return decision(worst.offer, `special: self-sabotage — worsen to ${worst.evaluation.shanten} shanten; discard value, not junk`);
  }
  const pass = legal.find((l) => l.action.type === 'pass');
  if (pass) return decision(pass, 'special: self-sabotage — decline the call or win');
  // Draws/forced actions must still progress the game. Never invent a pass.
  return decision(legal.find((l) => !isWin(l.action)) ?? legal[0], 'special: self-sabotage — forced legal action');
}

/**
 * Conservative, visible payout for an offered win. Unknown situational bonuses
 * and hidden ura are deliberately zero; honba and sticks do not buy a mangan.
 * This is a valuation, NOT a replacement for the engine's legal-win checks.
 */
export function publicWinPoints(view: PublicView, action: Action): number {
  if (!isWin(action)) return 0;
  const tsumo = action.type === 'tsumo';
  // During an added-kan reaction the public view may still carry the PREVIOUS
  // discard, not the offered kan tile. Do not price a win on that stale tile.
  if (!tsumo && view.lastDiscard?.from !== view.turn) return 0;
  const tile = tsumo ? view.drawnTile : view.lastDiscard?.tile;
  if (tile === null || tile === undefined) return 0;
  const seat = view.seats[view.viewer];
  const first = seat.river[0];
  // Only count double riichi when the available history proves a first-go-round,
  // uninterrupted declaration. A first discard after a call is not sufficient.
  const doubleRiichi = seat.riichi && !!first?.riichiDeclaration
    && first.turnNumber <= view.viewer && Object.values(view.seats).every((s) => s.melds.length === 0);
  return scoreHand({
    hand: tsumo ? ownTiles(view) : [...view.hand, tile], melds: seat.melds, winningTile: tile,
    isTsumo: tsumo, seatWind: seat.seatWind, roundWind: view.roundWind,
    isDealer: view.dealer === view.viewer, riichi: seat.riichi && !doubleRiichi,
    doubleRiichi, ippatsu: seat.riichi && seat.ippatsu,
    haitei: tsumo && view.tilesRemaining === 0, houtei: !tsumo && view.tilesRemaining === 0,
    rinshan: false, chankan: false, tenhou: false, chiihou: false, renhou: false,
    doraIndicators: view.doraIndicators, uraIndicators: [], settings: view.settings,
    winnerSeat: view.viewer, loserSeat: tsumo ? null : view.lastDiscard!.from, dealerSeat: view.dealer,
  }).points;
}

function shakedown(view: PublicView, legal: LegalAction[], params: AIParams, rng: Rng): AIDecision {
  const minimum = view.dealer === view.viewer ? 12000 : 8000;
  const payday = legal.find((l) => isWin(l.action) && publicWinPoints(view, l.action) >= minimum);
  if (payday) return decision(payday, 'special: shakedown — collect a visible mangan or better');
  const remaining = legal.filter((l) => !isWin(l.action));
  if (!remaining.length) return decision(legal[0], 'special: shakedown — no legal way to decline');

  // He will give up ONE shanten tier to retain a stash of at least two dora.
  // This goes beyond the ordinary value preference, but does not override a fold.
  const seat = view.seats[view.viewer];
  const pool = ownTiles(view);
  const candidates = discardCandidates(view, remaining);
  const stash = doraCount(pool, seat.melds, view.doraIndicators, view.settings.redDora);
  if (candidates.length && stash >= 2 && !shouldFold(view, params, shanten(pool, seat.melds))) {
    const best = Math.min(...candidates.map((c) => c.evaluation.shanten));
    const near = candidates.filter((c) => c.evaluation.shanten <= best + 1);
    const keepMost = Math.max(...near.map((c) => stash - tileValue(view, c.action.tile)));
    if (keepMost >= 2) {
      const preferred = new Set(near.filter((c) => stash - tileValue(view, c.action.tile) === keepMost)
        .map((c) => c.action.tile));
      const offers = remaining.filter((l) => l.action.type !== 'discard' || preferred.has(l.action.tile));
      const result = ordinary(view, offers, params, rng);
      return { ...result, rationale: `special: shakedown — protect the payday; ${result.rationale}` };
    }
  }
  const result = ordinary(view, remaining, params, rng);
  return { ...result, rationale: `special: shakedown — no small change; ${result.rationale}` };
}

/** Live tiles that could actually win by ron, not just finish a yaku-less hand. */
function ronAcceptance(view: PublicView, candidate: Candidate): number {
  const waiting = ownTiles(view).filter((tile) => tile !== candidate.action.tile);
  const kinds = waits(waiting, view.seats[view.viewer].melds);
  const river = new Set([...view.seats[view.viewer].river.map((r) => kindOf(r.tile)), kindOf(candidate.action.tile)]);
  // One furiten wait blocks ALL ron waits, even those not in our river.
  if (kinds.some((kind) => river.has(kind))) return 0;
  return kinds.reduce((n, kind) => n + (damaValue(view, waiting, [kind], candidate.action.tile) > 0
    ? Math.max(0, 4 - (view.visibleCounts[kind] ?? 0)) : 0), 0);
}

function counterOnly(view: PublicView, legal: LegalAction[], params: AIParams, rng: Rng): AIDecision {
  // Komaki will draw normally, but never declare tsumo, riichi, or any meld.
  const allowed = legal.filter(({ action: a }) => a.type === 'ron' || a.type === 'pass'
    || a.type === 'draw' || (a.type === 'discard' && !a.riichi));
  if (!allowed.length) return decision(legal[0], 'special: counter — forced legal action');
  const ron = allowed.find((l) => l.action.type === 'ron');
  if (ron) return decision(ron, 'special: Tiger Drop — take the counterattack');

  const seat = view.seats[view.viewer];
  const candidates = discardCandidates(view, allowed);
  if (candidates.length && !shouldFold(view, params, shanten(ownTiles(view), seat.melds))) {
    const ready = candidates.filter((c) => c.evaluation.shanten === 0)
      .map((c) => ({ ...c, ronTiles: ronAcceptance(view, c) }));
    const widest = Math.max(0, ...ready.map((c) => c.ronTiles));
    if (widest > 0) {
      const offers = ready.filter((c) => c.ronTiles === widest).map((c) => c.offer);
      const result = ordinary(view, offers, params, rng);
      return { ...result, rationale: `special: counter — ${widest} live ron tiles; ${result.rationale}` };
    }
    // If every ready shape is furiten/dead/yaku-less, rebuild rather than
    // endlessly discarding the winning draw and waiting for an impossible ron.
    if (ready.length) {
      const rebuilding = candidates.filter((c) => c.evaluation.shanten === 1).map((c) => c.offer);
      if (rebuilding.length) {
        const result = ordinary(view, rebuilding, params, rng);
        return { ...result, rationale: `special: counter — rebuild the ron wait; ${result.rationale}` };
      }
    }
  }
  const result = ordinary(view, allowed, params, rng);
  return { ...result, rationale: `special: counter — no calls, riichi or tsumo; ${result.rationale}` };
}

function racer(view: PublicView, legal: LegalAction[], params: AIParams, rng: Rng): AIDecision {
  const win = legal.find((l) => isWin(l.action));
  if (win) return decision(win, 'special: racer — always take the finish line');
  const gear = racingGear(view.seats[view.viewer].river.length);
  if (gear.attack) {
    const result = ordinary(view, legal, {
      ...params, archetype: 'aggressive', defenseThreshold: 1, callGreed: 1, riichiPatience: 0,
    }, rng);
    return { ...result, rationale: `special: ${gear.label} — full attack; ${result.rationale}` };
  }
  const discards = legal.filter((l) => l.action.type === 'discard' && !l.action.riichi);
  if (discards.length) {
    const tiles = discards.map((l) => (l.action as DiscardAction).tile);
    const chosen = chooseDiscard(view, params, rng, true, tiles);
    return decision(discards.find((l) => (l.action as DiscardAction).tile === chosen.tile)!, `special: ${gear.label} — safety before shape`);
  }
  return decision(legal.find((l) => l.action.type === 'pass') ?? legal[0], `special: ${gear.label} — no voluntary calls`);
}

export function decideSpecial(
  style: SpecialStyle, view: PublicView, legal: LegalAction[], params: AIParams, rng: Rng,
): AIDecision {
  // Also handles an empty legal array with the ordinary engine's explicit error.
  // A forced action always wins over a gimmick: no stalls or invented passes.
  if (legal.length <= 1) return ordinary(view, legal, params, rng);
  switch (style) {
    case 'selfSabotage': return sabotage(view, legal);
    case 'manganMinimum': return shakedown(view, legal, params, rng);
    case 'ronOnly': return counterOnly(view, legal, params, rng);
    case 'gearShift': return racer(view, legal, params, rng);
  }
}
