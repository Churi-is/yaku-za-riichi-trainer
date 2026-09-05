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

  const options: CallOption[] = [];
  for (const legalCall of calls) {
    const meld = buildMeldForAction(legalCall, view, fromDiscarder);
    if (!meld) continue;
    const follow = bestDiscardAfterCall(view, meld, legalCall.forbiddenDiscards ?? []);
    if (!follow) continue;

    const gain = preShanten - follow.shanten;
    const afterHand = countsToIds(postCallCounts(view, meld));
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
  const bestKeepsYaku = best.score > -50;
  const valueCall = best.score >= 3.0;      // yakuhai pon and the like
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

  // "Only when it does not wreck the hand" was the stated intent, but nothing
  // checked it: an ankan of a tile that was doing duty in a run costs a whole
  // block. Take only kans that leave the shape no worse.
  const seat = ownSeat(view);
  const before = shanten(ownTiles(view), seat.melds);
  const safe = kans.filter((k) => {
    const kind = k.action.type === 'ankan'
      ? k.action.kind
      : kindOf((k.action as { tile: TileId }).tile);
    const kept = ownTiles(view).filter((t: TileId) => kindOf(t) !== kind);
    const meldsAfter = [...seat.melds, {
      type: k.action.type as Meld['type'],
      tiles: ownTiles(view).filter((t: TileId) => kindOf(t) === kind).slice(0, 4),
      calledFrom: null,
      calledTile: null,
      concealed: k.action.type === 'ankan',
    } as Meld];
    return shanten(kept, meldsAfter) <= before;
  });
  if (safe.length === 0) return { action: pass ?? null, rationale: 'kan would break the hand' };

  // Base probability: modest, scaled down for patient bots.
  const p = 0.25 * (0.4 + params.callGreed) * (1 - params.riichiPatience * 0.5);
  if (rng.chance(Math.max(0.05, p))) {
    return { action: safe[0], rationale: 'self-kan' };
  }
  return { action: pass ?? null, rationale: 'decline self-kan' };
}
