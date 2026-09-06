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
import { tableThreat, buildSafetyContext, dangerOf } from './defense';
import { flushDirection } from './strategy';
import {
  shanten,
  hasOpenYakuPath,
  isHandClosed,
  kindOf,
  ownTiles,
  yakuhaiKinds,
  countsOf,
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
  valueCall: boolean;
  keepsYaku: boolean;
}

function ownSeat(view: PublicView) {
  return view.seats[view.viewer];
}

/** Expand a count array into representative tile ids (lowest copies first). */
function countsToIds(counts: readonly number[]): TileId[] {
  const ids: TileId[] = [];
  for (let k = 0; k < counts.length; k++) {
    for (let c = 0; c < counts[k]; c++) ids.push(k * 4 + c);
  }
  return ids;
}

/**
 * Per-kind counts of our concealed hand after declaring `meld`: the called
 * tile is removed from the meld (it was never ours) and our contributed
 * copies are removed from the hand. Count-based, so it is robust to the action
 * tiles being representative ids rather than our exact physical copies.
 */
function postCallCounts(view: PublicView, meld: Meld): number[] {
  const counts = countsOf(view.hand);
  for (const t of meld.tiles) {
    const k = kindOf(t);
    const isCalled = meld.calledTile !== null && t === meld.calledTile;
    if (!isCalled) counts[k] = Math.max(0, counts[k] - 1);
  }
  return counts;
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
  const counts = postCallCounts(view, meld);
  const forbid = new Set(forbidden);
  // An open kan is followed by a replacement DRAW, not an immediate discard.
  if (meld.type === 'minkan') {
    const hand = countsToIds(counts);
    return { tile: hand[0], shanten: shanten(hand, afterMelds) };
  }

  let best: { tile: TileId; shanten: number } | null = null;
  for (let k = 0; k < counts.length; k++) {
    if (counts[k] === 0) continue;
    if (forbid.has(k)) continue; // kuikae: this discard would be illegal
    counts[k]--;
    const hand = countsToIds(counts);
    const sh = shanten(hand, afterMelds);
    counts[k]++;
    if (best === null || sh < best.shanten) {
      // Representative tile id for this kind from our current hand.
      const tile = view.hand.find((t) => kindOf(t) === k) ?? k * 4;
      best = { tile, shanten: sh };
    }
  }
  return best;
}

/** Shanten now (the waiting shape) — what we improve from. */
function currentShanten(view: PublicView): number {
  const seat = ownSeat(view);
  // On a call window we hold a waiting-size hand (just discarded last turn),
  // and drawnTile is null.
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
  const threat = tableThreat(view).level;
  const direction = params.flushBias > 0 ? flushDirection(view.hand, seat.melds) : null;

  const options: CallOption[] = [];
  for (const legalCall of calls) {
    const meld = buildMeldForAction(legalCall, view, fromDiscarder);
    if (!meld) continue;
    if (meld.type === 'minkan' && (view.tilesRemaining <= 8
      || (threat >= 0.6 && (params.kanGreed < 0.9 || preShanten > 0)))) continue;
    const follow = bestDiscardAfterCall(view, meld, legalCall.forbiddenDiscards ?? []);
    if (!follow) continue;

    const gain = preShanten - follow.shanten;
    const afterCounts = postCallCounts(view, meld);
    if (meld.type !== 'minkan') afterCounts[kindOf(follow.tile)]--;
    const afterHand = countsToIds(afterCounts);
    // Check the actual post-discard state, including the prospective meld.
    // A pair thrown away as the follow-up is not a future yakuhai path.
    const yakuPath = hasOpenYakuPath(
      afterHand, seat.melds.concat(meld), seat.seatWind, view.roundWind, view.settings.kuitan,
    );
    const valueKinds = new Set(yakuhaiKinds(seat.seatWind, view.roundWind));
    const valueCall = meld.type !== 'chi' && valueKinds.has(kindOf(meld.tiles[0]));
    let score = gain * 2 + (valueCall ? 2 + params.valueGreed * 2 : 0);
    if (meld.type === 'minkan') score -= 2 * (1 - params.kanGreed);
    if (direction !== null) {
      const followsSuit = meld.tiles.every((t) => kindOf(t) >= 27 || Math.floor(kindOf(t) / 9) === direction);
      score += params.flushBias * (followsSuit ? 1 : -2);
    }
    if (meld.type === 'chi') score -= params.pairBias;
    score += yakuPath ? 0.5 : -100;
    options.push({
      legal: legalCall,
      meld,
      discardTile: follow.tile,
      postShanten: follow.shanten,
      gain,
      score, valueCall, keepsYaku: yakuPath,
    });
  }

  options.sort((a, b) => b.score - a.score || a.postShanten - b.postShanten);
  const best = options[0];
  if (!best) return { action: pass ?? null, rationale: 'no sound legal follow-up' };

  // Acceptance gate.
  //
  // Calling is not free. Opening a closed hand forfeits riichi, menzen tsumo,
  // pinfu, ippatsu and ura — call it two han of expectation — so a call out of
  // a closed hand has to buy real speed or real value, not merely "a shanten
  // that was going spare". The old gate let the greedy archetypes take
  // zero-gain calls half the time, and it showed: the two calling bots reached
  // tenpai in 44% and 38% of hands against the closed bot's 69%.
  //
  // Once the hand is already open there is nothing left to protect, so a
  // one-shanten gain is enough and archetype greed decides the rest.
  const bestKeepsYaku = best.keepsYaku;
  const valueCall = best.valueCall;      // yakuhai pon and the like
  const bringsTenpai = best.postShanten <= 0;
  const alreadyOpen = !wasClosed;

  let callProb: number;
  if (!bestKeepsYaku) {
    callProb = 0; // an open no-yaku hand is worthless — never strand it
  } else if (alreadyOpen) {
    callProb = best.gain >= 1 || valueCall
      ? 0.5 + params.callGreed * 0.45
      : params.callGreed * 0.35;
  } else if (bringsTenpai || valueCall || best.gain >= 2) {
    // Worth breaking the hand open for.
    callProb = 0.45 + params.callGreed * 0.5;
  } else if (best.gain >= 1) {
    // A single shanten in exchange for the whole closed-hand bonus. Whether
    // that trade is worth it is exactly what separates a koikoi caller from a
    // patient one, so archetype greed decides it and nothing else does.
    callProb = params.callGreed * 0.6;
  } else {
    callProb = 0;
  }
  if (best.meld.type === 'minkan') callProb *= 0.2 + params.kanGreed * 0.8;
  if (wasClosed && best.meld.type === 'chi') callProb *= 1 - params.pairBias * 0.5;
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
  const kans = legal.filter((l) => l.action.type === 'ankan' || l.action.type === 'kakan');
  if (!kans.length) return { action: null, rationale: 'no self-kan' };
  if (folding || view.tilesRemaining <= 8) return { action: null, rationale: 'no kan while folding or near wall exhaustion' };

  const seat = ownSeat(view);
  const pool = ownTiles(view);
  const before = shanten(pool, seat.melds);
  const threat = tableThreat(view).level;
  // More dora helps every opponent. Only the boldest character risks it into
  // a declared threat, and then only with a ready hand of their own.
  if (threat >= 0.6 && (params.kanGreed < 0.9 || before > 0)) {
    return { action: null, rationale: 'kan would feed an opponent threat' };
  }
  const safety = buildSafetyContext(view);
  const sound = kans.filter(({ action }) => {
    if (action.type === 'ankan') {
      const tiles = pool.filter((t) => kindOf(t) === action.kind);
      const kept = pool.filter((t) => kindOf(t) !== action.kind);
      const meld: Meld = { type: 'ankan', tiles, calledFrom: null, calledTile: null, concealed: true };
      return tiles.length === 4 && shanten(kept, [...seat.melds, meld]) <= before;
    }
    if (action.type === 'kakan') {
      const index = seat.melds.findIndex((m) => m.type === 'pon' && kindOf(m.tiles[0]) === kindOf(action.tile));
      if (index < 0 || !pool.includes(action.tile)) return false;
      if (threat >= 0.5 && dangerOf(kindOf(action.tile), safety) > 0.65) return false;
      // Upgrade the existing pon; a kakan does NOT create a fifth block.
      const melds = seat.melds.map((m, i): Meld => i === index
        ? { ...m, type: 'kakan', tiles: [...m.tiles, action.tile].sort((a, b) => a - b) }
        : m);
      return shanten(pool.filter((t) => t !== action.tile), melds) <= before;
    }
    return false;
  });
  if (!sound.length) return { action: null, rationale: 'kan would break the hand or expose a dangerous tile' };
  const probability = (0.08 + params.kanGreed * 0.8) * (1 - params.riichiPatience * 0.25);
  return rng.chance(probability)
    ? { action: sound[0], rationale: 'sound kan: personality risk preference' }
    : { action: null, rationale: 'decline self-kan' };
}
