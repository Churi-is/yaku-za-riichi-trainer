/**
 * Call decisions: pon / chi / kan, evaluated against the legal actions the
 * engine offers. A call is attractive when it lowers shanten AND preserves a
 * plausible yaku path (an open hand with no yaku is worthless); callGreed
 * modulates how easily marginal calls are taken. Honors kuikae via the legal
 * action's forbiddenDiscards and the closed/yaku state.
 */
import type {
  LegalAction,
  Meld,
  PublicView,
  TileId,
  TileKind,
} from '@engine/types';
import type { AIParams } from './types';
import { Rng } from './rng';
import {
  shanten,
  hasOpenYakuPath,
  isHandClosed,
  kindOf,
  yakuhaiKinds,
} from './handEval';

export interface CallChoice {
  /** The legal action to take (a call), or null to decline (pass). */
  action: LegalAction | null;
  rationale: string;
}

interface CallOption {
  legal: LegalAction;
  meld: Meld;
  /** Tile to discard after the call (the follow-up discard). */
  discardTile: TileId;
  postShanten: number;
  gain: number; // pre-shanten - post-shanten
  score: number;
}

function ownSeat(view: PublicView) {
  return view.seats[view.viewer];
}

/**
 * Concealed tile ids after declaring `meld` (the tiles we contributed are
 * removed from the hand; the called tile was never in it).
 */
function concealedAfterCall(view: PublicView, meld: Meld): TileId[] {
  const removed = new Set<TileId>();
  for (const t of meld.tiles) {
    if (meld.calledTile !== null && t === meld.calledTile) continue;
    removed.add(t);
  }
  // Remove our contributed tiles by id (they are real ids in view.hand for
  // pon/chi; minkan contributes three of our four copies).
  const hand = view.hand.filter((t) => !removed.has(t));
  return hand;
}

/**
 * Best legal follow-up discard + resulting shanten after declaring `meld`.
 * After the call we must drop one tile to return to waiting size. We scan the
 * candidate kinds and use the engine's shanten on the post-call concealed set.
 */
function bestDiscardAfterCall(
  view: PublicView,
  meld: Meld,
  forbidden: TileKind[],
): { tile: TileId; shanten: number } | null {
  const seat = ownSeat(view);
  const afterMelds = seat.melds.concat(meld);
  const afterHand = concealedAfterCall(view, meld);

  let best: { tile: TileId; shanten: number } | null = null;
  const forbid = new Set(forbidden);
  const seen = new Set<TileKind>();
  for (let i = 0; i < afterHand.length; i++) {
    const tile = afterHand[i];
    const kind = kindOf(tile);
    if (seen.has(kind)) continue;
    seen.add(kind);
    if (forbid.has(kind)) continue; // kuikae: this discard would be illegal
    const rest = afterHand.filter((_, j) => j !== i);
    const sh = shanten(rest, afterMelds);
    if (best === null || sh < best.shanten) best = { tile, shanten: sh };
  }
  return best;
}

/** Shanten now (the waiting shape) — what we improve from. */
function currentShanten(view: PublicView): number {
  const seat = ownSeat(view);
  // On a call window we hold a waiting-size hand (just discarded last turn).
  return shanten(view.hand, seat.melds);
}

function buildMeldForAction(
  legal: LegalAction,
  view: PublicView,
  from: number,
): Meld | null {
  const a = legal.action;
  const calledTile = view.lastDiscard?.tile ?? null;
  if (a.type === 'pon') {
    return {
      type: 'pon',
      tiles: [...a.tiles, calledTile!].sort((x, y) => x - y),
      calledFrom: from as Meld['calledFrom'],
      calledTile,
      concealed: false,
    };
  }
  if (a.type === 'chi') {
    return {
      type: 'chi',
      tiles: [...a.tiles, calledTile!].sort((x, y) => x - y),
      calledFrom: from as Meld['calledFrom'],
      calledTile,
      concealed: false,
    };
  }
  if (a.type === 'minkan') {
    return {
      type: 'minkan',
      tiles: [...a.tiles, calledTile!].sort((x, y) => x - y),
      calledFrom: from as Meld['calledFrom'],
      calledTile,
      concealed: false,
    };
  }
  return null;
}

/**
 * Choose among offered call actions (pon/chi/minkan) vs passing.
 * `ron`/`tsumo` are handled elsewhere and always taken.
 */
export function chooseCall(
  view: PublicView,
  legal: LegalAction[],
  params: AIParams,
  rng: Rng,
): CallChoice {
  const seat = ownSeat(view);
  const calls = legal.filter(
    (l) => l.action.type === 'pon' || l.action.type === 'chi' || l.action.type === 'minkan',
  );
  const pass = legal.find((l) => l.action.type === 'pass');

  if (calls.length === 0) {
    return { action: pass ?? null, rationale: 'no calls offered' };
  }

  const preShanten = currentShanten(view);
  const fromDiscarder = view.lastDiscard?.from ?? -1;
  const wasClosed = isHandClosed(seat.melds);

  const options: CallOption[] = [];
  for (const legalCall of calls) {
    const meld = buildMeldForAction(legalCall, view, fromDiscarder);
    if (!meld) continue;
    const follow = bestDiscardAfterCall(view, meld, legalCall.forbiddenDiscards ?? []);
    if (!follow) continue;

    const gain = preShanten - follow.shanten;
    const afterHand = concealedAfterCall(view, meld);
    // Yaku path over the post-call state: afterHand (contributed tiles removed)
    // plus the new meld's tiles (including the called tile).
    const yakuPath = hasOpenYakuPath(
      afterHand,
      seat.melds,
      seat.seatWind,
      view.roundWind,
      view.settings.kuitan,
      meld.tiles,
    );

    // Score the call for ranking among multiple offers. Shanten gain is the
    // engine; yakuhai pons are premium; kans are discounted.
    let score = gain * 2.0;
    const valueKinds = new Set(yakuhaiKinds(seat.seatWind, view.roundWind));
    if (meld.type !== 'chi' && valueKinds.has(kindOf(meld.tiles[0]))) score += 3.0;
    if (meld.type === 'minkan') score -= 1.5;
    // Keep the yaku-path flag per option for the acceptance gate below.
    score += yakuPath ? 0.5 : -4.0;
    options.push({
      legal: legalCall,
      meld,
      discardTile: follow.tile,
      postShanten: follow.shanten,
      gain,
      score: yakuPath ? score : -100, // no-yaku open hand is essentially never taken
    });
  }

  options.sort((a, b) => b.score - a.score || a.postShanten - b.postShanten);
  const best = options[0];

  // Acceptance gate. A call is worth taking when it preserves a yaku path and
  // either improves shanten (speed) or scores value. callGreed sets how eager
  // the bot is to open even for a neutral/keep-alive call:
  //   aggressive greed ~0.82 → takes most safe openings;
  //   balanced   ~0.45 → takes gain/value, declines marginal;
  //   defensive  ~0.18 → opens only for clear gain/value.
  const bestKeepsYaku = best.score > -50;
  const improves = best.gain >= 1;
  const valueCall = best.score >= 3.0;

  let callProb: number;
  if (!bestKeepsYaku) {
    callProb = 0; // an open no-yaku hand is worthless — never strand it
  } else if (improves || valueCall) {
    callProb = 0.45 + params.callGreed * 0.5; // good call: 0.54 (def) .. 0.86 (agg)
  } else {
    // Neutral call (keeps yaku, no shanten gain): mostly archetype flavor.
    callProb = params.callGreed * 0.6; // 0.11 (def) .. 0.49 (agg)
  }
  const take = rng.chance(callProb);

  if (best && take && bestKeepsYaku) {
    return {
      action: best.legal,
      rationale: `${best.legal.action.type} (score ${best.score.toFixed(2)}, gain ${best.gain}, →shanten ${best.postShanten})`,
    };
  }
  return { action: pass ?? null, rationale: `decline calls (best score ${best?.score.toFixed(2)})` };
}

/**
 * Closed kan (ankan) / added kan (kakan) on our own turn: only when it does
 * not wreck the hand and we're not folding into a live riichi. Very rare.
 */
export function chooseSelfKan(
  view: PublicView,
  legal: LegalAction[],
  params: AIParams,
  rng: Rng,
  folding: boolean,
): CallChoice {
  const kans = legal.filter(
    (l) => l.action.type === 'ankan' || l.action.type === 'kakan',
  );
  const pass = legal.find((l) => l.action.type === 'discard');
  if (kans.length === 0) return { action: null, rationale: 'no self-kan' };
  // Kans add dora risk for everyone and commit tiles; only aggressive-ish or
  // clearly-winning hands bother. When folding, never kan.
  if (folding) return { action: null, rationale: 'no kan while folding' };
  // Base probability: modest, scaled down for patient bots.
  const p = 0.25 * (0.4 + params.callGreed) * (1 - params.riichiPatience * 0.5);
  if (rng.chance(Math.max(0.05, p))) {
    return { action: kans[0], rationale: 'self-kan' };
  }
  return { action: pass ?? null, rationale: 'decline self-kan' };
}
