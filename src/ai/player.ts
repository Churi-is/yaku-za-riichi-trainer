/**
 * AIPlayer implementation — the single decision engine. Archetype and
 * difficulty resolve into AIParams; this module wires the decision layers
 * (efficiency, defense, calls, riichi) together.
 *
 * PUBLIC-INFORMATION FIREWALL: decide() receives a PublicView and never reads
 * anything else. It never touches hidden tiles or the full table state.
 */
import type {
  Action,
  LegalAction,
  PublicView,
  TileId,
} from '@engine/types';
import type { AIParams, Archetype } from './types';
import { Rng } from './rng';
import {
  shanten,
  isHandClosed,
  ownTiles,
  kindOf,
  ukeireAcceptance,
  doraCount,
} from './handEval';
import { tableThreat } from './defense';
import { chooseDiscard } from './efficiency';
import { chooseCall, chooseSelfKan } from './callLogic';
import { shouldRiichi } from './riichiLogic';
import { placementPressure } from './strategy';

/** What kind of decision point this is, inferred from the legal actions. */
type DecisionKind = 'win' | 'callWindow' | 'discard';

function classify(legal: LegalAction[]): DecisionKind {
  const types = legal.map((l) => l.action.type);
  if (types.includes('ron') || types.includes('tsumo')) return 'win';
  // A reaction window on someone else's discard: only calls / pass (and ron,
  // already handled). The absence of a discard action marks it as such.
  if (
    types.includes('pon') ||
    types.includes('chi') ||
    types.includes('minkan') ||
    (types.includes('pass') && !types.includes('discard'))
  ) {
    return 'callWindow';
  }
  return 'discard';
}

/**
 * Push or fold.
 *
 * The threat model is effectively binary in practice — it reads ~0.2 with
 * nobody committed and ~1.0 the moment somebody declares riichi — so a flat
 * "fold when threat exceeds my threshold" made every non-aggressive bot drop
 * its hand the instant anyone riichi'd, tenpai or not. That is how half the
 * hands ended in an exhaustive draw.
 *
 * What decides a real push is the hand you are holding against the danger, so
 * the threshold now rises with how much is at stake: how close to complete,
 * how much it pays, and whether the noten penalty is about to land.
 */
export function shouldFold(
  view: PublicView, params: AIParams, ownShanten: number,
): boolean {
  const threat = tableThreat(view).level;
  const seat = view.seats[view.viewer];
  const drawsLeft = Math.ceil(view.tilesRemaining / 4);

  // At the death, tenpai is money in hand: folding out of it pays the noten
  // penalty for nothing.
  if (ownShanten <= 0 && drawsLeft <= 2) return false;

  // A hand one tile away is worth pushing; a hand three away is worth nothing.
  const shape = ownShanten <= 0 ? 0.5 : ownShanten === 1 ? 0.2 : 0;

  // Value: dora and red fives are what make a push profitable. Cheap tenpai
  // into a live riichi is the one a careful player still drops.
  const dora = doraCount(
    ownTiles(view), seat.melds, view.doraIndicators, view.settings.redDora,
  );
  const value = Math.min(0.25, dora * 0.08);

  // Late tenpai is worth more than early tenpai: fewer draws for the opponent
  // to find their tile, and the penalty is closer.
  const late = ownShanten <= 0 && drawsLeft <= 4 ? 0.2 : 0;

  // Aggressive archetype: an extra willingness to deal in. Read from the
  // archetype itself, not guessed from a derived threshold.
  const aggression = params.archetype === 'aggressive' ? 0.2 : 0;

  const dealer = view.dealer === view.viewer && ownShanten <= 1 ? params.placementAwareness * 0.1 : 0;
  const threshold = params.defenseThreshold + shape + value + late + aggression
    + dealer + placementPressure(view, params);
  return threat >= threshold;
}

/**
 * Among the tiles the engine will let us riichi on, the one that leaves the
 * widest wait. Ties go to the tile we would least like to keep.
 */
function bestRiichiDiscard(
  view: PublicView,
  offers: LegalAction[],
): { action: Action; tile: TileId } | null {
  const seat = view.seats[view.viewer];
  const pool = ownTiles(view);
  let best: { action: Action; tile: TileId; width: number } | null = null;
  for (const offer of offers) {
    if (offer.action.type !== 'discard') continue;
    const tile = offer.action.tile;
    let removed = false;
    const waiting = pool.filter((t) => {
      if (!removed && t === tile) { removed = true; return false; }
      return true;
    });
    const width = ukeireAcceptance(waiting, seat.melds, view.visibleCounts).tiles;
    if (!best || width > best.width) best = { action: offer.action, tile, width };
  }
  return best ? { action: best.action, tile: best.tile } : null;
}

function actionOfType(legal: LegalAction[], type: Action['type']): LegalAction | undefined {
  return legal.find((l) => l.action.type === type);
}

function passAction(legal: LegalAction[]): LegalAction | undefined {
  return actionOfType(legal, 'pass');
}

export interface DecideContext {
  params: AIParams;
  archetype: Archetype;
  rng: Rng;
}

/** Core decision: given a public view and legal actions, pick one. */
export function decideAction(
  view: PublicView,
  legal: LegalAction[],
  ctx: DecideContext,
): { action: Action; rationale: string } {
  const { params, rng } = ctx;
  if (legal.length === 0) {
    throw new Error('AI: no legal actions available');
  }

  if (legal.length === 1) return { action: legal[0].action, rationale: 'only legal action' };
  const kind = classify(legal);

  // 1) Win — always take ron/tsumo (declines are off by default). A winning
  // action is returned no matter what the surrounding window looks like.
  const win = actionOfType(legal, 'ron') ?? actionOfType(legal, 'tsumo');
  if (win) return { action: win.action, rationale: 'win' };

  // 2) Reaction window on another seat's discard: take a call or pass. Never
  // emit a discard — no discard action exists in this window.
  if (kind === 'callWindow') {
    const ownShanten = shanten(view.hand, view.seats[view.viewer].melds);
    const folding = shouldFold(view, params, ownShanten);
    if (folding) {
      const pass = passAction(legal);
      if (pass) return { action: pass.action, rationale: 'fold: pass on call' };
    }
    const choice = chooseCall(view, legal, params, rng);
    if (choice.action) {
      const t = choice.action.action.type;
      if (t === 'pon' || t === 'chi' || t === 'minkan' || t === 'pass') {
        return { action: choice.action.action, rationale: choice.rationale };
      }
    }
    const pass = passAction(legal);
    if (pass) return { action: pass.action, rationale: choice.rationale };
    // No pass offered (shouldn't happen) — fall back to first legal.
    return { action: legal[0].action, rationale: 'call-window fallback' };
  }

  // 3) Our discard (post-draw). Consider ankan/kakan first, then riichi/discard.
  const seat = view.seats[view.viewer];
  const pool = ownTiles(view); // concealed hand + drawn tile (14 tiles)
  const ownShanten = shanten(pool, seat.melds);
  const folding = shouldFold(view, params, ownShanten);

  // Self kan is rare and gated; only when not folding and actually offered.
  if (!folding) {
    const kanChoice = chooseSelfKan(view, legal, params, rng, folding);
    if (
      kanChoice.action &&
      (kanChoice.action.action.type === 'ankan' || kanChoice.action.action.type === 'kakan') &&
      legal.some((l) => l.action.type === kanChoice.action!.action.type)
    ) {
      return { action: kanChoice.action.action, rationale: kanChoice.rationale };
    }
  }

  // Kuikae and forced tsumogiri constrain the candidates BEFORE ranking,
  // instead of falling back to an arbitrary first action after a forbidden pick.
  const discardTiles = legal.flatMap((l) => l.action.type === 'discard' ? [l.action.tile] : []);
  if (discardTiles.length === 0) return { action: legal[0].action, rationale: 'forced non-discard' };
  const disc = chooseDiscard(view, params, rng, folding, discardTiles);

  // Find the legal plain-discard action for the chosen tile (match id, then
  // kind for identical copies). The engine offers discards over the whole pool
  // (hand + drawnTile), minus kuikae-forbidden kinds.
  const findDiscard = (wantRiichi: boolean): Action | null => {
    const k = kindOf(disc.tile);
    const offers = legal.filter((l) => l.action.type === 'discard'
      && l.action.seat === view.viewer && (l.action.riichi === true) === wantRiichi);
    // Match the physical copy FIRST. A kind-first find can throw a red five
    // even when the efficiency layer explicitly chose the non-red copy.
    const match = offers.find((l) => l.action.type === 'discard' && l.action.tile === disc.tile)
      ?? offers.find((l) => l.action.type === 'discard' && kindOf(l.action.tile) === k);
    return match ? match.action : null;
  };

  // Riichi: the engine exposes a separate riichi-flagged discard ONLY when the
  // hand is closed and this tile leaves it tenpai. Declaring riichi therefore
  // means selecting that exact offered action — we never synthesize the flag.
  // The engine offers a riichi-flagged discard only for tiles that leave the
  // hand tenpai. The efficiency pick usually is one of them, but when it is
  // not, wanting riichi means taking the best tile that does allow it rather
  // than silently dropping the declaration.
  const riichiOffers = legal.filter(
    (l) => l.action.type === 'discard' && l.action.riichi === true,
  );
  const closed = isHandClosed(seat.melds);
  let riichiAction = findDiscard(true);
  let riichiTile = disc.tile;
  if (!riichiAction && riichiOffers.length > 0) {
    const best = bestRiichiDiscard(view, riichiOffers);
    if (best) {
      riichiAction = best.action;
      riichiTile = best.tile;
    }
  }
  let declareRiichi = false;
  if (riichiAction && closed && !folding) {
    declareRiichi = shouldRiichi(view, params, rng, riichiTile).riichi;
  }

  const chosen: Action | null = declareRiichi
    ? riichiAction
    : findDiscard(false) ??
      // riichi-flagged actions also count as valid discards if no plain one exists
      riichiAction ??
      legal.find((l) => l.action.type === 'discard')?.action ??
      null;

  if (!chosen) {
    // No discard available in this window — pass or first legal.
    const pass = passAction(legal);
    return { action: pass ? pass.action : legal[0].action, rationale: 'no discard available' };
  }

  return {
    action: chosen,
    rationale: `${folding ? 'fold' : 'push'}: ${disc.rationale}${declareRiichi ? ' + riichi' : ''}`,
  };
}
