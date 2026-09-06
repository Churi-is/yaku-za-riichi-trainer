/**
 * Public-information defense. Safety belongs to a particular opponent: a tile
 * discarded by a quiet third player is NOT genbutsu against a riichi player.
 * Multiple threats are combined by worst risk, never by unioning safe tiles.
 */
import type { PublicView, SeatIndex, TileKind } from '@engine/types';
import { kindOf, suitOf, rankOf, isHonor, doraCount, yakuhaiKinds, KIND_COUNT } from './handEval';

interface SeatSafety {
  genbutsu: Set<TileKind>;
  suji: Set<TileKind>;
  valueHonors: Set<TileKind>;
  flushSuit: string | null;
}

export interface SafetyContext {
  /** Intersection: safe against EVERY active threat, not just one seat. */
  genbutsu: Set<TileKind>;
  /** Four copies visible. A suited tile can still complete a sequence! */
  dead: Set<TileKind>;
  visibleCounts: readonly number[];
  threats: SeatSafety[];
}

function exposedFlushSuit(view: PublicView, seat: SeatIndex): string | null {
  const info = view.seats[seat];
  const open = info.melds.filter((m) => !m.concealed);
  if (open.length < 2) return null;
  const suits = new Set(open.flatMap((m) => m.tiles).map((t) => suitOf(kindOf(t))).filter((s) => s !== 'z'));
  if (suits.size !== 1) return null;
  const suit = [...suits][0];
  const offSuit = info.river.filter((r) => !isHonor(kindOf(r.tile)) && suitOf(kindOf(r.tile)) !== suit);
  return offSuit.length >= 3 ? suit : null;
}

/** Objective threat of a single seat, including visibly expensive open hands. */
export function seatThreat(view: PublicView, seat: SeatIndex): number {
  const info = view.seats[seat];
  if (!info || seat === view.viewer) return 0;
  let t = 0;
  if (info.riichi) {
    const doubleRiichi = info.river.length > 0 && info.river[0].riichiDeclaration;
    t = doubleRiichi ? 0.95 : 0.85;
    if (info.ippatsu) t += 0.08;
  }
  if (info.melds.length > 0) {
    const shownDora = doraCount([], info.melds, view.doraIndicators, view.settings.redDora);
    const valueHonors = new Set(yakuhaiKinds(info.seatWind, view.roundWind));
    const yakuhai = info.melds.some((m) => m.type !== 'chi' && valueHonors.has(kindOf(m.tiles[0])));
    const open = info.melds.length / 3 * 0.55 + Math.min(0.22, shownDora * 0.07) + (yakuhai ? 0.06 : 0);
    t = Math.max(t, open, exposedFlushSuit(view, seat) ? 0.6 : 0);
  }
  const late = 1 - clamp01(view.tilesRemaining / 70);
  if (info.riichi || info.melds.length > 0) t += late * 0.1;
  else t = Math.max(t, late * 0.35 * (info.concealedCount >= 13 ? 1 : 0.6));
  return clamp01(t);
}

export function tableThreat(view: PublicView): number {
  const perSeat = [0, 0, 0, 0];
  let level = 0;
  for (const s of [0, 1, 2, 3] as const) {
    if (s === view.viewer) continue;
    const th = seatThreat(view, s);
    perSeat[s] = th;
    level = Math.max(level, th);
  }
  const extraThreats = Math.max(0, perSeat.filter((t) => t >= 0.55).length - 1);
  return clamp01(level + extraThreats * 0.07);
}

export function buildSafetyContext(view: PublicView): SafetyContext {
  const dead = new Set<TileKind>();
  for (let k = 0; k < KIND_COUNT; k++) {
    if (view.visibleCounts[k] >= 4) dead.add(k);
  }
  const opponents = ([0, 1, 2, 3] as const).filter((s) => s !== view.viewer);
  const active = opponents.filter((s) => view.seats[s].riichi || seatThreat(view, s) >= 0.5);
  // If nobody is committed, use all rivers for mild safety tie-breaking. Once
  // a real threat exists, quiet seats cannot erase its danger (or its genbutsu).
  const targets = active.length ? active : opponents;
  const threats: SeatSafety[] = targets.map((s) => {
    const info = view.seats[s];
    const genbutsu = new Set(info.river.map((r) => kindOf(r.tile)));
    if (info.riichi && info.riichiTurn !== null) {
      for (const other of Object.values(view.seats)) {
        for (const r of other.river) {
          // Strictly AFTER declaration, and only after the reaction window has
          // resolved. An unprocessed current discard has not been passed yet.
          const unresolved = view.phase === 'awaitingCalls' && view.lastDiscard?.tile === r.tile;
          if (r.turnNumber > info.riichiTurn && !unresolved) genbutsu.add(kindOf(r.tile));
        }
      }
    }
    const suji = new Set<TileKind>();
    for (let k = 0; k < 27; k++) {
      const rank = rankOf(k);
      // Middle tiles need BOTH suji anchors: a discarded 1 does not make a 4
      // safe against 56. Suji is only reduced risk, never a guarantee.
      const lowerCovered = rank <= 3 || genbutsu.has(k - 3);
      const upperCovered = rank >= 7 || genbutsu.has(k + 3);
      if (lowerCovered && upperCovered) suji.add(k);
    }
    return {
      genbutsu, suji,
      valueHonors: new Set(yakuhaiKinds(info.seatWind, view.roundWind)),
      flushSuit: exposedFlushSuit(view, s),
    };
  });
  const genbutsu = new Set(
    [...(threats[0]?.genbutsu ?? [])].filter((k) => threats.every((t) => t.genbutsu.has(k))),
  );
  return { genbutsu, dead, threats, visibleCounts: view.visibleCounts };
}

function dangerAgainst(kind: TileKind, opponent: SeatSafety, ctx: SafetyContext): number {
  if (opponent.genbutsu.has(kind)) return 0;
  const visible = ctx.visibleCounts[kind] ?? 0;
  if (isHonor(kind)) {
    // All four honors visible really is safe; suited tiles are different.
    if (visible >= 4) return 0;
    if (visible === 3) return 0.12;
    if (visible === 2) return 0.32;
    return opponent.valueHonors.has(kind) ? 0.78 : 0.5;
  }
  const rank = rankOf(kind);
  let risk = rank >= 3 && rank <= 7 ? 0.9 : rank === 2 || rank === 8 ? 0.7 : 0.5;
  const lowerBlocked = rank <= 2 || ctx.dead.has(kind - 1) || ctx.dead.has(kind - 2);
  const upperBlocked = rank >= 8 || ctx.dead.has(kind + 1) || ctx.dead.has(kind + 2);
  if (opponent.suji.has(kind) || (lowerBlocked && upperBlocked)) risk = Math.min(risk, rank >= 3 && rank <= 7 ? 0.32 : 0.22);
  // Few remaining copies reduces pair/triplet waits, but does not erase runs.
  if (visible >= 3) risk = Math.max(0.18, risk - 0.08);
  if (opponent.flushSuit === suitOf(kind)) risk += 0.12;
  return clamp01(risk);
}

/** Worst active-seat risk. Safe for one is not safe for all. */
export function dangerOf(kind: TileKind, ctx: SafetyContext): number {
  return Math.max(0, ...ctx.threats.map((t) => dangerAgainst(kind, t, ctx)));
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }
