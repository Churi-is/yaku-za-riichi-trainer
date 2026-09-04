/**
 * analysis/tileSafety — Worker C. PUBLIC-ONLY safety reasoning.
 *
 * Standard defensive reading from rivers: genbutsu (already discarded by the
 * seat), suji (the 1-4-7 / 2-5-8 / 3-6-9 spacing rule), kabe (wall reading:
 * four of a neighbor tile visible makes the adjacent one-sided wait dead),
 * and one-chance edges (three visible copies → at most one live copy).
 * Every conclusion is probabilistic — safety here narrows danger, it never
 * guarantees it.
 */
import type { PublicView, SeatIndex } from '@engine/types';
import { kindOf } from './tileUtil';

export type SafetyTier =
  | 'genbutsu' | 'kabe' | 'suji' | 'oneChance' | 'honor' | 'danger';

export interface SafetyVerdict {
  kind: number;
  tier: SafetyTier;
  genbutsu: boolean;
  suji: boolean;
  kabe: boolean;
  oneChance: boolean;
  /** 0-3, higher = safer. */
  score: number;
  why: string;
}

const SUJI_GROUPS: number[][] = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];

const OFFSET: Record<string, number> = { m: 0, p: 9, s: 18 };

function kindFor(suit: string, rank: number): number {
  return OFFSET[suit] + rank - 1;
}

export function visibleCount(kind: number, view: PublicView): number {
  return view.visibleCounts[kind] ?? 0;
}

/** Safety verdict for one tile kind vs one seat, using whole-table visibility. */
export function safetyOfKind(
  kind: number,
  seatRiverKinds: number[],
  visibleCounts: number[],
): SafetyVerdict {
  const suit = kind < 9 ? 'm' : kind < 18 ? 'p' : kind < 27 ? 's' : 'z';
  const rank = suit === 'z' ? kind - 27 + 1 : (kind % 9) + 1;
  const genbutsu = seatRiverKinds.includes(kind);

  let suji = false;
  let kabe = false;
  let oneChance = false;
  if (suit !== 'z') {
    const group = SUJI_GROUPS.find((g) => g.includes(rank));
    if (group) {
      suji = group.some((r) => seatRiverKinds.includes(kindFor(suit, r)));
    }
    const neighbors = [rank - 1, rank + 1].filter((r) => r >= 1 && r <= 9);
    kabe = neighbors.some((r) => (visibleCounts[kindFor(suit, r)] ?? 0) >= 4);
    oneChance = neighbors.some((r) => (visibleCounts[kindFor(suit, r)] ?? 0) === 3);
  }

  let tier: SafetyTier;
  if (genbutsu) tier = 'genbutsu';
  else if (kabe) tier = 'kabe';
  else if (suji) tier = 'suji';
  else if (oneChance) tier = 'oneChance';
  else if (suit === 'z') tier = 'honor';
  else tier = 'danger';

  const score = genbutsu ? 3 : kabe ? 2.5 : suji ? 2 : oneChance ? 1.5 : suit === 'z' ? 1 : 0;
  return {
    kind,
    tier,
    genbutsu,
    suji,
    kabe,
    oneChance,
    score,
    why: explain(tier, suit, rank, seatRiverKinds, visibleCounts),
  };
}

function explain(
  tier: SafetyTier,
  suit: string,
  rank: number,
  _river: number[],
  visibleCounts: number[],
): string {
  const disp = `${rank}${suit}`;
  switch (tier) {
    case 'genbutsu':
      return `Genbutsu: this seat already discarded ${disp} — it cannot be waiting on it.`;
    case 'kabe': {
      const neighbors = [rank - 1, rank + 1].filter((r) => r >= 1 && r <= 9);
      const killed = neighbors
        .filter((r) => (visibleCounts[kindFor(suit, r)] ?? 0) >= 4)
        .map((r) => `${r}${suit}`)
        .join(' and ');
      return `Kabe: all four ${killed} are visible, so the one-sided wait on ${disp} is dead. The tile is safe against wall-reading opponents for that wait only.`;
    }
    case 'suji':
      return `Suji: this seat discarded a suji partner of ${disp} (1-4-7 / 2-5-8 / 3-6-9 spacing), so ${disp} is far less likely to be their wait.`;
    case 'oneChance':
      return `One chance: only three copies of a neighbor tile are visible, so at most one copy of ${disp} can support that wait.`;
    case 'honor':
      return `A live honor: if it is still unseen it has no suji at all, but honors are usually kept as pairs, not waits — moderately safe until one of its copies appears.`;
    case 'danger':
      return `Live danger: no suji, no kabe, no genbutsu — ${disp} is a full wait candidate for this seat.`;
  }
}

/** Every still-live tile kind vs a seat, most dangerous first (low score). */
export function safetyRankingFor(view: PublicView, seat: SeatIndex): SafetyVerdict[] {
  const riverKinds = [...new Set(view.seats[seat].river.map((d) => kindOf(d.tile)))];
  const out: SafetyVerdict[] = [];
  for (let k = 0; k < 34; k++) {
    if (visibleCount(k, view) >= 4) continue; // no copies can remain — dead tile
    out.push(safetyOfKind(k, riverKinds, view.visibleCounts));
  }
  // score ascending = dangerous first; tiebreak: honors after numbers naturally
  return out.sort((a, b) => a.score - b.score);
}

/** Genbutsu + kabe + suji kinds vs a seat — "safe to throw" classes (score >= 2). */
export function safeKindsFor(view: PublicView, seat: SeatIndex): number[] {
  return safetyRankingFor(view, seat).filter((v) => v.score >= 2).map((v) => v.kind);
}

/** All distinct river kinds of a seat, sorted (public). */
export function seatRiverKinds(view: PublicView, seat: SeatIndex): number[] {
  return [...new Set(view.seats[seat].river.map((d) => kindOf(d.tile)))].sort((a, b) => a - b);
}
