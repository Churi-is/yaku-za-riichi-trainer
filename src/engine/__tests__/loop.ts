/**
 * Scenario builder for the game-loop tests. Worker A.
 *
 * `setupGame` produces a real, internally consistent `GameState` with hands,
 * melds, rivers and a wall we choose, so tests can drive `applyAction` into an
 * exact situation instead of fishing for one across seeds. Every tile id is
 * allocated exactly once out of the 136.
 */
import { cloneState, createMatch, windForSeat } from '../index';
import { refreshFuriten } from '../furiten';
import { SEATS, idOf, RED_FIVE_KINDS } from '../tiles';
import { parseTokens } from './helpers';
import { DEFAULT_SETTINGS } from '../types';
import type {
  GameState, HandPhase, Meld, SeatIndex, TableSettings, TileId, Wind,
} from '../types';

export interface MeldSpec {
  type: Meld['type'];
  text: string;
  /** Seat the called tile came from; ignored for ankan. */
  calledFrom?: number;
  /** Index into `text` of the called tile (default 0). */
  calledAt?: number;
}

export interface SetupOptions {
  /** Four 13-tile hands (10 if that seat has one open meld, etc.). */
  hands: string[];
  melds?: (MeldSpec[] | undefined)[];
  /** Live wall in draw order; the rest is filled with whatever is left. */
  wall?: string;
  /** Specific drawn tile for the seat on turn. */
  drawn?: string;
  dora?: string;
  ura?: string;
  /** River tiles per seat, oldest first. */
  rivers?: string[];
  dealer?: number;
  roundWind?: Wind;
  roundNumber?: number;
  honba?: number;
  riichiSticks?: number;
  turn?: number;
  phase?: HandPhase;
  turnNumber?: number;
  riichi?: number[];
  points?: number[];
  settings?: Partial<TableSettings>;
}

/** Hands out tile ids from the 136, honouring the red-five copy rule. */
class Allocator {
  private next = new Array<number>(34).fill(0);
  private taken = new Set<TileId>();

  ctx = '?';

  /** Allocate one tile of `kind`. Public so `buildMeld` can call it. */
  take(kind: number, red: boolean): TileId {
    let copy = red ? 0 : this.next[kind];
    if (!red && copy === 0 && RED_FIVE_KINDS.includes(kind as 4)) copy = 1;
    while (this.taken.has(idOf(kind, copy))) copy++;
    if (copy > 3) {
      throw new Error(
        `setupGame(${this.ctx}): a fifth copy of kind ${kind} was requested; `
        + `already taken: ${[...this.taken].filter((id) => Math.floor(id / 4) === kind).join(',')}`,
      );
    }
    this.taken.add(idOf(kind, copy));
    this.next[kind] = copy + 1;
    return idOf(kind, copy);
  }

  /** Sorted ids, for hands and melds. */
  alloc(text: string): TileId[] {
    const ids = parseTokens(text).map((t) => this.take(t.kind, t.red));
    return ids.sort((a, b) => a - b);
  }

  /** Ids in text order, for the wall and indicator lists. */
  allocRaw(text: string): TileId[] {
    return parseTokens(text).map((t) => this.take(t.kind, t.red));
  }

  /** Every id not yet handed out, ascending. */
  rest(): TileId[] {
    const out: TileId[] = [];
    for (let kind = 0; kind < 34; kind++) {
      for (let copy = 0; copy < 4; copy++) {
        const id = idOf(kind, copy);
        if (!this.taken.has(id)) out.push(id);
      }
    }
    return out;
  }
}

function buildMeld(a: Allocator, spec: MeldSpec): Meld {
  const kinds = parseTokens(spec.text).map((t) => t.kind);
  // Take the called tile first so a red five called off a discard is copy 0.
  const at = spec.calledAt ?? 0;
  const ids: TileId[] = [];
  ids.push(a.take(kinds[at], false));
  for (let i = 0; i < kinds.length; i++) if (i !== at) ids.push(a.take(kinds[i], false));
  const sorted = [...ids].sort((x, y) => x - y);
  const concealed = spec.type === 'ankan';
  return {
    type: spec.type,
    tiles: sorted,
    calledFrom: concealed ? null : ((spec.calledFrom ?? 3) as SeatIndex),
    calledTile: concealed ? null : ids[0],
    concealed,
  };
}

export function setupGame(opts: SetupOptions): GameState {
  const settings: TableSettings = { ...DEFAULT_SETTINGS, ...(opts.settings ?? {}) };
  const a = new Allocator();
  a.ctx = (opts.hands ?? []).map((h) => h.slice(0, 12)).join(' | ');
  const state = cloneState(createMatch(settings, 90210));
  state.settings = settings;
  state.dealer = (opts.dealer ?? 0) as SeatIndex;
  state.roundWind = opts.roundWind ?? 'east';
  state.roundNumber = opts.roundNumber ?? 1;
  state.honba = opts.honba ?? 0;
  state.riichiSticks = opts.riichiSticks ?? 0;
  state.turnNumber = opts.turnNumber ?? 0;
  state.handNumber = 1;
  state.kanCount = 0;
  state.lastDiscard = null;
  state.callWindow = null;
  state.chankanTile = null;
  state.paoSeat = null;
  state.handOver = null;
  state.matchOver = null;

  for (const seat of SEATS) {
    const p = state.players[seat];
    p.hand = a.alloc(opts.hands[seat]);
    p.drawnTile = null;
    p.melds = (opts.melds?.[seat] ?? []).map((m) => buildMeld(a, m));
    p.river = (opts.rivers?.[seat] ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((tok) => a.allocRaw(tok))
      .map((tile, i) => ({
        tile,
        tsumogiri: false,
        riichiDeclaration: false,
        calledBy: null,
        turnNumber: i,
      }));
    p.points = opts.points?.[seat] ?? 25000;
    p.seatWind = windForSeat(seat, state.dealer);
    p.riichi = (opts.riichi ?? []).includes(seat);
    p.doubleRiichi = false;
    p.riichiTurn = p.riichi ? 0 : null;
    p.ippatsu = false;
    p.forbiddenDiscards = [];
    p.isClosed = p.melds.every((m) => m.concealed);
    refreshFuriten(p);
  }

  // Indicators, then the dead wall's remaining slots, then the wall.
  const dora = opts.dora ? a.allocRaw(opts.dora) : [];
  const ura = opts.ura ? a.allocRaw(opts.ura) : [];
  const wallHead = opts.wall ? a.allocRaw(opts.wall) : [];
  const drawnIds = opts.drawn ? a.allocRaw(opts.drawn) : [];
  const rest = a.rest();
  const dead: TileId[] = [];
  for (let i = 0; i < 5; i++) dead.push(dora[i] ?? rest.shift()!);
  for (let i = 0; i < 5; i++) dead.push(ura[i] ?? rest.shift()!);
  for (let i = 0; i < 4; i++) dead.push(rest.shift()!);
  state.deadWall = dead;
  // startHand always opens one indicator; mirror that when the test omits it.
  state.doraIndicators = dora.length ? dora : [dead[0]];
  state.uraIndicators = ura;
  state.wall = [...wallHead, ...rest];

  state.turn = (opts.turn ?? state.dealer) as SeatIndex;
  state.phase = opts.phase ?? 'awaitingDraw';
  if (drawnIds.length) {
    state.players[state.turn].drawnTile = drawnIds[0];
  } else if (state.phase === 'awaitingDiscard' && state.players[state.turn].drawnTile === null) {
    // Mirror startHand: the seat on turn holds a drawn tile.
    state.players[state.turn].drawnTile = state.wall.shift()!;
  }
  return state;
}

/** The kinds (not ids) of a player's concealed tiles, including the draw. */
export function concealedKinds(state: GameState, seat: SeatIndex): number[] {
  const p = state.players[seat];
  const pool = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  return pool.map((id) => Math.floor(id / 4)).sort((x, y) => x - y);
}

/** Every tile id on the table, to assert nothing is duplicated or lost. */
export function allTileIds(state: GameState): TileId[] {
  const ids: TileId[] = [...state.wall, ...state.deadWall];
  for (const p of state.players) {
    ids.push(...p.hand);
    if (p.drawnTile !== null) ids.push(p.drawnTile);
    for (const m of p.melds) ids.push(...m.tiles);
    for (const e of p.river) if (e.calledBy === null) ids.push(e.tile);
  }
  return ids.sort((x, y) => x - y);
}
