/**
 * analysis/waitGuess — Worker C. Overlay C: ranked opponent-wait guesses.
 *
 * PUBLIC-ONLY. Uses suji (which groups are already covered by the opponent's
 * discards), kabe (four visible copies kill one-sided waits), kawa patterns
 * (honor timing, pair shedding) and call shapes (a called tile's suit and
 * nearby ranks). Every guess is probabilistic and labelled as an estimate.
 *
 * Deliberate asymmetry: this guesses OPPONENTS' waits only. Own-hand waits are
 * never surfaced during live play.
 */
import type { ActionLogEntry } from '@replay/types';
import type { Meld, PublicView, SeatIndex } from '@engine/types';
import type { OpponentWaitRead, ProbabilityBand, WaitGuess, WaitGuessRecord } from './types';
import { estimateHand } from './handEstimate';
import { safetyOfKind, visibleCount } from './tileSafety';
import { computeWaits } from './waits';
import { kindLabel, kindOf, suitOfKind } from './tileUtil';

const SUJI_GROUPS: number[][] = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];

const BASE: Record<string, number> = { m: 0, p: 9, s: 18 };

export function guessWaits(view: PublicView): OpponentWaitRead[] {
  const out: OpponentWaitRead[] = [];
  for (const seat of [3, 1, 2] as SeatIndex[]) { // next player first, then across
    const est = estimateHand(view, seat, { late: view.tilesRemaining <= 12 });
    if (!est.likelyTenpai) continue;
    out.push({ seat, tenpaiLikely: true, guesses: rankWaitGuesses(view, seat, est) });
  }
  // Include all seats so the overlay can show "no live read" per opponent.
  for (const seat of [3, 1, 2] as SeatIndex[]) {
    if (out.some((o) => o.seat === seat)) continue;
    out.push({ seat, tenpaiLikely: false, guesses: [] });
  }
  return out;
}

export function rankWaitGuesses(
  view: PublicView,
  seat: SeatIndex,
  est?: ReturnType<typeof estimateHand>,
): WaitGuess[] {
  const e = est ?? estimateHand(view, seat, { late: view.tilesRemaining <= 12 });
  const seatView = view.seats[seat];
  const riverKinds = [...new Set(seatView.river.map((d) => kindOf(d.tile)))];

  // Score every live kind as a potential wait.
  const scored: { kind: number; score: number }[] = [];
  for (let kind = 0; kind < 34; kind++) {
    if (visibleCount(kind, view) >= 4) continue; // no copies of it exist
    const v = safetyOfKind(kind, riverKinds, view.visibleCounts);
    if (v.genbutsu) continue; // they discarded it — impossible wait

    let score = 40;
    const suit = suitOfKind(kind);
    const rank = (kind % 9) + 1;
    if (suit !== 'z') {
      if (rank >= 3 && rank <= 7) score += 15; // middle tiles are the common waits
      if (rank === 1 || rank === 9) score -= 5;
    } else {
      score += 5; // live honors often sit in a tanki/pair wait
    }

    const group = SUJI_GROUPS.find((g) => g.includes(rank));
    if (suit !== 'z' && group) {
      const covered = group.filter((r) =>
        riverKinds.includes(BASE[suit] + r - 1)).length;
      score -= covered * 12;
    }
    if (v.suji) score -= 25;
    if (v.kabe) score -= 22;
    if (v.oneChance) score += 8;
    if (suit === 'z') {
      const honorsLate = seatView.river.slice(-6).filter((d) => kindOf(d.tile) >= 27).length;
      if (honorsLate <= 1) score += 10; // they are not shedding honors now
    }

    const meldSuits = new Set(seatView.melds.map((m) => suitOfKind(kindOf(m.tiles[0]))));
    if (meldSuits.has(suit)) score += 10;

    scored.push({ kind, score: Math.max(0, score) });
  }

  // Cluster by suji group so guesses read "1-4-7 pin" rather than single tiles.
  const groups: Record<string, { kind: number; score: number }[]> = {};
  for (const s of scored) {
    const suit = suitOfKind(s.kind);
    const rank = (s.kind % 9) + 1;
    const key = suit === 'z'
      ? `honor-${s.kind}`
      : `${suit}-${SUJI_GROUPS.find((g) => g.includes(rank))?.[0] ?? rank}`;
    (groups[key] ??= []).push(s);
  }

  const ranked = Object.values(groups)
    .map((items) => {
      const best = items.sort((a, b) => b.score - a.score)[0];
      return {
        kinds: items.map((i) => i.kind).sort((a, b) => a - b).slice(0, 3),
        score: best.score + Math.min(10, items.length * 2),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return ranked.map((g) => ({
    kinds: g.kinds,
    label: g.kinds.map((k) => kindLabel(k)).join(' / '),
    confidence: bandOfConfidence(g.score),
    reasoning: reasoningFor(view, seat, g.kinds, g.score, e),
  }));
}

function bandOfConfidence(score: number): ProbabilityBand {
  if (score >= 85) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

function reasoningFor(
  view: PublicView,
  seat: SeatIndex,
  kinds: number[],
  score: number,
  est: ReturnType<typeof estimateHand>,
): string {
  const seatView = view.seats[seat];
  const riverKinds = [...new Set(seatView.river.map((d) => kindOf(d.tile)))];
  const parts: string[] = [];
  const suitKinds = kinds.filter((k) => suitOfKind(k) !== 'z');
  if (suitKinds.length > 0) {
    const s = suitOfKind(suitKinds[0]);
    const rank = (suitKinds[0] % 9) + 1;
    const group = SUJI_GROUPS.find((g) => g.includes(rank));
    const covered = group
      ? group.filter((r) => riverKinds.includes(BASE[s] + r - 1)).length
      : 0;
    if (covered === 0) {
      parts.push(`no suji partner discarded from the ${group?.[0] ?? rank}-${s} group, so this class is unprotected`);
    } else {
      parts.push(`only ${covered} suji partner${covered === 1 ? '' : 's'} discarded — weaker protection than usual`);
    }
    // kabe mention
    const kabe = kinds.some((k) => safetyOfKind(k, riverKinds, view.visibleCounts).kabe);
    if (kabe) parts.push('kabe narrows the one-sided waits but leaves the rest live');
  } else {
    parts.push('a live honor: suji does not apply, and honor waits typically appear as pair (tanki) waits');
  }
  if (est.open) parts.push(`their ${est.meldCount} visible meld${est.meldCount === 1 ? '' : 's'} point toward the same suit`);
  if (score >= 85) parts.push('this is the current best candidate');
  return `Estimate: ${parts.join('; ')}. Public tiles cannot reveal the wait for certain.`;
}

/**
 * Resolve practice-mode guesses against the revealed hand at round end.
 * Reads `handReveal` (written by the game loop on the hand's final log entry)
 * and the melds visible in that entry's public view. Falls back to leaving
 * the record unresolved if the reveal is absent.
 */
export function resolveWaitGuesses(
  records: WaitGuessRecord[],
  log: ActionLogEntry[],
): WaitGuessRecord[] {
  const byHand = new Map<number, ActionLogEntry[]>();
  for (const e of log) {
    const list = byHand.get(e.handId) ?? [];
    list.push(e);
    byHand.set(e.handId, list);
  }

  return records.map((r) => {
    if (r.actualWaits !== null) return r;
    const entries = byHand.get(r.handId);
    if (!entries || entries.length === 0) return r;
    const last = entries.slice().sort((a, b) => a.seq - b.seq)[entries.length - 1];
    const reveal = last.handReveal;
    if (!reveal) return r;
    const concealed = reveal.revealedHands[r.seat];
    if (!concealed) return r;
    const melds: Meld[] = last.viewBefore?.seats[r.seat]?.melds ?? [];

    const hand = [...concealed];
    if (reveal.winningTile !== null) {
      const i = hand.indexOf(reveal.winningTile);
      if (i >= 0) hand.splice(i, 1); // 14-tile completed hand → drop the win tile
    }
    let actual: number[];
    try {
      actual = computeWaits(hand, melds);
    } catch {
      actual = [];
    }
    const correct = actual.length > 0 && r.submittedKinds.some((k) => actual.includes(k));
    return { ...r, actualWaits: actual, correct };
  });
}
