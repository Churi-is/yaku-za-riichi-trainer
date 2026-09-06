/**
 * Fallback rules engine (Worker D). Implements the same signatures as
 * @engine/index so the game loop is fully playable before Worker A lands.
 * The adapter in engineAdapter.ts prefers the real engine and only falls back
 * here when the real one throws its "not implemented" stub error.
 *
 * Scope: this is a training opponent, not a tournament-grade rules engine.
 * It supports deal/draw/discard, chi/pon/kan, riichi, ron/tsumo, furiten,
 * exhaustive draw with tenpai payments, dora + ura + aka, honba & sticks,
 * dealer renchan, and East / hanchan match length.
 */
import type {
  Action, DiscardEntry, GameState, HandResult, LegalAction, MatchResult,
  Meld, PlayerState, PublicSeatView, PublicView, ScoreResult, SeatIndex,
  TableSettings, TileId, Wind,
} from '@engine/types';
import type { ScoreInput } from '@engine/index';
import {
  idsToCounts, kindOf, shantenIds, ukeireCounts, waitsIds,
} from './mahjong';
import { fallbackScore } from './fallbackScore';
import { isRedFiveId } from '@ui/tiles';

// --- RNG (mulberry32) ------------------------------------------------------
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WINDS: Wind[] = ['east', 'south', 'west', 'north'];

function buildWall(rng: () => number): TileId[] {
  const ids: TileId[] = [];
  for (let i = 0; i < 136; i++) ids.push(i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function seatWindFor(seat: SeatIndex, dealer: SeatIndex): Wind {
  return WINDS[(seat - dealer + 4) % 4];
}

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function sortHand(ids: TileId[]): TileId[] {
  return [...ids].sort((a, b) => kindOf(a) - kindOf(b) || a - b);
}

// --- createMatch -----------------------------------------------------------

export function createMatch(settings: TableSettings, seed = Date.now()): GameState {
  const state: GameState = {
    settings,
    // Worker A contract fields (CONTRACTS.md 2026-09-03): additive.
    seed: seed >>> 0,
    handNumber: 1,
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: 0,
    phase: 'dealing',
    players: [] as unknown as GameState['players'],
    wall: [],
    deadWall: [],
    doraIndicators: [],
    uraIndicators: [],
    kanCount: 0,
    turnNumber: 0,
    lastDiscard: null,
    callWindow: null,
    rinshanPending: false,
    chankanTile: null,
    paoSeat: null,
    handOver: null,
    matchOver: null,
  };
  // stash seed for reproducible reshuffles per hand
  (state as unknown as { _seed: number })._seed = seed >>> 0;
  dealHand(state);
  return state;
}

function dealHand(state: GameState) {
  const seedHolder = state as unknown as { _seed: number };
  const rng = makeRng((seedHolder._seed ^ (state.roundNumber * 2654435761) ^ (state.honba * 40503)) >>> 0);
  const wall = buildWall(rng);
  const deadWall = wall.splice(0, 14);
  const doraIndicators = [deadWall[4]];
  const uraIndicators = [deadWall[9]];

  const players: PlayerState[] = [];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    const hand = sortHand(wall.splice(0, 13));
    players.push({
      seat: s,
      seatWind: seatWindFor(s, state.dealer),
      hand,
      drawnTile: null,
      melds: [],
      river: [],
      points: state.players[s]?.points ?? 25000,
      riichi: false,
      doubleRiichi: false,
      riichiTurn: null,
      ippatsu: false,
      furiten: false,
      temporaryFuriten: false,
      riichiFuriten: false,
      isClosed: true,
      // Worker A contract field (kuikae kinds); empty until a call is made.
      forbiddenDiscards: [],
      aiPersonalityId: s === 0 ? null : null, // assigned by loop
    });
  }
  // preserve points across hands
  if (state.players.length === 4) {
    for (let s = 0; s < 4; s++) players[s].points = state.players[s].points;
  }
  // preserve AI personality assignments across hands
  if (state.players.length === 4) {
    for (let s = 0; s < 4; s++) players[s].aiPersonalityId = state.players[s].aiPersonalityId;
  }

  state.players = players as GameState['players'];
  state.wall = wall;
  state.deadWall = deadWall;
  state.doraIndicators = doraIndicators;
  state.uraIndicators = uraIndicators;
  state.kanCount = 0;
  state.turnNumber = 0;
  state.turn = state.dealer;
  state.lastDiscard = null;
  state.rinshanPending = false;
  state.chankanTile = null;
  state.handOver = null;
  state.phase = 'awaitingDraw';
  // pending calls tracking
  (state as unknown as CallScratch)._callWindow = null;
}

interface CallScratch {
  _callWindow: {
    tile: TileId;
    from: SeatIndex;
    candidates: SeatIndex[]; // seats still owing a decision
    isChankan?: boolean;
    kanTile?: TileId;
  } | null;
}

// --- Public view -----------------------------------------------------------

export function toPublicView(state: GameState, seat: SeatIndex): PublicView {
  const seats: Record<number, PublicSeatView> = {};
  const visibleCounts = new Array<number>(34).fill(0);

  const me = state.players[seat];
  for (const id of me.hand) visibleCounts[kindOf(id)]++;
  if (me.drawnTile !== null) visibleCounts[kindOf(me.drawnTile)]++;

  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    const p = state.players[s];
    seats[s] = {
      seat: s,
      seatWind: p.seatWind,
      melds: clone(p.melds),
      river: clone(p.river),
      points: p.points,
      riichi: p.riichi,
      riichiTurn: p.riichiTurn,
      ippatsu: p.ippatsu,
      concealedCount: p.hand.length,
      isClosed: p.isClosed,
      aiPersonalityId: p.aiPersonalityId,
    };
    for (const m of p.melds) for (const id of m.tiles) visibleCounts[kindOf(id)]++;
    for (const d of p.river) if (d.calledBy === null) visibleCounts[kindOf(d.tile)]++;
  }
  for (const ind of state.doraIndicators) visibleCounts[kindOf(ind)]++;

  return {
    viewer: seat,
    settings: state.settings,
    roundWind: state.roundWind,
    roundNumber: state.roundNumber,
    honba: state.honba,
    riichiSticks: state.riichiSticks,
    dealer: state.dealer,
    turn: state.turn,
    phase: state.phase,
    hand: clone(me.hand),
    drawnTile: me.drawnTile,
    furiten: !!(me.furiten || me.temporaryFuriten || me.riichiFuriten),
    seats: seats as PublicView['seats'],
    doraIndicators: clone(state.doraIndicators),
    tilesRemaining: state.wall.length,
    lastDiscard: state.lastDiscard ? { ...state.lastDiscard } : null,
    visibleCounts,
  };
}

// --- Legal actions ---------------------------------------------------------

function tileLabel(id: TileId): string {
  const k = kindOf(id);
  const suit = k < 9 ? 'm' : k < 18 ? 'p' : k < 27 ? 's' : 'z';
  const rank = k < 27 ? (k % 9) + 1 : k - 27 + 1;
  const honors = ['E', 'S', 'W', 'N', 'Haku', 'Hatsu', 'Chun'];
  return suit === 'z' ? honors[rank - 1] : `${rank}${suit}`;
}

export function pendingSeats(state: GameState): SeatIndex[] {
  if (state.phase === 'awaitingCalls') {
    const cw = (state as unknown as CallScratch)._callWindow;
    return cw ? [...cw.candidates] : [];
  }
  if (state.phase === 'awaitingDraw' || state.phase === 'awaitingDiscard') {
    return [state.turn];
  }
  return [];
}

export function getLegalActions(state: GameState, seat: SeatIndex): LegalAction[] {
  if (state.phase === 'handOver' || state.phase === 'matchOver') return [];
  const p = state.players[seat];

  // Call window
  if (state.phase === 'awaitingCalls') {
    const cw = (state as unknown as CallScratch)._callWindow;
    if (!cw || !cw.candidates.includes(seat)) return [];
    return callActionsFor(state, seat, cw);
  }

  if (seat !== state.turn) return [];

  if (state.phase === 'awaitingDraw') {
    return [{ action: { type: 'draw', seat }, label: 'Draw' }];
  }

  if (state.phase === 'awaitingDiscard') {
    const actions: LegalAction[] = [];
    const full = p.drawnTile !== null ? [...p.hand, p.drawnTile] : [...p.hand];
    const meldCount = p.melds.length;

    // Tsumo?
    if (p.drawnTile !== null) {
      const counts = idsToCounts(full.map(kindOf));
      if (shantenFromCounts(counts, meldCount) === -1 && hasYakuTsumo(state, seat, full)) {
        actions.push({ action: { type: 'tsumo', seat }, label: 'Tsumo' });
      }
    }

    // Riichi eligibility
    const canRiichi = p.isClosed && !p.riichi && p.points >= 1000 && state.wall.length >= 4;

    // Discards
    if (p.riichi) {
      // only tsumogiri the drawn tile
      if (p.drawnTile !== null) {
        actions.push({ action: { type: 'discard', seat, tile: p.drawnTile }, label: `Discard ${tileLabel(p.drawnTile)}` });
      }
    } else {
      const uniq = new Set<TileId>();
      for (const id of full) {
        if (uniq.has(id)) continue;
        uniq.add(id);
        actions.push({ action: { type: 'discard', seat, tile: id }, label: `Discard ${tileLabel(id)}` });
      }
      // Riichi discards: for each discard that leaves a tenpai hand
      if (canRiichi) {
        const seen = new Set<number>();
        for (const id of full) {
          const kind = kindOf(id);
          if (seen.has(kind)) continue;
          seen.add(kind);
          const rest = removeOne(full, id);
          if (shantenIds(rest, meldCount) === 0) {
            actions.push({ action: { type: 'discard', seat, tile: id, riichi: true }, label: `Riichi + discard ${tileLabel(id)}` });
          }
        }
      }
    }

    // Ankan / kakan
    for (const la of kanDeclareActions(state, seat, full)) actions.push(la);

    return actions;
  }

  return [];
}

function callActionsFor(state: GameState, seat: SeatIndex, cw: NonNullable<CallScratch['_callWindow']>): LegalAction[] {
  const p = state.players[seat];
  const actions: LegalAction[] = [{ action: { type: 'pass', seat }, label: 'Pass' }];
  const tile = cw.tile;
  const tk = kindOf(tile);

  // Chankan: only ron allowed
  if (cw.isChankan) {
    if (canRon(state, seat, cw.kanTile!)) {
      actions.unshift({ action: { type: 'ron', seat }, label: 'Ron (chankan)' });
    }
    return actions;
  }

  // Ron
  if (canRon(state, seat, tile)) {
    actions.unshift({ action: { type: 'ron', seat }, label: 'Ron' });
  }

  // If in riichi, no melds allowed
  if (p.riichi) return actions;

  const counts = idsToCounts(p.hand.map(kindOf));

  // Pon
  if (counts[tk] >= 2) {
    const copies = p.hand.filter((id) => kindOf(id) === tk).slice(0, 2) as [TileId, TileId];
    actions.push({ action: { type: 'pon', seat, tiles: copies }, label: `Pon ${tileLabel(tile)}` });
  }
  // Minkan
  if (counts[tk] >= 3) {
    const copies = p.hand.filter((id) => kindOf(id) === tk).slice(0, 3) as [TileId, TileId, TileId];
    actions.push({ action: { type: 'minkan', seat, tiles: copies }, label: `Kan ${tileLabel(tile)}` });
  }
  // Chi (only from left neighbor = seat-1)
  if (cw.from === ((seat + 3) % 4) && tk < 27) {
    const suitBase = Math.floor(tk / 9) * 9;
    const rankInSuit = tk % 9;
    const has = (k: number) => k >= suitBase && k < suitBase + 9 && counts[k] > 0;
    const findId = (k: number) => p.hand.find((id) => kindOf(id) === k)!;
    const combos: [number, number][] = [];
    if (rankInSuit >= 2 && has(tk - 2) && has(tk - 1)) combos.push([tk - 2, tk - 1]);
    if (rankInSuit >= 1 && rankInSuit <= 7 && has(tk - 1) && has(tk + 1)) combos.push([tk - 1, tk + 1]);
    if (rankInSuit <= 6 && has(tk + 1) && has(tk + 2)) combos.push([tk + 1, tk + 2]);
    for (const [a, b] of combos) {
      actions.push({
        action: { type: 'chi', seat, tiles: [findId(a), findId(b)] as [TileId, TileId] },
        label: `Chi ${tileLabel(findId(a))}${tileLabel(findId(b))}`,
      });
    }
  }

  return actions;
}

function kanDeclareActions(state: GameState, seat: SeatIndex, full: TileId[]): LegalAction[] {
  const p = state.players[seat];
  const out: LegalAction[] = [];
  if (state.wall.length < 1) return out;
  const counts = idsToCounts(full.map(kindOf));
  // Ankan: 4 in hand
  for (let k = 0; k < 34; k++) {
    if (counts[k] === 4) {
      // riichi restricts ankan; keep it simple: allow only if not riichi
      if (!p.riichi) out.push({ action: { type: 'ankan', seat, kind: k }, label: `Ankan ${tileLabel(k * 4)}` });
    }
  }
  // Kakan: have a pon of kind and hold the 4th
  for (const m of p.melds) {
    if (m.type === 'pon') {
      const k = kindOf(m.tiles[0]);
      const held = full.find((id) => kindOf(id) === k);
      if (held !== undefined) {
        out.push({ action: { type: 'kakan', seat, tile: held }, label: `Kakan ${tileLabel(held)}` });
      }
    }
  }
  return out;
}

// --- Win detection helpers -------------------------------------------------

function shantenFromCounts(counts: number[], meldCount: number): number {
  // reuse shantenIds by expanding counts to ids-of-kind (cheap enough here)
  const ids: number[] = [];
  for (let k = 0; k < 34; k++) for (let i = 0; i < counts[k]; i++) ids.push(k * 4);
  return shantenIds(ids, meldCount);
}

function removeOne(ids: TileId[], id: TileId): TileId[] {
  const out = [...ids];
  const i = out.indexOf(id);
  if (i >= 0) out.splice(i, 1);
  return out;
}

/** Does a would-be win have at least one yaku? Approximate but blocks yakuless wins. */
function computeYakuScore(state: GameState, seat: SeatIndex, winTile: TileId, isTsumo: boolean): ScoreResult {
  const p = state.players[seat];
  const hand = isTsumo
    ? (p.drawnTile !== null ? [...p.hand] : removeOne([...p.hand], winTile))
    : [...p.hand];
  // For tsumo, winTile is the drawn tile and hand excludes it.
  const handForScore = isTsumo ? [...p.hand] : [...p.hand];
  const input: ScoreInput = {
    hand: handForScore,
    melds: p.melds,
    winningTile: winTile,
    isTsumo,
    seatWind: p.seatWind,
    roundWind: state.roundWind,
    isDealer: seat === state.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    haitei: isTsumo && state.wall.length === 0,
    houtei: !isTsumo && state.wall.length === 0,
    rinshan: isTsumo && state.rinshanPending,
    chankan: !isTsumo && state.chankanTile !== null,
    tenhou: false,
    chiihou: false,
    renhou: false,
    doraIndicators: state.doraIndicators,
    uraIndicators: p.riichi ? state.uraIndicators : [],
    settings: state.settings,
  };
  void hand;
  return fallbackScore(input);
}

function hasYakuTsumo(state: GameState, seat: SeatIndex, full: TileId[]): boolean {
  const p = state.players[seat];
  const winTile = p.drawnTile!;
  const score = computeYakuScore(state, seat, winTile, true);
  const realYaku = score.yaku.filter((y) => y.han > 0);
  if (realYaku.length === 0) return false;
  if (state.settings.twoHanMinimum && score.han < 2) return false;
  return true;
}

function canRon(state: GameState, seat: SeatIndex, tile: TileId): boolean {
  const p = state.players[seat];
  if (p.furiten || p.temporaryFuriten || p.riichiFuriten) return false;
  const meldCount = p.melds.length;
  const test = [...p.hand, tile];
  if (shantenIds(test, meldCount) !== -1) return false;
  // furiten check: any wait in own river
  const w = waitsIds(p.hand, meldCount);
  const riverKinds = new Set(p.river.map((d) => kindOf(d.tile)));
  if (w.some((k) => riverKinds.has(k))) return false;
  // yaku check
  const saved = p.hand;
  const score = computeYakuScore(state, seat, tile, false);
  void saved;
  const realYaku = score.yaku.filter((y) => y.han > 0);
  if (realYaku.length === 0) return false;
  if (state.settings.twoHanMinimum && score.han < 2) return false;
  return true;
}

// --- applyAction -----------------------------------------------------------

export function applyAction(state: GameState, action: Action): GameState {
  const s = clone(state) as GameState;
  // carry scratch (clone drops non-enumerable but ours is enumerable via assignment)
  (s as unknown as CallScratch)._callWindow = (state as unknown as CallScratch)._callWindow
    ? { ...(state as unknown as CallScratch)._callWindow! }
    : null;
  (s as unknown as { _seed: number })._seed = (state as unknown as { _seed: number })._seed;

  switch (action.type) {
    case 'draw': return doDraw(s, action.seat);
    case 'discard': return doDiscard(s, action.seat, action.tile, !!action.riichi);
    case 'pon': return doPonChi(s, action.seat, 'pon', action.tiles);
    case 'chi': return doPonChi(s, action.seat, 'chi', action.tiles);
    case 'minkan': return doMinkan(s, action.seat, action.tiles);
    case 'ankan': return doAnkan(s, action.seat, action.kind);
    case 'kakan': return doKakan(s, action.seat, action.tile);
    case 'ron': return doRon(s, action.seat);
    case 'tsumo': return doTsumo(s, action.seat);
    case 'pass': return doPass(s, action.seat);
    default: return s;
  }
}

function doDraw(s: GameState, seat: SeatIndex): GameState {
  const p = s.players[seat];
  if (s.wall.length === 0) {
    return exhaustiveDraw(s);
  }
  const tile = s.wall.shift()!;
  p.drawnTile = tile;
  s.phase = 'awaitingDiscard';
  s.rinshanPending = false;
  return s;
}

function drawRinshan(s: GameState, seat: SeatIndex): GameState {
  const p = s.players[seat];
  const tile = s.deadWall.pop() ?? s.wall.shift();
  if (tile === undefined) return exhaustiveDraw(s);
  p.drawnTile = tile;
  s.phase = 'awaitingDiscard';
  s.rinshanPending = true;
  return s;
}

function doDiscard(s: GameState, seat: SeatIndex, tile: TileId, riichi: boolean): GameState {
  const p = s.players[seat];
  const full = p.drawnTile !== null ? [...p.hand, p.drawnTile] : [...p.hand];
  const idx = full.indexOf(tile);
  if (idx < 0) return s;
  full.splice(idx, 1);
  const tsumogiri = tile === p.drawnTile && idx === full.length; // approx
  const wasTsumogiri = p.drawnTile === tile;
  p.drawnTile = null;
  p.hand = sortHand(full);

  if (riichi) {
    p.riichi = true;
    p.riichiTurn = s.turnNumber;
    p.ippatsu = true;
    if (p.river.length === 0 && s.turnNumber < 4) p.doubleRiichi = true;
    s.riichiSticks += 1;
    p.points -= 1000;
  } else {
    p.ippatsu = false;
  }

  const entry: DiscardEntry = {
    tile,
    tsumogiri: wasTsumogiri,
    riichiDeclaration: riichi,
    calledBy: null,
    turnNumber: s.turnNumber,
  };
  p.river.push(entry);
  void tsumogiri;

  s.lastDiscard = { tile, from: seat };
  s.turnNumber += 1;

  // clear ippatsu for others when their turn passes (any discard cancels others' ippatsu window)
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
    if (o !== seat) s.players[o].ippatsu = s.players[o].ippatsu && false;
  }

  // update furiten for the discarder based on own waits
  updateFuriten(s, seat);

  // Open call window
  return openCallWindow(s, tile, seat);
}

function updateFuriten(s: GameState, seat: SeatIndex) {
  const p = s.players[seat];
  const w = waitsIds(p.hand, p.melds.length);
  const riverKinds = new Set(p.river.map((d) => kindOf(d.tile)));
  const inFuriten = w.some((k) => riverKinds.has(k));
  p.furiten = inFuriten;
  if (p.riichi && inFuriten) p.riichiFuriten = true;
}

function openCallWindow(s: GameState, tile: TileId, from: SeatIndex): GameState {
  const candidates: SeatIndex[] = [];
  for (let seat = 0 as SeatIndex; seat < 4; seat = (seat + 1) as SeatIndex) {
    if (seat === from) continue;
    const acts = potentialCalls(s, seat, tile, from);
    if (acts) candidates.push(seat);
  }
  if (candidates.length === 0) {
    return advanceAfterDiscard(s, from);
  }
  s.phase = 'awaitingCalls';
  (s as unknown as CallScratch)._callWindow = { tile, from, candidates };
  return s;
}

/** Does seat have any legal call on this tile? */
function potentialCalls(s: GameState, seat: SeatIndex, tile: TileId, from: SeatIndex): boolean {
  const p = s.players[seat];
  const tk = kindOf(tile);
  // ron
  if (canRon(s, seat, tile)) return true;
  if (p.riichi) return false;
  const counts = idsToCounts(p.hand.map(kindOf));
  if (counts[tk] >= 2) return true; // pon (and maybe kan)
  if (from === ((seat + 3) % 4) && tk < 27) {
    const suitBase = Math.floor(tk / 9) * 9;
    const r = tk % 9;
    const has = (k: number) => k >= suitBase && k < suitBase + 9 && counts[k] > 0;
    if (r >= 2 && has(tk - 2) && has(tk - 1)) return true;
    if (r >= 1 && r <= 7 && has(tk - 1) && has(tk + 1)) return true;
    if (r <= 6 && has(tk + 1) && has(tk + 2)) return true;
  }
  return false;
}

function advanceAfterDiscard(s: GameState, from: SeatIndex): GameState {
  (s as unknown as CallScratch)._callWindow = null;
  s.lastDiscard = null;
  if (s.wall.length === 0) return exhaustiveDraw(s);
  s.turn = ((from + 1) % 4) as SeatIndex;
  s.phase = 'awaitingDraw';
  return s;
}

function doPass(s: GameState, seat: SeatIndex): GameState {
  const cw = (s as unknown as CallScratch)._callWindow;
  if (!cw) return s;
  // temporary furiten if this seat could have ronned and passed
  if (canRon(s, seat, cw.isChankan ? cw.kanTile! : cw.tile)) {
    s.players[seat].temporaryFuriten = true;
    if (s.players[seat].riichi) s.players[seat].riichiFuriten = true;
  }
  cw.candidates = cw.candidates.filter((c) => c !== seat);
  if (cw.candidates.length === 0) {
    if (cw.isChankan) {
      // resume kan: draw rinshan for the kan declarer
      const declarer = cw.from;
      (s as unknown as CallScratch)._callWindow = null;
      s.chankanTile = null;
      return drawRinshan(s, declarer);
    }
    return advanceAfterDiscard(s, cw.from);
  }
  return s;
}

function clearTemporaryFuriten(s: GameState, seat: SeatIndex) {
  s.players[seat].temporaryFuriten = false;
}

function doPonChi(s: GameState, seat: SeatIndex, type: 'pon' | 'chi', tiles: [TileId, TileId]): GameState {
  const cw = (s as unknown as CallScratch)._callWindow;
  if (!cw) return s;
  const p = s.players[seat];
  const called = cw.tile;

  for (const t of tiles) {
    const i = p.hand.indexOf(t);
    if (i >= 0) p.hand.splice(i, 1);
  }
  const meld: Meld = {
    type,
    tiles: sortHand([...tiles, called]),
    calledFrom: cw.from,
    calledTile: called,
    concealed: false,
  };
  p.melds.push(meld);
  p.isClosed = false;

  // remove called tile from discarder's river (mark calledBy)
  markCalled(s, cw.from, called, seat);

  // ippatsu broken for all
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) s.players[o].ippatsu = false;
  clearTemporaryFuriten(s, seat);

  (s as unknown as CallScratch)._callWindow = null;
  s.lastDiscard = null;
  s.turn = seat;
  s.phase = 'awaitingDiscard';
  return s;
}

function markCalled(s: GameState, from: SeatIndex, tile: TileId, by: SeatIndex) {
  const river = s.players[from].river;
  for (let i = river.length - 1; i >= 0; i--) {
    if (river[i].tile === tile && river[i].calledBy === null) {
      river[i].calledBy = by;
      break;
    }
  }
}

function doMinkan(s: GameState, seat: SeatIndex, tiles: [TileId, TileId, TileId]): GameState {
  const cw = (s as unknown as CallScratch)._callWindow;
  if (!cw) return s;
  const p = s.players[seat];
  const called = cw.tile;
  for (const t of tiles) {
    const i = p.hand.indexOf(t);
    if (i >= 0) p.hand.splice(i, 1);
  }
  p.melds.push({
    type: 'minkan',
    tiles: sortHand([...tiles, called]),
    calledFrom: cw.from,
    calledTile: called,
    concealed: false,
  });
  p.isClosed = false;
  markCalled(s, cw.from, called, seat);
  s.kanCount += 1;
  revealKanDora(s);
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) s.players[o].ippatsu = false;
  (s as unknown as CallScratch)._callWindow = null;
  s.lastDiscard = null;
  s.turn = seat;
  return drawRinshan(s, seat);
}

function doAnkan(s: GameState, seat: SeatIndex, kind: number): GameState {
  const p = s.players[seat];
  const full = p.drawnTile !== null ? [...p.hand, p.drawnTile] : [...p.hand];
  const tilesOfKind = full.filter((id) => kindOf(id) === kind).slice(0, 4);
  if (tilesOfKind.length < 4) return s;
  p.drawnTile = null;
  const remaining = full.filter((id) => !tilesOfKind.includes(id));
  p.hand = sortHand(remaining);
  p.melds.push({
    type: 'ankan',
    tiles: tilesOfKind,
    calledFrom: null,
    calledTile: null,
    concealed: true,
  });
  s.kanCount += 1;
  revealKanDora(s);
  s.turn = seat;
  return drawRinshan(s, seat);
}

function doKakan(s: GameState, seat: SeatIndex, tile: TileId): GameState {
  const p = s.players[seat];
  const k = kindOf(tile);
  const full = p.drawnTile !== null ? [...p.hand, p.drawnTile] : [...p.hand];
  const i = full.indexOf(tile);
  if (i < 0) return s;
  full.splice(i, 1);
  p.drawnTile = null;
  p.hand = sortHand(full);
  const meld = p.melds.find((m) => m.type === 'pon' && kindOf(m.tiles[0]) === k);
  if (meld) {
    meld.type = 'kakan';
    meld.tiles = sortHand([...meld.tiles, tile]);
  }
  s.kanCount += 1;
  // chankan window
  const candidates: SeatIndex[] = [];
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
    if (o === seat) continue;
    if (canRon(s, o, tile)) candidates.push(o);
  }
  if (candidates.length > 0) {
    s.chankanTile = tile;
    s.phase = 'awaitingCalls';
    (s as unknown as CallScratch)._callWindow = { tile, from: seat, candidates, isChankan: true, kanTile: tile };
    return s;
  }
  revealKanDora(s);
  return drawRinshan(s, seat);
}

function revealKanDora(s: GameState) {
  const idx = 4 + s.doraIndicators.length;
  if (s.deadWall[idx] !== undefined) {
    s.doraIndicators.push(s.deadWall[idx]);
    const uraIdx = 9 + s.uraIndicators.length;
    if (s.deadWall[uraIdx] !== undefined) s.uraIndicators.push(s.deadWall[uraIdx]);
  }
}

// --- Wins ------------------------------------------------------------------

function doTsumo(s: GameState, seat: SeatIndex): GameState {
  const p = s.players[seat];
  const winTile = p.drawnTile!;
  const score = computeYakuScore(s, seat, winTile, true);
  // fold drawn tile into hand for reveal
  const revealed = buildReveals(s);
  const isDealer = seat === s.dealer;

  const deltas: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const base = Math.round(score.points);
  // distribute tsumo
  if (isDealer) {
    const each = Math.ceil(base / 3 / 100) * 100;
    for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
      if (o !== seat) { deltas[o] -= each + s.honba * 100; deltas[seat] += each + s.honba * 100; }
    }
  } else {
    // recompute proper split
    const parts = tsumoSplit(score, isDealer);
    for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
      if (o === seat) continue;
      const pay = (o === s.dealer ? parts.dealer : parts.nonDealer) + s.honba * 100;
      deltas[o] -= pay;
      deltas[seat] += pay;
    }
  }
  // riichi sticks to winner
  deltas[seat] += s.riichiSticks * 1000;

  applyDeltas(s, deltas);

  const result: HandResult = {
    reason: 'tsumo',
    winner: seat,
    loser: null,
    score,
    winningTile: winTile,
    tenpaiSeats: [],
    deltas: deltas as Record<SeatIndex, number>,
    renchan: isDealer,
    revealedHands: revealed,
    paoSeat: null,
  };
  return endHand(s, result);
}

function tsumoSplit(score: ScoreResult, isDealer: boolean): { dealer: number; nonDealer: number } {
  // derive from limit / han-fu; reuse basePoints logic through points is messy,
  // recompute via total → shares. Simpler: approximate from score.points.
  // We reconstruct base from limitName or han/fu.
  const base = reconstructBase(score);
  if (isDealer) {
    const each = Math.ceil(base * 2 / 100) * 100;
    return { dealer: each, nonDealer: each };
  }
  return {
    dealer: Math.ceil(base * 2 / 100) * 100,
    nonDealer: Math.ceil(base / 100) * 100,
  };
}

function reconstructBase(score: ScoreResult): number {
  switch (score.limitName) {
    case 'yakuman': return 8000;
    case 'sanbaiman': return 6000;
    case 'baiman': return 4000;
    case 'haneman': return 3000;
    case 'mangan': return 2000;
    default: return score.fu * Math.pow(2, 2 + score.han);
  }
}

function doRon(s: GameState, seat: SeatIndex): GameState {
  const cw = (s as unknown as CallScratch)._callWindow;
  const winTile = cw ? (cw.isChankan ? cw.kanTile! : cw.tile) : (s.lastDiscard?.tile ?? 0);
  const loser = cw ? cw.from : (s.lastDiscard?.from ?? 0) as SeatIndex;
  const score = computeYakuScore(s, seat, winTile, false);
  const isDealer = seat === s.dealer;
  const revealed = buildReveals(s);

  const deltas: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const pay = Math.round(score.points) + s.honba * 300;
  deltas[loser] -= pay;
  deltas[seat] += pay;
  deltas[seat] += s.riichiSticks * 1000;

  applyDeltas(s, deltas);

  const result: HandResult = {
    reason: 'ron',
    winner: seat,
    loser: loser as SeatIndex,
    score,
    winningTile: winTile,
    tenpaiSeats: [],
    deltas: deltas as Record<SeatIndex, number>,
    renchan: isDealer,
    revealedHands: revealed,
    paoSeat: null,
  };
  return endHand(s, result);
}

function applyDeltas(s: GameState, deltas: Record<number, number>) {
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) s.players[o].points += deltas[o];
  s.riichiSticks = 0;
}

function buildReveals(s: GameState): Record<SeatIndex, TileId[]> {
  const r: Record<number, TileId[]> = {};
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
    const p = s.players[o];
    r[o] = p.drawnTile !== null ? sortHand([...p.hand, p.drawnTile]) : [...p.hand];
  }
  return r as Record<SeatIndex, TileId[]>;
}

function exhaustiveDraw(s: GameState): GameState {
  const tenpaiSeats: SeatIndex[] = [];
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
    const p = s.players[o];
    if (shantenIds(p.hand, p.melds.length) === 0) tenpaiSeats.push(o);
  }
  const deltas: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const nt = tenpaiSeats.length;
  if (nt > 0 && nt < 4) {
    const gain = Math.floor(3000 / nt);
    const loss = Math.floor(3000 / (4 - nt));
    for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) {
      if (tenpaiSeats.includes(o)) deltas[o] += gain;
      else deltas[o] -= loss;
    }
  }
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) s.players[o].points += deltas[o];

  const revealed = buildReveals(s);
  const dealerTenpai = tenpaiSeats.includes(s.dealer);
  const result: HandResult = {
    reason: 'exhaustiveDraw',
    winner: null,
    loser: null,
    score: null,
    winningTile: null,
    tenpaiSeats,
    deltas: deltas as Record<SeatIndex, number>,
    renchan: dealerTenpai,
    revealedHands: revealed,
    paoSeat: null,
  };
  return endHand(s, result);
}

function endHand(s: GameState, result: HandResult): GameState {
  s.handOver = result;
  s.phase = 'handOver';
  s.lastDiscard = null;
  (s as unknown as CallScratch)._callWindow = null;
  return s;
}

// --- nextHand --------------------------------------------------------------

export function nextHand(state: GameState): GameState {
  const s = clone(state) as GameState;
  (s as unknown as { _seed: number })._seed = (state as unknown as { _seed: number })._seed;
  const prev = state.handOver;
  const dealerWonOrTenpai = prev?.renchan ?? false;

  // honba
  if (prev && (prev.winner === s.dealer || (prev.reason === 'exhaustiveDraw' && dealerWonOrTenpai))) {
    s.honba += 1;
  } else if (prev && prev.reason === 'exhaustiveDraw') {
    s.honba += 1;
  } else {
    s.honba = 0;
  }

  // rotate dealer unless renchan
  if (!dealerWonOrTenpai) {
    s.dealer = ((s.dealer + 1) % 4) as SeatIndex;
    if (s.dealer === 0) {
      // wind rotated a full lap -> advance round
      s.roundNumber += 1;
      if (s.roundWind === 'east' && s.roundNumber > 4) {
        s.roundWind = 'south';
        s.roundNumber = 1;
      } else if (s.roundWind === 'south' && s.roundNumber > 4) {
        s.roundNumber = 5; // sentinel for end
      }
    }
  }

  // Determine match end
  const bankrupt = s.players.some((p) => p.points < 0);
  const endEast = s.settings.gameLength === 'east';
  let matchEnded = bankrupt;
  // East-only ends after East-4 completes (dealer rotates back to 0 with round advanced)
  if (endEast && s.roundWind === 'east' && s.roundNumber >= 2 && s.dealer === 0 && !dealerWonOrTenpai && wasLastHandEast(state)) {
    matchEnded = true;
  }
  // simpler robust check below via helper
  if (endEast && reachedEndEast(state, dealerWonOrTenpai)) matchEnded = true;
  if (!endEast && reachedEndHanchan(state, dealerWonOrTenpai)) matchEnded = true;

  s.handOver = null;

  if (matchEnded) {
    s.matchOver = buildMatchResult(s, state);
    s.phase = 'matchOver';
    return s;
  }

  dealHand(s);
  return s;
}

function wasLastHandEast(prev: GameState): boolean {
  return prev.roundWind === 'east' && prev.roundNumber === 4;
}
function reachedEndEast(prev: GameState, renchan: boolean): boolean {
  // End when East-4 finishes and dealer would rotate off seat 3
  return prev.roundWind === 'east' && prev.roundNumber === 4 && prev.dealer === 3 && !renchan;
}
function reachedEndHanchan(prev: GameState, renchan: boolean): boolean {
  return prev.roundWind === 'south' && prev.roundNumber === 4 && prev.dealer === 3 && !renchan;
}

function buildMatchResult(s: GameState, prev: GameState): MatchResult {
  const finalPoints: Record<number, number> = {};
  for (let o = 0 as SeatIndex; o < 4; o = (o + 1) as SeatIndex) finalPoints[o] = s.players[o].points;
  const ranking = ([0, 1, 2, 3] as SeatIndex[]).sort((a, b) => finalPoints[b] - finalPoints[a]);
  return {
    ranking,
    finalPoints: finalPoints as Record<SeatIndex, number>,
    handsPlayed: countHands(prev),
  };
}
function countHands(_s: GameState): number {
  return 0; // filled by loop via log; not authoritative here
}

// --- Pure numeric exports --------------------------------------------------

export function shanten(hand: TileId[], melds: Meld[]): number {
  return shantenIds(hand, melds.length);
}

export function ukeire(
  hand: TileId[], melds: Meld[], visibleCounts: number[],
): { kind: number; count: number }[] {
  return ukeireCounts(idsToCounts(hand.map(kindOf)), melds.length, visibleCounts);
}

export function waits(hand: TileId[], melds: Meld[]): number[] {
  return waitsIds(hand, melds.length);
}

export function scoreHand(input: ScoreInput): ScoreResult {
  return fallbackScore(input);
}

// keep tree-shaking honest / silence unused
void isRedFiveId;
void seatWindFor;
