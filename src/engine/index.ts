/**
 * SHARED CONTRACT — public surface of the rules engine. Owned by Worker A.
 * The UI (Worker D) and AI (Worker B) drive the game exclusively through this.
 *
 * `applyAction` is pure: it clones, mutates the clone, and returns it. Worker
 * D's replay depends on every past state staying intact.
 */
import type {
  Action, CallWindow, GameState, HandResult, LegalAction, MatchResult, PlayerState,
  PublicSeatView, PublicView, ScoreResult, SeatIndex, TableSettings, TileId, TileKind,
  Meld, Wind,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import { shanten as shantenImpl, waits as waitsImpl, ukeire as ukeireImpl } from './shanten';
import { scoreHand as scoreHandImpl, isLegalWin, basePoints, computePayments } from './scoring';
import { dealHand } from './wall';
import { drawFromWall, rinshanDraw, flipKanDora } from './draw';
import {
  kindOf, nextSeat, SEATS, seatsAfter, sortIds, tileName, isDragon, isWind,
} from './tiles';
import { blocksRon, onDraw, refreshFuriten, applyPassedRon, tenpaiSeats } from './furiten';
import { callOptionsFor } from './calls';
import { ankanAllowed, ankanKinds, ankanMeldOf, kakanOptions } from './kan';
import { canRiichiAtAll, isDoubleRiichiWindow, leavesTenpai, RIICHI_COST } from './riichi';

export * from './types';
export {
  kindOf, suitOf, rankOf, isRed, isHonor, isTerminal, isSimple, isTerminalOrHonor,
  isDragon, isWind, isGreen, countsFromIds, idsFromCounts, tileName, tileNameOfId,
  tileLabel, kindsLabel, doraKindForIndicator, kindOfWind, windOfKind, yakuhaiKinds,
  sortIds, makeTile, allTileIds, nextSeat, seatsAfter, SEATS,
  RED_FIVE_IDS, KIND_COUNT, TILE_COUNT,
} from './tiles';
export {
  shantenFromCounts, isTenpai, isAgari, ukeireTotal, improvingKinds,
  waitingHandSize, clearShantenCache,
} from './shanten';

export interface ScoreInput {
  /**
   * The winner's CONCEALED tiles, and it must INCLUDE `winningTile`
   * (14 tiles for a closed hand, 14 - 3*melds otherwise). Open melds are
   * passed separately and must not appear here.
   */
  hand: TileId[];
  melds: Meld[];
  winningTile: TileId;
  isTsumo: boolean;
  seatWind: Wind;
  roundWind: Wind;
  isDealer: boolean;
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  haitei: boolean;
  houtei: boolean;
  rinshan: boolean;
  chankan: boolean;
  tenhou: boolean;
  chiihou: boolean;
  renhou: boolean;
  doraIndicators: TileId[];
  uraIndicators: TileId[];
  settings: TableSettings;
  /** Winner's seat. Needed for `payments`; defaults to seat 0 when omitted. */
  winnerSeat?: SeatIndex | null;
  /** Seat that discarded the winning tile (ron only; null/omitted for tsumo). */
  loserSeat?: SeatIndex | null;
  /** Pao seat, for daisangen / daisuushii liability. */
  paoSeat?: SeatIndex | null;
  /**
   * Seat holding the dealership, so a tsumo can charge the dealer double.
   * Defaults to the winner's seat when omitted.
   */
  dealerSeat?: SeatIndex | null;
}

// ---------------------------------------------------------------------------
// cloning — applyAction must never touch the state it was given
// ---------------------------------------------------------------------------

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    hand: [...p.hand],
    melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
    river: p.river.map((e) => ({ ...e })),
    forbiddenDiscards: [...p.forbiddenDiscards],
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map(clonePlayer) as GameState['players'],
    wall: [...state.wall],
    deadWall: [...state.deadWall],
    doraIndicators: [...state.doraIndicators],
    uraIndicators: [...state.uraIndicators],
    lastDiscard: state.lastDiscard ? { ...state.lastDiscard } : null,
    callWindow: state.callWindow
      ? { ...state.callWindow, passed: [...state.callWindow.passed], ronSeats: [...state.callWindow.ronSeats] }
      : null,
    handOver: state.handOver ? { ...state.handOver, deltas: { ...state.handOver.deltas }, revealedHands: { ...state.handOver.revealedHands } } : null,
    matchOver: state.matchOver
      ? { ...state.matchOver, ranking: [...state.matchOver.ranking], finalPoints: { ...state.matchOver.finalPoints } }
      : null,
  };
}

// ---------------------------------------------------------------------------
// match / hand setup
// ---------------------------------------------------------------------------

export const WIND_ORDER: Wind[] = ['east', 'south', 'west', 'north'];

function windForSeat(seat: SeatIndex, dealer: SeatIndex): Wind {
  return WIND_ORDER[(seat - dealer + 4) % 4];
}

function freshPlayer(seat: SeatIndex, settings: TableSettings): PlayerState {
  void settings;
  return {
    seat,
    seatWind: 'east',
    hand: [],
    drawnTile: null,
    melds: [],
    river: [],
    points: 25000,
    riichi: false,
    doubleRiichi: false,
    riichiTurn: null,
    ippatsu: false,
    furiten: false,
    temporaryFuriten: false,
    riichiFuriten: false,
    isClosed: true,
    forbiddenDiscards: [],
    aiPersonalityId: null,
  };
}

/** Deal the next hand in place (the caller passes a clone). */
function startHand(state: GameState): GameState {
  state.handNumber += 1;
  const deal = dealHand(state.seed, state.handNumber, state.settings);
  state.wall = deal.wall;
  state.deadWall = deal.deadWall;
  state.doraIndicators = [...deal.doraIndicators];
  state.uraIndicators = [...deal.uraIndicators];
  state.kanCount = 0;
  state.turnNumber = 0;
  state.lastDiscard = null;
  state.callWindow = null;
  state.rinshanPending = false;
  state.chankanTile = null;
  state.paoSeat = null;
  state.handOver = null;

  for (const p of state.players) {
    p.hand = deal.hands[p.seat];
    p.drawnTile = null;
    p.melds = [];
    p.river = [];
    p.seatWind = windForSeat(p.seat, state.dealer);
    p.riichi = false;
    p.doubleRiichi = false;
    p.riichiTurn = null;
    p.ippatsu = false;
    p.furiten = false;
    p.temporaryFuriten = false;
    p.riichiFuriten = false;
    p.isClosed = true;
    p.forbiddenDiscards = [];
  }

  state.turn = state.dealer;
  state.players[state.dealer].drawnTile = drawFromWall(state);
  state.phase = 'awaitingDiscard';
  refreshFuriten(state.players[state.dealer]);
  return state;
}

/** Create a fresh match (deals the first hand). `seed` makes runs reproducible. */
export function createMatch(settings: TableSettings, seed = 0): GameState {
  const state: GameState = {
    settings,
    seed,
    handNumber: 0,
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: 0,
    phase: 'dealing',
    players: [
      freshPlayer(0, settings), freshPlayer(1, settings),
      freshPlayer(2, settings), freshPlayer(3, settings),
    ],
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
  return startHand(state);
}

// ---------------------------------------------------------------------------
// scoring context
// ---------------------------------------------------------------------------

function scoreFor(
  state: GameState, winner: SeatIndex, tile: TileId, isTsumo: boolean,
  loser: SeatIndex | null, chankan: boolean,
): ScoreResult {
  const p = state.players[winner];
  const winnerIsRiichi = p.riichi || p.doubleRiichi;
  return scoreHandImpl({
    hand: sortIds([...p.hand, tile]),
    melds: p.melds,
    winningTile: tile,
    isTsumo,
    seatWind: p.seatWind,
    roundWind: state.roundWind,
    isDealer: state.dealer === winner,
    riichi: p.riichi && !p.doubleRiichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    haitei: isTsumo && state.wall.length === 0,
    houtei: !isTsumo && state.wall.length === 0,
    rinshan: isTsumo && state.rinshanPending,
    chankan,
    tenhou: isTsumo && state.dealer === winner && state.turnNumber === 0,
    chiihou: isTsumo && state.dealer !== winner && state.turnNumber === winner,
    // Renhou: ron on a discard in the first go-around, by a non-dealer.
    renhou: !isTsumo && loser !== null && state.dealer !== winner
      && state.turnNumber === loser + 1,
    doraIndicators: [...state.doraIndicators],
    uraIndicators: winnerIsRiichi ? [...state.uraIndicators] : [],
    settings: state.settings,
    winnerSeat: winner,
    loserSeat: loser,
    paoSeat: state.paoSeat,
    dealerSeat: state.dealer,
  });
}

/** Is this tile a legal win for `seat` right now? */
export function canWinOn(
  state: GameState, seat: SeatIndex, tile: TileId, isTsumo: boolean,
  loser: SeatIndex | null = null,
): boolean {
  const p = state.players[seat];
  const hand = sortIds([...p.hand, tile]);
  if (shantenImpl(hand, p.melds) !== -1) return false;
  return isLegalWin(scoreFor(state, seat, tile, isTsumo, loser, false), state.settings);
}

// ---------------------------------------------------------------------------
// hand endings
// ---------------------------------------------------------------------------

function zeroDeltas(): Record<SeatIndex, number> {
  return { 0: 0, 1: 0, 2: 0, 3: 0 };
}

function revealedHands(state: GameState): Record<SeatIndex, TileId[]> {
  const out = {} as Record<SeatIndex, TileId[]>;
  for (const p of state.players) {
    out[p.seat] = sortIds([...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])]);
  }
  return out;
}

function finishHand(state: GameState, result: HandResult): void {
  for (const s of SEATS) state.players[s].points += result.deltas[s];
  state.handOver = result;
  state.callWindow = null;
  state.phase = 'handOver';
}

function resolveWin(
  state: GameState, winner: SeatIndex, tile: TileId, isTsumo: boolean,
  loser: SeatIndex | null, chankan: boolean,
): void {
  const p = state.players[winner];
  const score = scoreFor(state, winner, tile, isTsumo, loser, chankan);
  const winnerIsRiichi = p.riichi || p.doubleRiichi;
  const deltas = zeroDeltas();
  for (const s of SEATS) deltas[s] = score.payments[s];

  // Honba: 300 per counter on ron, 100 each on tsumo. Pao covers those too.
  if (state.honba > 0) {
    const liable = state.paoSeat;
    if (isTsumo) {
      for (const s of SEATS) {
        if (s === winner) continue;
        const payer = liable !== null ? liable : s;
        deltas[payer] -= 100 * state.honba;
        deltas[winner] += 100 * state.honba;
      }
    } else if (loser !== null) {
      const payer = liable !== null ? liable : loser;
      deltas[payer] -= 300 * state.honba;
      deltas[winner] += 300 * state.honba;
    }
  }

  // Riichi sticks carry to the winner.
  const sticks = state.riichiSticks;
  deltas[winner] += sticks * RIICHI_COST;
  state.riichiSticks = 0; // honba itself advances in nextHand

  finishHand(state, {
    reason: isTsumo ? 'tsumo' : 'ron',
    winner,
    loser,
    score,
    winningTile: tile,
    tenpaiSeats: [],
    deltas,
    renchan: state.dealer === winner,
    revealedHands: revealedHands(state),
    paoSeat: state.paoSeat,
    doraIndicators: [...state.doraIndicators],
    uraIndicators: winnerIsRiichi ? [...state.uraIndicators] : [],
  });
}

/** Standard 3000-point tenpai/noten split, plus 300 per honba. */
function exhaustiveDraw(state: GameState): void {
  const tenpai = tenpaiSeats(state);
  const deltas = zeroDeltas();
  if (tenpai.length > 0 && tenpai.length < 4) {
    const total = 3000 + 300 * state.honba;
    const noten = SEATS.filter((s) => !tenpai.includes(s));
    const perTenpai = total / tenpai.length;
    const perNoten = total / noten.length;
    for (const s of noten) deltas[s] -= perNoten;
    for (const s of tenpai) deltas[s] += perTenpai;
  }
  // Riichi sticks stay on the table for the next winner.
  const renchan = tenpai.includes(state.dealer);
  finishHand(state, {
    reason: 'exhaustiveDraw',
    winner: null,
    loser: null,
    score: null,
    winningTile: null,
    tenpaiSeats: tenpai,
    deltas,
    renchan,
    revealedHands: revealedHands(state),
    paoSeat: null,
    doraIndicators: [...state.doraIndicators],
    uraIndicators: [],
  });
}

// ---------------------------------------------------------------------------
// calls
// ---------------------------------------------------------------------------

/** Options ignoring head-bump and chi-vs-pon priority gating. */
function rawOptions(state: GameState, seat: SeatIndex): { ron: boolean; calls: ReturnType<typeof callOptionsFor> } {
  const win = state.callWindow;
  if (!win) return { ron: false, calls: [] };
  const player = state.players[seat];
  const callsAllowed = win.chankan || state.wall.length > 0;
  const ron = win.ronSeats.includes(seat) && !blocksRon(player);
  const calls = callsAllowed && !win.chankan ? callOptionsFor(state, seat) : [];
  return { ron, calls };
}

function openCallWindow(state: GameState, from: SeatIndex, tile: TileId, chankan: boolean): void {
  const ronSeats: SeatIndex[] = [];
  for (const seat of seatsAfter(from)) {
    // A seat in furiten cannot ron, and must not head-bump a later seat that can.
    if (canWinOn(state, seat, tile, false, from) && !blocksRon(state.players[seat])) {
      ronSeats.push(seat);
    }
  }
  state.callWindow = { tile, from, passed: [], ronSeats, chankan };
  state.chankanTile = chankan ? tile : null;

  const pending = seatsAfter(from).filter((s) => {
    const o = rawOptions(state, s);
    return o.ron || o.calls.length > 0;
  });
  if (pending.length === 0) {
    if (chankan) completeKakan(state);
    else afterDiscard(state);
    return;
  }
  state.phase = 'awaitingCalls';
}

/** Advance to the next player's draw, or end the hand on an empty wall. */
function afterDiscard(state: GameState): void {
  state.callWindow = null;
  state.chankanTile = null;
  if (state.wall.length === 0) {
    exhaustiveDraw(state);
    return;
  }
  state.turn = nextSeat(state.turn);
  state.phase = 'awaitingDraw';
}

/** Seats that currently owe a decision (a call window may involve several). */
export function pendingSeats(state: GameState): SeatIndex[] {
  const win = state.callWindow;
  if (!win || state.phase !== 'awaitingCalls') return [];
  return seatsAfter(win.from).filter((s) => {
    if (win.passed.includes(s)) return false;
    const o = rawOptions(state, s);
    return o.ron || o.calls.length > 0;
  });
}

/** Does any pending seat outrank `seat` for a ron (head bump)? */
function earlierRonPending(state: GameState, seat: SeatIndex): boolean {
  const win = state.callWindow;
  if (!win) return false;
  for (const s of pendingSeats(state)) {
    if (s === seat) return false;
    if (win.ronSeats.includes(s)) return true;
  }
  return false;
}

/** Does any other pending seat hold a call that outranks a chi? */
function betterCallPending(state: GameState, seat: SeatIndex): boolean {
  for (const s of pendingSeats(state)) {
    if (s === seat) continue;
    const o = rawOptions(state, s);
    if (o.ron) return true;
    if (o.calls.some((c) => c.kind === 'pon' || c.kind === 'minkan')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// melds
// ---------------------------------------------------------------------------

function removeTiles(player: PlayerState, ids: TileId[]): void {
  const pool = [...player.hand, ...(player.drawnTile !== null ? [player.drawnTile] : [])];
  for (const id of ids) {
    const at = pool.indexOf(id);
    if (at < 0) throw new Error(`tile ${id} is not in seat ${player.seat}'s hand`);
    pool.splice(at, 1);
  }
  const drawn = player.drawnTile;
  const drawnAt = drawn === null ? -1 : pool.indexOf(drawn);
  if (drawnAt >= 0) {
    player.drawnTile = drawn;
    player.hand = sortIds([...pool.slice(0, drawnAt), ...pool.slice(drawnAt + 1)]);
  } else {
    player.drawnTile = null;
    player.hand = sortIds(pool);
  }
}

/** Mark the river entry for the called tile, and break everyone's ippatsu. */
function consumeCalledTile(state: GameState, seat: SeatIndex, from: SeatIndex): void {
  const win = state.callWindow;
  if (!win) return;
  const discarder = state.players[from];
  for (let i = discarder.river.length - 1; i >= 0; i--) {
    if (discarder.river[i].tile === win.tile && discarder.river[i].calledBy === null) {
      discarder.river[i].calledBy = seat;
      break;
    }
  }
  for (const p of state.players) p.ippatsu = false;
}

/** Pao: whoever fed the third dragon or fourth wind is liable. */
function checkPao(state: GameState, seat: SeatIndex, from: SeatIndex | null): void {
  if (from === null) return;
  const melds = state.players[seat].melds;
  const pungs = melds.filter((m) => m.type !== 'chi').map((m) => kindOf(m.tiles[0]));
  const dragons = pungs.filter(isDragon).length;
  const winds = pungs.filter(isWind).length;
  if (dragons === 3 || winds === 4) state.paoSeat = from;
}

function applyCall(
  state: GameState, seat: SeatIndex, type: 'chi' | 'pon' | 'minkan',
  fromHand: TileId[], forbidden: TileKind[],
): void {
  const win = state.callWindow;
  if (!win) throw new Error('no open call window');
  const player = state.players[seat];
  const tiles = sortIds([...fromHand, win.tile]);
  removeTiles(player, fromHand);
  consumeCalledTile(state, seat, win.from);
  player.melds.push({
    type,
    tiles,
    calledFrom: win.from,
    calledTile: win.tile,
    concealed: false,
  });
  player.isClosed = false;
  player.drawnTile = null;
  player.forbiddenDiscards = forbidden;
  state.turn = seat;
  checkPao(state, seat, win.from);

  if (type === 'minkan') {
    state.kanCount += 1;
    flipKanDora(state);
    const replacement = rinshanDraw(state);
    if (replacement === undefined || replacement === null) {
      exhaustiveDraw(state);
      return;
    }
    player.drawnTile = replacement;
    state.rinshanPending = true;
  }
  state.callWindow = null;
  state.chankanTile = null;
  refreshFuriten(player);
  state.phase = 'awaitingDiscard';
}

function completeKakan(state: GameState): void {
  const win = state.callWindow;
  if (!win) return;
  const seat = win.from;
  const player = state.players[seat];
  const kind = kindOf(win.tile);
  const meld = player.melds.find((m) => m.type === 'pon' && kindOf(m.tiles[0]) === kind);
  if (!meld) throw new Error('kakan with no matching pon');
  removeTiles(player, [win.tile]);
  meld.type = 'kakan';
  meld.tiles = sortIds([...meld.tiles, win.tile]);
  state.kanCount += 1;
  flipKanDora(state);
  const replacement = rinshanDraw(state);
  state.callWindow = null;
  state.chankanTile = null;
  if (replacement === undefined || replacement === null) {
    exhaustiveDraw(state);
    return;
  }
  player.drawnTile = replacement;
  state.rinshanPending = true;
  player.forbiddenDiscards = [];
  state.phase = 'awaitingDiscard';
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

function doDraw(state: GameState, seat: SeatIndex): void {
  if (state.wall.length === 0) {
    exhaustiveDraw(state);
    return;
  }
  const p = state.players[seat];
  // Ippatsu survives exactly one uninterrupted go-around: it dies here, when
  // the declarer draws again, and in applyCall when anyone calls a tile. Any
  // win before this point is inside the window.
  if (p.ippatsu) p.ippatsu = false;
  p.drawnTile = drawFromWall(state);
  state.rinshanPending = false;
  state.phase = 'awaitingDiscard';
  onDraw(p);
}

function doDiscard(
  state: GameState, seat: SeatIndex, tile: TileId, riichi: boolean,
): void {
  const p = state.players[seat];
  const tsumogiri = p.drawnTile === tile;
  removeTiles(p, [tile]);
  // Whatever was drawn and not discarded folds back into the concealed hand;
  // after a discard nobody is holding a drawn tile.
  p.hand = sortIds([...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])]);
  p.drawnTile = null;
  p.river.push({
    tile,
    tsumogiri,
    riichiDeclaration: riichi,
    calledBy: null,
    turnNumber: state.turnNumber,
  });
  if (riichi) {
    p.riichi = true;
    p.doubleRiichi = isDoubleRiichiWindow(state, seat);
    p.riichiTurn = state.turnNumber;
    p.ippatsu = true;
    p.points -= RIICHI_COST;
    state.riichiSticks += 1;
  }
  state.turnNumber += 1;
  state.lastDiscard = { tile, from: seat };
  state.rinshanPending = false;
  p.forbiddenDiscards = [];
  refreshFuriten(p);
  openCallWindow(state, seat, tile, false);
}

function doPass(state: GameState, seat: SeatIndex): void {
  const win = state.callWindow;
  if (!win) return;
  win.passed.push(seat);
  if (win.ronSeats.includes(seat)) applyPassedRon(state.players[seat]);
  if (pendingSeats(state).length === 0) {
    if (win.chankan) completeKakan(state);
    else afterDiscard(state);
  }
}

function doAnkan(state: GameState, seat: SeatIndex, kind: TileKind): void {
  const p = state.players[seat];
  const pool = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])];
  const kanTiles = pool.filter((id) => kindOf(id) === kind);
  const meld = ankanMeldOf(pool, kind);
  removeTiles(p, kanTiles);
  p.melds.push(meld);
  state.kanCount += 1;
  flipKanDora(state);
  const replacement = rinshanDraw(state);
  if (replacement === undefined || replacement === null) {
    exhaustiveDraw(state);
    return;
  }
  p.drawnTile = replacement;
  state.rinshanPending = true;
  refreshFuriten(p);
  state.phase = 'awaitingDiscard';
}

function doKakan(state: GameState, seat: SeatIndex, tile: TileId): void {
  const kind = kindOf(tile);
  const win: CallWindow = { tile, from: seat, passed: [], ronSeats: [], chankan: true };
  for (const s of SEATS) {
    if (s === seat) continue;
    if (canWinOn(state, s, tile, false, seat)) win.ronSeats.push(s);
  }
  state.callWindow = win;
  state.chankanTile = tile;
  if (win.ronSeats.length === 0) {
    completeKakan(state);
    return;
  }
  state.phase = 'awaitingCalls';
}

/** Apply an action. Returns a NEW state (pure; never mutates the input). */
export function applyAction(state: GameState, action: Action): GameState {
  const legal = getLegalActions(state, action.seat);
  if (!legal.some((l) => sameAction(l.action, action))) {
    throw new Error(
      `illegal action ${action.type} for seat ${action.seat} in phase ${state.phase}`,
    );
  }
  const next = cloneState(state);
  switch (action.type) {
    case 'draw':
      doDraw(next, action.seat);
      break;
    case 'discard':
      doDiscard(next, action.seat, action.tile, action.riichi === true);
      break;
    case 'chi':
      applyCall(next, action.seat, 'chi', [...action.tiles], kuikaeFromOption(state, action));
      break;
    case 'pon':
      applyCall(next, action.seat, 'pon', [...action.tiles], [kindOf(state.callWindow!.tile)]);
      break;
    case 'minkan':
      applyCall(next, action.seat, 'minkan', [...action.tiles], [kindOf(state.callWindow!.tile)]);
      break;
    case 'ankan':
      doAnkan(next, action.seat, action.kind);
      break;
    case 'kakan':
      doKakan(next, action.seat, action.tile);
      break;
    case 'ron': {
      const win = state.callWindow!;
      resolveWin(next, action.seat, win.tile, false, win.from, win.chankan);
      break;
    }
    case 'tsumo': {
      const tile = next.players[action.seat].drawnTile;
      if (tile === null) throw new Error('tsumo with no drawn tile');
      resolveWin(next, action.seat, tile, true, null, false);
      break;
    }
    case 'pass':
      doPass(next, action.seat);
      break;
  }
  return next;
}

function kuikaeFromOption(state: GameState, action: Extract<Action, { type: 'chi' }>): TileKind[] {
  const win = state.callWindow;
  if (!win) return [];
  const option = callOptionsFor(state, action.seat).find((o) =>
    o.action.type === 'chi'
    && o.action.tiles[0] === action.tiles[0]
    && o.action.tiles[1] === action.tiles[1]);
  return option ? option.forbiddenDiscards : [kindOf(win.tile)];
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type || a.seat !== b.seat) return false;
  switch (a.type) {
    case 'discard': {
      const o = b as Extract<Action, { type: 'discard' }>;
      return a.tile === o.tile && (a.riichi === true) === (o.riichi === true);
    }
    case 'chi':
    case 'pon': {
      const o = b as Extract<Action, { type: 'chi' | 'pon' }>;
      return a.tiles[0] === o.tiles[0] && a.tiles[1] === o.tiles[1];
    }
    case 'minkan': {
      const o = b as Extract<Action, { type: 'minkan' }>;
      return a.tiles.every((t, i) => t === o.tiles[i]);
    }
    case 'ankan': {
      const o = b as Extract<Action, { type: 'ankan' }>;
      return a.kind === o.kind;
    }
    case 'kakan': {
      const o = b as Extract<Action, { type: 'kakan' }>;
      return a.tile === o.tile;
    }
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// legal actions
// ---------------------------------------------------------------------------

/** All legal actions for a seat right now (empty if it is not their decision). */
export function getLegalActions(state: GameState, seat: SeatIndex): LegalAction[] {
  const out: LegalAction[] = [];
  const player = state.players[seat];

  if (state.phase === 'awaitingDraw') {
    if (seat === state.turn) out.push({ action: { type: 'draw', seat }, label: 'Draw' });
    return out;
  }

  if (state.phase === 'awaitingDiscard') {
    if (seat !== state.turn) return out;
    const pool = [...player.hand, ...(player.drawnTile !== null ? [player.drawnTile] : [])];
    const forbidden = new Set(player.forbiddenDiscards);

    // Win by self-draw.
    if (player.drawnTile !== null && canWinOn(state, seat, player.drawnTile, true)) {
      out.push({ action: { type: 'tsumo', seat }, label: 'Tsumo' });
    }

    for (const tile of [...new Set(pool)]) {
      const kind = kindOf(tile);
      if (forbidden.has(kind)) continue; // kuikae
      // After riichi the drawn tile is the only legal discard.
      if (player.riichi && tile !== player.drawnTile) continue;
      out.push({
        action: { type: 'discard', seat, tile },
        label: `Discard ${tileName(kind)}`,
        forbiddenDiscards: [...forbidden],
      });
      if (!player.riichi && canRiichiAtAll(state, seat) && leavesTenpai(player, tile)) {
        out.push({
          action: { type: 'discard', seat, tile, riichi: true },
          label: `Riichi (discard ${tileName(kind)})`,
          forbiddenDiscards: [...forbidden],
        });
      }
    }

    for (const kind of ankanKinds(state, seat)) {
      if (ankanAllowed(state, seat, kind)) {
        out.push({ action: { type: 'ankan', seat, kind }, label: `Kan ${tileName(kind)}` });
      }
    }
    for (const tile of kakanOptions(state, seat)) {
      out.push({
        action: { type: 'kakan', seat, tile },
        label: `Kan ${tileName(kindOf(tile))}`,
      });
    }
    return out;
  }

  if (state.phase === 'awaitingCalls') {
    const win = state.callWindow;
    if (!win || !pendingSeats(state).includes(seat)) return out;
    const options = rawOptions(state, seat);
    if (options.ron && !earlierRonPending(state, seat)) {
      out.push({ action: { type: 'ron', seat }, label: 'Ron' });
    }
    const calls = options.calls.filter((c) =>
      c.kind !== 'chi' || !betterCallPending(state, seat));
    for (const call of calls) {
      out.push({
        action: call.action,
        label: call.label,
        forbiddenDiscards: call.forbiddenDiscards,
      });
    }
    out.push({ action: { type: 'pass', seat }, label: 'Pass' });
    return out;
  }

  return out;
}

// ---------------------------------------------------------------------------
// public view — the firewall
// ---------------------------------------------------------------------------

function publicSeat(state: GameState, seat: SeatIndex): PublicSeatView {
  const p = state.players[seat];
  return {
    seat: p.seat,
    seatWind: p.seatWind,
    melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
    river: p.river.map((e) => ({ ...e })),
    points: p.points,
    riichi: p.riichi || p.doubleRiichi,
    riichiTurn: p.riichiTurn,
    ippatsu: p.ippatsu,
    concealedCount: p.hand.length + (p.drawnTile !== null ? 1 : 0),
    isClosed: p.isClosed,
    aiPersonalityId: p.aiPersonalityId,
  };
}

/** Project the full state down to what `seat` may legally know. */
export function toPublicView(state: GameState, seat: SeatIndex): PublicView {
  const me = state.players[seat];
  const seats = {} as Record<SeatIndex, PublicSeatView>;
  for (const p of state.players) seats[p.seat] = publicSeat(state, p.seat);

  // Everything this viewer is legitimately allowed to count.
  const visibleCounts = new Array<number>(34).fill(0);
  const add = (id: TileId) => { visibleCounts[kindOf(id)] += 1; };
  for (const id of me.hand) add(id);
  if (me.drawnTile !== null) add(me.drawnTile);
  for (const p of state.players) {
    for (const entry of p.river) if (entry.calledBy === null) add(entry.tile);
    for (const m of p.melds) for (const id of m.tiles) add(id);
  }
  for (const id of state.doraIndicators) add(id);

  return {
    viewer: seat,
    settings: { ...state.settings },
    roundWind: state.roundWind,
    roundNumber: state.roundNumber,
    honba: state.honba,
    riichiSticks: state.riichiSticks,
    dealer: state.dealer,
    turn: state.turn,
    phase: state.phase,
    hand: [...me.hand],
    drawnTile: me.drawnTile,
    furiten: blocksRon(me),
    seats,
    doraIndicators: [...state.doraIndicators],
    tilesRemaining: state.wall.length,
    lastDiscard: state.lastDiscard ? { ...state.lastDiscard } : null,
    visibleCounts,
  };
}

// ---------------------------------------------------------------------------
// match progression
// ---------------------------------------------------------------------------

/** Advance to the next hand; sets `matchOver` when the match ends. */
export function nextHand(state: GameState): GameState {
  if (state.phase !== 'handOver' || !state.handOver) return state;
  const result = state.handOver;
  const next = cloneState(state);
  const renchan = result.renchan;
  const endedWind = next.roundWind;
  const endedNumber = next.roundNumber;

  if (renchan) {
    next.honba += 1;
  } else {
    next.dealer = nextSeat(next.dealer);
    next.honba = 0;
    if (next.dealer === 0) {
      if (next.roundWind === 'east') {
        next.roundWind = 'south';
        next.roundNumber = 1;
      } else {
        next.roundNumber += 1;
      }
    } else {
      next.roundNumber += 1;
    }
  }

  const finalRound = next.settings.gameLength === 'east'
    ? endedWind === 'east' && endedNumber === 4
    : endedWind === 'south' && endedNumber === 4;

  if (finalRound && !renchan) {
    const finalPoints = {} as Record<SeatIndex, number>;
    for (const p of next.players) finalPoints[p.seat] = p.points;
    const ranking = [...SEATS].sort((a, b) =>
      finalPoints[b] - finalPoints[a] || a - b) as SeatIndex[];
    const matchOver: MatchResult = { ranking, finalPoints, handsPlayed: next.handNumber };
    next.matchOver = matchOver;
    next.phase = 'matchOver';
    next.handOver = null;
    return next;
  }

  startHand(next);
  return next;
}

/** Shanten number. 0 = tenpai, -1 = complete. Never below -1. */
export function shanten(hand: TileId[], melds: Meld[]): number {
  return shantenImpl(hand, melds);
}

/** Tiles that improve shanten (ukeire), with remaining-count weights. */
export function ukeire(
  hand: TileId[], melds: Meld[], visibleCounts: number[],
): { kind: number; count: number }[] {
  return ukeireImpl(hand, melds, visibleCounts);
}

/** Winning tile kinds for a tenpai hand (empty if not tenpai). */
export function waits(hand: TileId[], melds: Meld[]): number[] {
  return waitsImpl(hand, melds);
}

/** Score a complete hand. Used by the engine and by replay grading. */
export function scoreHand(input: ScoreInput): ScoreResult {
  return scoreHandImpl(input);
}

export { isLegalWin, basePoints, computePayments };
export type { YakuFlags, YakuContext } from './yaku';
export { YAKU_NAMES, YAKU_HAN, detectYaku } from './yaku';
export type { WinShape, Decomposition, SetInfo, WaitType } from './decompose';
export { enumerateWinShapes } from './decompose';
export { RIICHI_COST };
export { tenpaiSeats, windForSeat };
