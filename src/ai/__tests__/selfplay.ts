/**
 * Simplified seeded self-play simulator for AI separation/legality testing.
 *
 * TEST HARNESS ONLY — not production AI code, and it imports NO engine
 * internals. It is a deliberately minimal riichi model (tile-count based, with
 * chi/pon/minkan/ankan, ron/tsumo, riichi, rivers) that builds the
 * LegalAction[] a seat may take and a PublicView for it, then hands BOTH to
 * the real AI and applies the chosen action. The AI only ever receives the
 * PublicView, so the firewall is exercised honestly. Hand structure uses the
 * same pure shanten/waits the AI reads.
 *
 * Linear turn model: each turn seat draws (if allowed), declares tsumo/ankan
 * or discards; then a single call window over the new discard is resolved in
 * turn order (ron > pon/chi, head bump). A caller becomes the next active
 * seat WITHOUT drawing (the meld + discard keeps tile counts consistent).
 */
import {
  shanten,
  waits,
  kindOf,
  parseHand,
  countsOf,
  isHandClosed,
} from '../handEval';
import type {
  Action,
  LegalAction,
  Meld,
  PublicView,
  SeatIndex,
  TableSettings,
  TileId,
  Wind,
} from '@engine/types';

const SEAT_WINDS: Wind[] = ['east', 'south', 'west', 'north'];

interface RiverEntry {
  tile: TileId;
  tsumogiri: boolean;
  riichiDeclaration: boolean;
  calledBy: SeatIndex | null;
  turnNumber: number;
}

interface SimSeat {
  /** Concealed hand EXCLUDING the just-drawn tile (mirrors PlayerState.hand). */
  hand: TileId[];
  /** Just-drawn tile awaiting discard, or null (mirrors PlayerState.drawnTile). */
  drawnTile: TileId | null;
  melds: Meld[];
  river: RiverEntry[];
  points: number;
  riichi: boolean;
  riichiTurn: number | null;
  ippatsu: boolean;
  calls: number;
  riichiCount: number;
  dealIn: number;
  ronWins: number;
  tsumoWins: number;
  pointsDelta: number;
  decisions: number;
}

export interface SeatStats {
  calls: number;
  dealIn: number;
  riichi: number;
  ronWins: number;
  tsumoWins: number;
  pointsDelta: number;
  decisions: number;
  illegal: number;
}

export interface SimResult {
  handsPlayed: number;
  perSeat: SeatStats[];
}

function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SETTINGS: TableSettings = {
  redDora: true,
  kuitan: true,
  twoHanMinimum: false,
  gameLength: 'east',
  difficulty: 'normal',
};

function newSeat(): SimSeat {
  return {
    hand: [], drawnTile: null, melds: [], river: [], points: 25000,
    riichi: false, riichiTurn: null, ippatsu: false,
    calls: 0, riichiCount: 0, dealIn: 0, ronWins: 0, tsumoWins: 0,
    pointsDelta: 0, decisions: 0,
  };
}

/** Full concealed pool (hand + drawnTile) for a sim seat. */
function seatPool(s: SimSeat): TileId[] {
  return s.drawnTile !== null ? [...s.hand, s.drawnTile] : s.hand;
}

/**
 * Build the viewer's PublicView. `drawnTile` is the freshly drawn tile (held
 * separately from the 13-tile hand, exactly like the real engine), or null in
 * a call window. Mirrors Worker A's `toPublicView` shape.
 */
function buildView(
  viewer: SeatIndex,
  seats: SimSeat[],
  wall: TileId[],
  doraIndicators: TileId[],
  lastDiscard: { tile: TileId; from: SeatIndex } | null,
  _turnNumber: number,
  drawnTile: TileId | null,
): PublicView {
  const me = seats[viewer];
  const visible = new Array(34).fill(0);
  for (const t of me.hand) visible[kindOf(t)]++;
  if (drawnTile !== null) visible[kindOf(drawnTile)]++;
  for (let s = 0; s < 4; s++) {
    for (const m of seats[s].melds) for (const t of m.tiles) visible[kindOf(t)]++;
    for (const e of seats[s].river) if (e.calledBy === null) visible[kindOf(e.tile)]++;
  }
  for (const d of doraIndicators) visible[kindOf(d)]++;

  const seatsView = {} as PublicView['seats'];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    seatsView[s] = {
      seat: s,
      seatWind: SEAT_WINDS[s],
      melds: seats[s].melds,
      river: seats[s].river,
      points: seats[s].points,
      riichi: seats[s].riichi,
      riichiTurn: seats[s].riichiTurn,
      ippatsu: seats[s].ippatsu,
      concealedCount: s === viewer ? me.hand.length + (drawnTile !== null ? 1 : 0) : seats[s].hand.length,
      isClosed: isHandClosed(seats[s].melds),
      aiPersonalityId: null,
    };
  }

  const hand = me.hand.slice().sort((a, b) => a - b);
  return {
    viewer,
    settings: SETTINGS,
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: viewer,
    phase: 'awaitingDiscard',
    hand,
    drawnTile,
    furiten: false,
    seats: seatsView,
    doraIndicators: doraIndicators.slice(),
    tilesRemaining: wall.length,
    lastDiscard,
    visibleCounts: visible,
  };
}

/** Legal discards on the viewer's own turn, shaped like the real engine:
 *  one action per distinct tile kind over hand+drawnTile, plus a separate
 *  riichi-flagged action when discarding it leaves a closed tenpai hand. */
function legalDiscards(view: PublicView): LegalAction[] {
  const seat = view.viewer;
  const melds = view.seats[seat].melds;
  const pool: TileId[] = view.drawnTile !== null ? [...view.hand, view.drawnTile] : view.hand;
  const out: LegalAction[] = [];
  const seen = new Set<number>();
  const closed = melds.every((m) => m.concealed);
  for (const tile of pool) {
    const k = kindOf(tile);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ action: { type: 'discard', seat, tile }, label: `discard ${k}` });
    // Riichi variant: closed, not already riichi, and this discard leaves tenpai.
    if (closed && !view.seats[seat].riichi && view.tilesRemaining >= 4) {
      const rest = pool.filter((t) => t !== tile);
      if (shanten(rest, melds) === 0 && waits(rest, melds).length > 0) {
        out.push({ action: { type: 'discard', seat, tile, riichi: true }, label: `riichi ${k}` });
      }
    }
  }
  return out;
}

function legalAnkans(view: PublicView): LegalAction[] {
  const seat = view.viewer;
  const pool: TileId[] = view.drawnTile !== null ? [...view.hand, view.drawnTile] : view.hand;
  const counts = countsOf(pool);
  const out: LegalAction[] = [];
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 4 && !view.seats[seat].riichi) {
      out.push({ action: { type: 'ankan', seat, kind: k }, label: `ankan ${k}` });
    }
  }
  return out;
}

/** Legal reactions for `seat` to the last discard (ron/pon/chi/minkan/pass). */
function legalCalls(
  seat: SeatIndex,
  seats: SimSeat[],
  lastDiscard: { tile: TileId; from: SeatIndex },
  wallCount: number,
): LegalAction[] {
  const out: LegalAction[] = [];
  const tile = lastDiscard.tile;
  const kind = kindOf(tile);
  const hand = seats[seat].hand;
  const counts = countsOf(hand);

  const trial = hand.concat([tile]);
  if (shanten(trial, seats[seat].melds) === -1) {
    out.push({ action: { type: 'ron', seat }, label: 'ron' });
  }
  if (wallCount <= 0) {
    out.push({ action: { type: 'pass', seat }, label: 'pass' });
    return out;
  }
  if (counts[kind] >= 2) {
    const held = hand.filter((t) => kindOf(t) === kind).slice(0, 2) as [TileId, TileId];
    out.push({ action: { type: 'pon', seat, tiles: held }, label: `pon ${kind}` });
  }
  const kamicha = (seat + 3) % 4;
  if (lastDiscard.from === kamicha && kind < 27) {
    const rank = kind % 9;
    const base = kind - rank;
    const has = (r: number) => r >= 0 && r <= 8 && counts[base + r] > 0;
    const sequences: [number, number][] = [];
    if (has(rank - 2) && has(rank - 1)) sequences.push([rank - 2, rank - 1]);
    if (has(rank - 1) && has(rank + 1)) sequences.push([rank - 1, rank + 1]);
    if (has(rank + 1) && has(rank + 2)) sequences.push([rank + 1, rank + 2]);
    for (const [a, b] of sequences) {
      const ta = hand.find((t) => kindOf(t) === base + a)!;
      const tb = hand.find((t) => kindOf(t) === base + b)!;
      out.push({ action: { type: 'chi', seat, tiles: [ta, tb] }, label: `chi ${a}-${b}` });
    }
  }
  if (counts[kind] >= 3) {
    const held = hand.filter((t) => kindOf(t) === kind).slice(0, 3) as [TileId, TileId, TileId];
    out.push({ action: { type: 'minkan', seat, tiles: held }, label: `minkan ${kind}` });
  }
  out.push({ action: { type: 'pass', seat }, label: 'pass' });
  return out;
}

export interface AiLike {
  decide(view: PublicView, legal: LegalAction[]): { action: Action };
}

function actionsEqual(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  const ax = a as unknown as Record<string, unknown>;
  const bx = b as unknown as Record<string, unknown>;
  for (const key of Object.keys(ax)) {
    const va = ax[key];
    const vb = bx[key];
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.slice().sort().join(',') !== vb.slice().sort().join(',')) return false;
    } else if (va !== vb) {
      return false;
    }
  }
  return true;
}

function removeTiles(hand: TileId[], pred: (t: TileId) => boolean, n: number): TileId[] {
  let removed = 0;
  return hand.filter((t) => {
    if (removed < n && pred(t)) { removed++; return false; }
    return true;
  });
}

/** Discard `tile` from the seat's full pool (hand + drawnTile), returning the
 *  drawn tile to the hand and clearing drawnTile (mirrors the engine discard). */
function discardTile(seat: SimSeat, tile: TileId, turnNumber: number, riichi: boolean): void {
  const k = kindOf(tile);
  const pool = seatPool(seat);
  let idx = pool.findIndex((t) => t === tile);
  if (idx < 0) idx = pool.findIndex((t) => kindOf(t) === k);
  if (idx >= 0) pool.splice(idx, 1);
  seat.hand = pool;
  seat.drawnTile = null;
  seat.river.push({ tile, tsumogiri: false, riichiDeclaration: riichi, calledBy: null, turnNumber });
}

/** Run `hands` hands with four AIs (indexed by seat). */
export function playHands(ais: AiLike[], seed: number, hands: number): SimResult {
  const result: SimResult = {
    handsPlayed: 0,
    perSeat: Array.from({ length: 4 }, () => ({
      calls: 0, dealIn: 0, riichi: 0, ronWins: 0, tsumoWins: 0,
      pointsDelta: 0, decisions: 0, illegal: 0,
    })),
  };

  for (let h = 0; h < hands; h++) {
    const rng = makeRng(seed + h * 7919);
    const wall: TileId[] = [];
    for (let id = 0; id < 136; id++) wall.push(id);
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }
    const doraIndicators = [wall.pop()!];

    const seats: SimSeat[] = [newSeat(), newSeat(), newSeat(), newSeat()];
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 13; i++) seats[s].hand.push(wall.pop()!);
    }

    let turnNumber = 0;
    let active = 0 as SeatIndex;
    let drawsThisTurn = true;
    let lastDiscard: { tile: TileId; from: SeatIndex } | null = null;
    let done = false;
    let guard = 0;

    while (!done && guard++ < 6000) {
      const seat = active;
      const me = seats[seat];
      // --- Draw (normal turn only; a call turn skips the draw) ---
      if (drawsThisTurn) {
        if (wall.length <= 0) { done = true; break; }
        me.drawnTile = wall.pop()!;
      }
      drawsThisTurn = true;

      // --- Active seat: tsumo / ankan / discard ---
      const view = buildView(seat, seats, wall, doraIndicators, lastDiscard, turnNumber, me.drawnTile);
      let legal: LegalAction[];
      const full = seatPool(me);
      if (shanten(full, me.melds) === -1) {
        legal = [{ action: { type: 'tsumo', seat }, label: 'tsumo' }];
      } else {
        legal = legalAnkans(view).concat(legalDiscards(view));
      }
      me.decisions++;
      let decision = ais[seat].decide(view, legal).action;
      if (!legal.some((l) => actionsEqual(l.action, decision))) {
        result.perSeat[seat].illegal++;
        decision = { type: 'discard', seat, tile: me.drawnTile ?? full[full.length - 1] };
      }

      if (decision.type === 'tsumo') {
        me.tsumoWins++;
        me.pointsDelta += 2000;
        for (let s = 0; s < 4; s++) if (s !== seat) seats[s].pointsDelta -= 667;
        done = true;
        break;
      }

      if (decision.type === 'ankan') {
        const k = decision.kind;
        me.hand = seatPool(me);
        me.drawnTile = null;
        me.hand = removeTiles(me.hand, (t) => kindOf(t) === k, 4);
        const tiles: TileId[] = [k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 3];
        me.melds.push({ type: 'ankan', tiles, calledFrom: null, calledTile: null, concealed: true });
        if (wall.length > 0) me.drawnTile = wall.pop()!; // rinshan draw
        // Now discard.
        const v2 = buildView(seat, seats, wall, doraIndicators, lastDiscard, turnNumber, me.drawnTile);
        const legal2 = legalDiscards(v2).concat(legalAnkans(v2));
        me.decisions++;
        let d2 = ais[seat].decide(v2, legal2).action;
        if (!legal2.some((l) => actionsEqual(l.action, d2))) {
          result.perSeat[seat].illegal++;
          d2 = { type: 'discard', seat, tile: me.drawnTile ?? me.hand[me.hand.length - 1] };
        }
        decision = d2;
      }

      if (decision.type === 'discard') {
        const wantRiichi =
          decision.riichi === true &&
          isHandClosed(me.melds) &&
          !me.riichi &&
          wall.length >= 4;
        discardTile(me, decision.tile, turnNumber, wantRiichi);
        if (wantRiichi) {
          me.riichi = true;
          me.riichiTurn = turnNumber;
          me.riichiCount++;
          me.pointsDelta -= 1000;
        }
        lastDiscard = { tile: decision.tile, from: seat };
        turnNumber++;
      } else {
        // Non-discard from draw phase (shouldn't happen) — force a discard.
        const t = me.drawnTile ?? me.hand[me.hand.length - 1];
        discardTile(me, t, turnNumber, false);
        lastDiscard = { tile: t, from: seat };
        turnNumber++;
      }

      // --- Call window on the new discard (turn order, head bump) ---
      const discarder = seat;
      let caller = -1;
      let callAction: Action | null = null;
      for (let step = 1; step <= 3; step++) {
        const rseat = ((discarder + step) % 4) as SeatIndex;
        // Call windows: the seat holds its waiting hand, no drawn tile.
        const cview = buildView(rseat, seats, wall, doraIndicators, lastDiscard, turnNumber, seats[rseat].drawnTile);
        const clegal = legalCalls(rseat, seats, lastDiscard!, wall.length);
        seats[rseat].decisions++;
        let cdec = ais[rseat].decide(cview, clegal).action;
        if (!clegal.some((l) => actionsEqual(l.action, cdec))) {
          result.perSeat[rseat].illegal++;
          cdec = { type: 'pass', seat: rseat };
        }
        if (cdec.type === 'ron') {
          seats[rseat].ronWins++;
          seats[rseat].pointsDelta += 3000;
          seats[discarder].pointsDelta -= 3000;
          seats[discarder].dealIn++;
          done = true;
          caller = -2;
          break;
        }
        if (cdec.type === 'pon' || cdec.type === 'chi' || cdec.type === 'minkan') {
          callAction = cdec;
          caller = rseat;
          break; // first claim in turn order wins
        }
      }

      if (done) break;

      if (caller >= 0 && callAction) {
        const callerSeat = caller as SeatIndex;
        const cme = seats[callerSeat];
        // Flush any held drawn tile back into the hand before applying a call
        // (callers react before their own draw, so this is normally null).
        let hand = seatPool(cme);
        cme.drawnTile = null;
        const calledTile = lastDiscard!.tile;
        const from = lastDiscard!.from;
        let type: Meld['type'];
        let contrib: TileId[] = [];
        if (callAction.type === 'pon') {
          type = 'pon';
          contrib = callAction.tiles.slice();
          hand = removeTiles(hand, (t) => kindOf(t) === kindOf(calledTile), 2);
        } else if (callAction.type === 'chi') {
          type = 'chi';
          contrib = callAction.tiles.slice();
          const k1 = kindOf(contrib[0]);
          const k2 = kindOf(contrib[1]);
          hand = removeTiles(hand, (t) => kindOf(t) === k1, 1);
          hand = removeTiles(hand, (t) => kindOf(t) === k2, 1);
        } else {
          type = 'minkan';
          contrib = callAction.tiles.slice();
          hand = removeTiles(hand, (t) => kindOf(t) === kindOf(calledTile), 3);
        }
        cme.hand = hand;
        const river = seats[from].river;
        for (let i = river.length - 1; i >= 0; i--) {
          if (river[i].tile === calledTile && river[i].calledBy === null) {
            river[i].calledBy = callerSeat;
            break;
          }
        }
        cme.melds.push({
          type,
          tiles: contrib.concat(calledTile).sort((a, b) => a - b),
          calledFrom: from,
          calledTile,
          concealed: false,
        });
        cme.calls++;

        // Caller discards WITHOUT drawing: they hold one extra tile (drawnTile
        // stays null and their hand is one above waiting size until they shed).
        const dview = buildView(callerSeat, seats, wall, doraIndicators, lastDiscard, turnNumber, null);
        const dlegal = legalDiscards(dview);
        cme.decisions++;
        let ddec = ais[callerSeat].decide(dview, dlegal).action;
        if (!dlegal.some((l) => actionsEqual(l.action, ddec))) {
          result.perSeat[callerSeat].illegal++;
          ddec = { type: 'discard', seat: callerSeat, tile: cme.hand[cme.hand.length - 1] };
        }
        if (ddec.type === 'discard') {
          discardTile(cme, ddec.tile, turnNumber, false);
          lastDiscard = { tile: ddec.tile, from: callerSeat };
          turnNumber++;
        }
        // Next active seat is the one AFTER the caller; they draw normally.
        active = ((callerSeat + 1) % 4) as SeatIndex;
        drawsThisTurn = true;
      } else {
        active = ((discarder + 1) % 4) as SeatIndex;
        drawsThisTurn = true;
      }
    }

    result.handsPlayed++;
    for (let s = 0; s < 4; s++) {
      const r = result.perSeat[s];
      r.calls += seats[s].calls;
      r.dealIn += seats[s].dealIn;
      r.riichi += seats[s].riichiCount;
      r.ronWins += seats[s].ronWins;
      r.tsumoWins += seats[s].tsumoWins;
      r.pointsDelta += seats[s].pointsDelta;
      r.decisions += seats[s].decisions;
    }
  }

  return result;
}

export { parseHand };
