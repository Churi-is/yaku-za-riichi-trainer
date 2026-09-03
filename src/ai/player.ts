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
} from './handEval';
import { tableThreat } from './defense';
import { chooseDiscard } from './efficiency';
import { chooseCall, chooseSelfKan } from './callLogic';
import { shouldRiichi } from './riichiLogic';

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
 * Whether the bot should fold this turn. Folds when the table threat crosses
 * its defenseThreshold AND its own hand is not already tenpai (a tenpai hand,
 * especially closed, often pushes). Archetype identity comes through:
 * aggressive almost never folds; defensive folds early.
 */
function shouldFold(view: PublicView, params: AIParams, ownShanten: number): boolean {
  const threat = tableThreat(view).level;
  // Tenpai hands (especially closed) push on, even into moderate threat — they
  // are one tile from winning. Far-from-tenpai hands fold to lower threat.
  const pushBonus = ownShanten <= 0 ? 0.3 : ownShanten === 1 ? 0.14 : 0;
  // Aggressive archetype: an extra willingness to deal in.
  const aggression = params.defenseThreshold > 0.7 ? 0.2 : 0;
  const threshold = Math.min(0.99, params.defenseThreshold + pushBonus + aggression);
  return threat >= threshold;
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
    if (folding && ownShanten > 0) {
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

  // Choose the discard tile (efficiency when pushing, safety when folding).
  const disc = chooseDiscard(view, params, rng, folding);

  // Find the legal plain-discard action for the chosen tile (match id, then
  // kind for identical copies). The engine offers discards over the whole pool
  // (hand + drawnTile), minus kuikae-forbidden kinds.
  const findDiscard = (wantRiichi: boolean): Action | null => {
    const k = kindOf(disc.tile);
    const match = legal.find(
      (l) =>
        l.action.type === 'discard' &&
        l.action.seat === view.viewer &&
        (l.action.tile === disc.tile || kindOf(l.action.tile) === k) &&
        (l.action.riichi === true) === wantRiichi,
    );
    return match ? match.action : null;
  };

  // Riichi: the engine exposes a separate riichi-flagged discard ONLY when the
  // hand is closed and this tile leaves it tenpai. Declaring riichi therefore
  // means selecting that exact offered action — we never synthesize the flag.
  const riichiAction = findDiscard(true);
  const closed = isHandClosed(seat.melds);
  let declareRiichi = false;
  if (riichiAction && closed && !folding) {
    declareRiichi = shouldRiichi(view, params, rng, disc.tile).riichi;
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
