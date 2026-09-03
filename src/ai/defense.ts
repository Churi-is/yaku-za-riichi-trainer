/**
 * Defense: table-threat assessment and safe-tile ranking, from PUBLIC
 * information only. No concealed tile of any opponent is ever read here —
 * safety is inferred the same way a human reader infers it: rivers, melds,
 * riichi declarations, and visible tile counts (genbutsu / suji / kabe).
 */
import type { PublicView, SeatIndex, TileKind } from '@engine/types';
import {
  kindOf,
  suitOf,
  rankOf,
  isHonor,
  isDragon,
  KIND_COUNT,
} from './handEval';

// ---------------------------------------------------------------------------
// Suji / genbutsu / kabe bookkeeping for one threatening seat
// ---------------------------------------------------------------------------

/** Suji-safe kinds implied by discarding `anchor` kind (a numbered tile). */
function sujiOf(anchor: TileKind): TileKind[] {
  if (isHonor(anchor)) return [];
  const rank = rankOf(anchor); // 1..9
  const base = anchor - (rank - 1);
  const out: TileKind[] = [];
  const add = (r: number): void => {
    if (r >= 1 && r <= 9) out.push(base + (r - 1));
  };
  // Suji pairs: (1,4),(4,7),(2,5),(5,8),(3,6),(6,9).
  if (rank === 1) add(4);
  else if (rank === 2) add(5);
  else if (rank === 3) add(6);
  else if (rank === 4) { add(1); add(7); }
  else if (rank === 5) { add(2); add(8); }
  else if (rank === 6) { add(3); add(9); }
  else if (rank === 7) add(4);
  else if (rank === 8) add(5);
  else if (rank === 9) add(6);
  return out;
}

export interface SafetyContext {
  /** Kinds 100% safe (genbutsu) against the active threats. */
  genbutsu: Set<TileKind>;
  /** Kinds suji-safe against the active threats. */
  suji: Set<TileKind>;
  /** Kinds with all 4 copies visible (dead wall — kabe). */
  dead: Set<TileKind>;
  /** Kinds with 3 copies visible (one-chance). */
  oneChance: Set<TileKind>;
  /** Kinds discarded in the very first turns (early-release honors are safe). */
  early: Set<TileKind>;
}

/**
 * Build the safety context for a viewer folding against the table. Genbutsu is
 * computed per riichi-declared seat: that seat's whole river PLUS every tile
 * discarded afterwards by anyone (a riichi hand auto-wins, so a tile it passed
 * cannot be one of its waits). Non-riichi threats contribute their own river.
 */
export function buildSafetyContext(view: PublicView): SafetyContext {
  const genbutsu = new Set<TileKind>();
  const suji = new Set<TileKind>();
  const dead = new Set<TileKind>();
  const oneChance = new Set<TileKind>();
  const early = new Set<TileKind>();

  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    if (s === view.viewer) continue;
    const seat = view.seats[s];
    if (!seat) continue;

    // Kabe / one-chance from visible counts.
    for (let k = 0; k < KIND_COUNT; k++) {
      const v = view.visibleCounts[k] ?? 0;
      if (v >= 4) dead.add(k);
      else if (v === 3) oneChance.add(k);
    }

    // Early discards (first 6 of this seat) → safe-ish released honors.
    seat.river.slice(0, 6).forEach((e, i) => {
      if (i < 6) early.add(kindOf(e.tile));
    });

    if (seat.riichi) {
      // The riichi player's own river is genbutsu for them.
      for (const e of seat.river) genbutsu.add(kindOf(e.tile));
      // Anything anyone discarded at/after the riichi turn that wasn't won is
      // genbutsu (riichi auto-wins on a winning tile).
      const rTurn = seat.riichiTurn ?? -1;
      for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
        const other = view.seats[o];
        if (!other) continue;
        for (const e of other.river) {
          if (e.turnNumber >= rTurn) genbutsu.add(kindOf(e.tile));
        }
      }
      // Suji from the riichi player's discards.
      for (const e of seat.river) {
        for (const k of sujiOf(kindOf(e.tile))) suji.add(k);
      }
    } else {
      // Non-riichi: their own river is genbutsu for them; milder suji weight.
      for (const e of seat.river) {
        genbutsu.add(kindOf(e.tile));
        for (const k of sujiOf(kindOf(e.tile))) suji.add(k);
      }
    }
  }

  // Dead tiles are safe against everyone.
  for (const k of dead) {
    genbutsu.add(k);
    suji.delete(k);
  }
  return { genbutsu, suji, dead, oneChance, early };
}

/**
 * Danger of discarding tile kind `k` while folding, 0 (safest) .. 1 (very
 * dangerous). Lower = safer. Pure heuristic over the public safety context.
 */
export function dangerOf(kind: TileKind, ctx: SafetyContext): number {
  if (ctx.genbutsu.has(kind)) return 0;
  if (ctx.dead.has(kind)) return 0;

  if (isHonor(kind)) {
    // Honors: genbutsu already handled. Dragons / live winds late are scary.
    if (ctx.early.has(kind)) return 0.35; // released early and still not wanted
    if (isDragon(kind)) return 0.8;
    return 0.55; // wind: yakuhai risk but no ryanmen
  }

  const rank = rankOf(kind);
  // Center tiles form the most ryanmen waits; terminals only edge/closed.
  const centerRisk = rank >= 3 && rank <= 7 ? 0.9 : rank === 2 || rank === 8 ? 0.7 : 0.5;

  if (ctx.suji.has(kind)) {
    // Suji kills ryanmen risk; only kanchan/penchan/tanki remain.
    return rank >= 3 && rank <= 7 ? 0.32 : 0.22;
  }
  if (ctx.oneChance.has(kind)) return Math.max(0.3, centerRisk - 0.35);
  if (ctx.early.has(kind)) return centerRisk - 0.15;
  return centerRisk;
}

// ---------------------------------------------------------------------------
// Threat assessment
// ---------------------------------------------------------------------------

/** Objective threat level (0..1) a single opponent seat poses to the viewer. */
export function seatThreat(view: PublicView, seat: SeatIndex): number {
  const info = view.seats[seat];
  if (!info) return 0;
  let t = 0;

  if (info.riichi) {
    // Double riichi is declared on the seat's very first discard — public.
    const doubleRiichi = info.river.length > 0 && info.river[0].riichiDeclaration;
    t = Math.max(t, doubleRiichi ? 0.95 : 0.85);
    if (info.ippatsu) t = Math.min(1, t + 0.08);
  }

  // Open-hand pressure: more melds → closer to tenpai.
  const meldFrac = info.melds.length / 3;
  let openT = meldFrac * 0.55;
  // An open seat that has discarded toward one suit and holds 3 melds is
  // effectively tenpai; we approximate via meld count + lateness.
  t = Math.max(t, openT);

  // Lateness: fewer live-wall tiles raises everyone's pressure.
  const late = 1 - clamp01(view.tilesRemaining / 70);
  if (info.riichi || info.melds.length > 0) {
    t += late * 0.1;
  } else {
    // Closed, no riichi: mild late tenpai suspicion.
    t = Math.max(t, late * 0.35 * (info.concealedCount >= 13 ? 1 : 0.6));
  }

  return clamp01(t);
}

/** Highest threat among opponents, plus which seat poses it. */
export function tableThreat(
  view: PublicView,
): { level: number; seat: SeatIndex | null; perSeat: number[] } {
  const perSeat = [0, 0, 0, 0];
  let level = 0;
  let seat: SeatIndex | null = null;
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    if (s === view.viewer) continue;
    const th = seatThreat(view, s);
    perSeat[s] = th;
    if (th > level) {
      level = th;
      seat = s;
    }
  }
  return { level, seat, perSeat };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export { clamp01 };
