/**
 * engine/kan — ankan / kakan / minkan rules.
 *
 * Ankan needs a replacement tile, so it is unavailable on an empty live wall.
 * After riichi an ankan is allowed only when it cannot change the wait: all
 * four tiles must already be concealed, and the waits before and after must be
 * identical.
 *
 * DOCUMENTED DECISION: chankan (robbing the kan) is allowed on an added kan
 * (kakan) for any hand, and on a CLOSED kan (ankan) only for kokushi musou.
 */
import { kindOf, sortIds } from './tiles';
import { waits } from './shanten';
import type { GameState, Meld, SeatIndex, TileId, TileKind } from './types';

/** Kinds the seat holds four of, across hand + drawn tile. */
export function ankanKinds(state: GameState, seat: SeatIndex): TileKind[] {
  const p = state.players[seat];
  if (state.wall.length === 0) return []; // no replacement tile to draw
  const pool = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  const counts = new Map<TileKind, number>();
  for (const id of pool) counts.set(kindOf(id), (counts.get(kindOf(id)) ?? 0) + 1);
  const out: TileKind[] = [];
  for (const [kind, n] of counts) if (n === 4) out.push(kind);
  return out.sort((a, b) => a - b);
}

function ankanMeldOf(pool: TileId[], kind: TileKind): Meld {
  return {
    type: 'ankan',
    tiles: sortIds(pool.filter((id) => kindOf(id) === kind)),
    calledFrom: null,
    calledTile: null,
    concealed: true,
  };
}

/** After riichi, an ankan must not change the wait. */
export function ankanAllowed(state: GameState, seat: SeatIndex, kind: TileKind): boolean {
  if (!ankanKinds(state, seat).includes(kind)) return false;
  const p = state.players[seat];
  if (!p.riichi) return true;

  // All four tiles must already have been in the concealed hand; if the fourth
  // arrived on this draw, riichi forces a discard instead.
  if (p.hand.filter((id) => kindOf(id) === kind).length !== 4) return false;

  const before = waits(p.hand, p.melds);
  const rest = p.hand.filter((id) => kindOf(id) !== kind);
  const after = waits(rest, [...p.melds, ankanMeldOf(p.hand, kind)]);
  if (before.length === 0 || before.length !== after.length) return false;
  return before.every((k) => after.includes(k));
}

/** Open pongs this seat could upgrade, as the specific tile to add. */
export function kakanOptions(state: GameState, seat: SeatIndex): TileId[] {
  const p = state.players[seat];
  if (state.wall.length === 0) return [];
  const pool = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  const out: TileId[] = [];
  for (const meld of p.melds) {
    if (meld.type !== 'pon') continue;
    const kind = kindOf(meld.tiles[0]);
    const match = pool.find((id) => kindOf(id) === kind);
    if (match !== undefined) out.push(match);
  }
  return out;
}

export { ankanMeldOf };
