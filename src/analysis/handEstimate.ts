/**
 * analysis/handEstimate — Worker C. PUBLIC-ONLY structural hand reading.
 *
 * This module estimates what a seat is clearly building from what is visible:
 * melds, discards, calls, riichi. It never knows any hidden tile. It produces
 * hand "direction" (yaku families, suit preferences, openness), a block
 * estimate and a tenpai likelihood score built on public evidence only.
 *
 * Deliberate limitation: engine shanten/ukeire need the actual concealed hand,
 * which is hidden for opponents. Opponent estimates therefore stay
 * inferential; engine helpers are used for the player's own hand (waitGuess,
 * grading). When the engine lands, nothing here changes shape.
 */
import type { PublicSeatView, PublicView, SeatIndex, Suit } from '@engine/types';
import {
  countsFromIds, distinctKinds, isDragonKind, isSimpleKind, isTerminalKind,
  kindOf, suitOfKind, WIND_KIND,
} from './tileUtil';

export interface HandDirection {
  /** Short headline, e.g. "Honitsu in pin". */
  name: string;
  /** Relative confidence. */
  strength: 'Low' | 'Medium' | 'High';
  /** Why (the method behind the read). */
  detail: string;
}

export interface HandEstimate {
  seat: SeatIndex;
  meldCount: number;
  open: boolean;
  riichi: boolean;
  /** Visible melds + estimated concealed groups (0-5 blocks). */
  blocks: number;
  /** Lower-bound shanten from concealed tile count alone. */
  concealedShantenFloor: number;
  /** Suit skew among number-suit discards, strongest first. */
  suitLeanings: { suit: Suit; share: number }[];
  /** Likely yaku families, most plausible first (max 5). */
  directions: HandDirection[];
  /** 0..1 evidence score that the seat is tenpai right now. */
  tenpaiScore: number;
  /** True when tenpaiScore >= 0.55 (or riichi). */
  likelyTenpai: boolean;
}

/** 4 minus open melds = concealed groups still needed. */
function concealedGroupsNeeded(meldCount: number): number {
  return Math.max(0, 4 - meldCount);
}

function concealedShantenFloor(concealedCount: number, meldCount: number): number {
  return Math.max(0, concealedGroupsNeeded(meldCount) * 3 + 2 - concealedCount);
}

export function estimateHand(
  view: PublicView,
  seat: SeatIndex,
  opts?: { late?: boolean },
): HandEstimate {
  const seatView = view.seats[seat];
  const river = seatView.river;
  const melds = seatView.melds;
  const open = melds.some((m) => !m.concealed);
  const meldCount = melds.length;
  const late = opts?.late ?? river.length >= 8;

  const counts = countsFromIds(river.map((d) => d.tile));
  const suitCounts: Record<Suit, number> = { m: 0, p: 0, s: 0, z: 0 };
  for (let k = 0; k < 34; k++) suitCounts[suitOfKind(k)] += counts[k];
  const numericTotal = suitCounts.m + suitCounts.p + suitCounts.s;
  const numericShare = (s: Suit) => (numericTotal === 0 ? 0 : suitCounts[s] / numericTotal);
  const suits: Suit[] = ['m', 'p', 's'];
  const numericSorted = suits.slice().sort((a, b) => numericShare(b) - numericShare(a));
  const suitLeanings: { suit: Suit; share: number }[] = [];
  if (numericTotal >= 4) {
    for (const s of numericSorted) {
      if (numericShare(s) >= 0.5) suitLeanings.push({ suit: s, share: numericShare(s) });
    }
  }

  const directions = buildDirections(view, seatView, counts, suitCounts, numericTotal, open, meldCount);
  const blocks = estimateBlocks(meldCount, seatView.concealedCount);
  const floor = concealedShantenFloor(seatView.concealedCount, meldCount);
  const tenpaiScore = tenpaiEvidence(view, seatView, meldCount, blocks, late);
  const likelyTenpai = seatView.riichi || tenpaiScore >= 0.55;

  return {
    seat,
    meldCount,
    open,
    riichi: seatView.riichi,
    blocks,
    concealedShantenFloor: floor,
    suitLeanings,
    directions: directions.slice(0, 5),
    tenpaiScore,
    likelyTenpai,
  };
}

/** Readable, probabilistic yaku directions from melds + river. */
function buildDirections(
  view: PublicView,
  seatView: PublicSeatView,
  counts: number[],
  suitCounts: Record<Suit, number>,
  numericTotal: number,
  open: boolean,
  meldCount: number,
): HandDirection[] {
  const out: HandDirection[] = [];
  const add = (name: string, strength: HandDirection['strength'], detail: string) =>
    out.push({ name, strength, detail });

  // Dragon visibility across melds + river (triplets need 3 visible copies).
  const dragonSeen: Record<number, number> = {};
  for (const m of seatView.melds) {
    for (const t of m.tiles) {
      const k = kindOf(t);
      if (isDragonKind(k)) dragonSeen[k] = Math.min(4, (dragonSeen[k] ?? 0) + 1);
    }
  }
  for (const k of distinctKinds(seatView.river.map((d) => d.tile))) {
    if (isDragonKind(k)) dragonSeen[k] = Math.min(4, (dragonSeen[k] ?? 0) + 1);
  }
  const yakuhaiKinds = new Set<number>([
    31, 32, 33, WIND_KIND[view.roundWind], WIND_KIND[seatView.seatWind],
  ]);
  let yakuhaiSeen = 0;
  for (const k of Object.keys(dragonSeen).map(Number)) {
    if (yakuhaiKinds.has(k)) yakuhaiSeen += dragonSeen[k];
  }

  // Open dragon/triplet melds
  const dragonMelds = seatView.melds.filter((m) =>
    m.tiles.some((t) => isDragonKind(kindOf(t))) && m.type !== 'chi');
  if (dragonMelds.length === 1) {
    add('Possibly open dragon triplet', 'High',
      'An open dragon pon is already visible. The remaining copy of that dragon is both the wait and the yaku.');
  } else if (dragonMelds.length >= 2) {
    add('Likely multiple dragon triplets — shousangen/daisangen threat', 'High',
      'Two or more dragon sets are open. With a third dragon pair concealed, shousangen or even daisangen is live.');
  } else if (yakuhaiSeen >= 3) {
    add('Likely yakuhai triplet aim', 'High',
      'Three visible copies of a dragon or a round/seat wind — the remaining copy is the natural wait.');
  } else if (yakuhaiSeen >= 2) {
    add('Possibly a yakuhai pair', 'Medium',
      'Two visible copies of a dragon or a round/seat wind suggest they may be holding the third as a pair.');
  }

  // Flush direction (any seat, open or closed)
  if (meldCount >= 2 && suitLeanings0(suitCounts, numericTotal).length >= 1) {
    const s = suitLeanings0(suitCounts, numericTotal)[0].suit;
    const share = suitCounts[s] / Math.max(1, numericTotal);
    if (share >= 0.55 && numericTotal >= 6) {
      add(`Likely honitsu in ${suitName(s)}`, 'High',
        `${meldCount} melds plus a heavy ${suitName(s)} discard stream (${Math.round(share * 100)}% of number discards) — a flush is the obvious read.`);
    } else if (share >= 0.45) {
      add(`Possible suit lean: ${suitName(s)}`, 'Medium',
        'Open melds plus a moderate suit skew suggest they are concentrating one suit, but not decisively.');
    }
  }

  // Honor-heavy river → toitoi/honroutou aim (they keep honors, shed numbers)
  const honorTotal = suitCounts.z;
  const honorShare = honorTotal / Math.max(1, honorTotal + numericTotal);
  if (honorTotal >= 4 && honorShare >= 0.35 && open && meldCount >= 2) {
    add('Possibly toitoi / honor-heavy aim', 'Medium',
      `Unusually many honors in the river (${Math.round(honorShare * 100)}%) from an open hand — they are collecting pairs and will call pon aggressively.`);
  } else if (honorTotal >= 5 && honorShare >= 0.4) {
    add('Possibly honor-heavy hand', 'Medium',
      `A river dominated by honors (${Math.round(honorShare * 100)}%) suggests they are storing honor pairs, with honroutou/toitoi a live possibility.`);
  }

  // Cheap hand (tanyao): mostly simple number discards, no honors
  if (numericTotal >= 5) {
    let simple = 0;
    for (const d of seatView.river) {
      const k = kindOf(d.tile);
      if (isSimpleKind(k)) simple++;
    }
    const simpleShare = simple / numericTotal;
    if (simpleShare >= 0.75 && honorTotal <= 1) {
      add('Likely fast tanyao hand', open ? 'High' : 'Medium',
        'A river of almost exclusively 2-8 number tiles with no honors — an aggressive cheap hand, especially strong with open melds.');
    }
  }

  // Outside/chanta: it sheds middle tiles from an open hand
  if (open && numericTotal >= 4) {
    let terminal = 0;
    for (const d of seatView.river) {
      const k = kindOf(d.tile);
      if (isTerminalKind(k)) terminal++;
    }
    if (terminal / numericTotal >= 0.6 || honorTotal >= 2) {
      add('Possibly chanta/outside hand', 'Medium',
        'From an open hand they are discarding terminals/honors — those are exactly the tiles chanta needs, so they may be building edge shapes around 1s/9s.');
    }
  }

  // Closed-only possibilities
  if (meldCount === 0 && seatView.isClosed) {
    add('Likely closed-hand (menzen) focus', 'Medium',
      'No melds and still closed — a riichi or pinfu path is preserved and they are not committing to a call-first hand.');
  }

  // Riichi-based reads
  if (seatView.riichi) {
    add('Riichi — likely a complete, concealed hand', 'High',
      'Riichi is declared: the hand is tenpai and the wait is concealed. Only the river (suji/kabe) narrows it.');
  }

  // Fallback: a generic fast-hand read when we have nothing else.
  if (out.length === 0) {
    add('Direction unclear yet', 'Low',
      'The river gives no strong suit or honor pattern yet — most likely a standard balanced hand still developing.');
  }
  return out;
}

function suitLeanings0(suitCounts: Record<Suit, number>, numericTotal: number) {
  return (['m', 'p', 's'] as const)
    .map((suit) => ({ suit, share: suitCounts[suit] / Math.max(1, numericTotal) }))
    .filter((x) => x.share >= 0.5)
    .sort((a, b) => b.share - a.share);
}

function estimateBlocks(meldCount: number, concealedCount: number): number {
  // Each open meld is a complete block. Concealed tiles pack ~3.3 to a block;
  // the pair is the extra tile, so roughly (count - 2) / 3 groups.
  const concealedGroups = Math.max(0, Math.floor((concealedCount - 2) / 3));
  return Math.min(5, meldCount + Math.min(4 - meldCount, concealedGroups));
}

/**
 * 0..1 tenpai evidence score. Public signals only:
 *  - riichi (certain)
 *  - meld count + concealed shape limits (count mod 3)
 *  - discard tempo: late tsumogiri runs, recently called + quick discard
 *  - visible pairs shed from the river
 */
function tenpaiEvidence(
  view: PublicView,
  seatView: PublicSeatView,
  meldCount: number,
  blocks: number,
  late: boolean,
): number {
  if (seatView.riichi) return 1;
  let score = 0;

  const concealed = seatView.concealedCount;
  const groupsLeft = concealedGroupsNeeded(meldCount);
  const floor = concealedShantenFloor(concealed, meldCount);
  // Floor 0 = the concealed part could be tenpai; floor 1 at 13 tiles is
  // normal for everyone mid-hand, so weight shape over count.
  if (floor === 0) score += 0.35;
  if (blocks >= 4) score += 0.25;
  if (meldCount >= 1 && floor <= 1) score += 0.15;
  if (meldCount >= 2 && floor <= 1) score += 0.1;

  // Tempo: consecutive tsumogiri discards are a mild tenpai tell (fewer decisions).
  const tail = seatView.river.slice(-4);
  let run = 0;
  for (let i = tail.length - 1; i >= 0; i--) {
    if (tail[i].tsumogiri) run++;
    else break;
  }
  if (run >= 2) score += 0.1;
  if (run >= 3) score += 0.1;

  // Shedding visible pairs: a seat breaking pairs usually has enough groups.
  const counts = countsFromIds(seatView.river.map((d) => d.tile));
  let pairs = 0;
  for (let k = 0; k < 34; k++) if (counts[k] >= 2) pairs++;
  if (pairs >= 2) score += 0.1;

  // Late hand + moderate evidence → bump.
  if (late && score >= 0.5) score += 0.1;

  // Empty meld-less early hand: low.
  if (meldCount === 0 && seatView.river.length < 5) score = Math.min(score, 0.3);

  return Math.min(1, score);
}

function suitName(s: Suit): string {
  return s === 'm' ? 'man' : s === 'p' ? 'pin' : 'sou';
}
