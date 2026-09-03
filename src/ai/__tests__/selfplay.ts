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
  hand: TileId[];
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
    hand: [], melds: [], river: [], points: 25000,
    riichi: false, riichiTurn: null, ippatsu: false,
    calls: 0, riichiCount: 0, dealIn: 0, ronWins: 0, tsumoWins: 0,
    pointsDelta: 0, decisions: 0,
  };
}

function buildView(
  viewer: SeatIndex,
  seats: SimSeat[],
  wall: TileId[],
  doraIndicators: TileId[],
  lastDiscard: { tile: TileId; from: SeatIndex } | null,
  turnNumber: number,
): PublicView {
  const visible = new Array(34).fill(0);
  for (const t of seats[viewer].hand) visible[kindOf(t)]++;
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
      concealedCount: seats[s].hand.length,
      isClosed: isHandClosed(seats[s].melds),
      aiPersonalityId: null,
    };
  }

  const hand = seats[viewer].hand.slice().sort((a, b) => a - b);
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
    drawnTile: hand.length % 3 === 2 ? hand[hand.length - 1] : null,
    seats: seatsView,
    doraIndicators: doraIndicators.slice(),
    tilesRemaining: wall.length,
    lastDiscard,
    visibleCounts: visible,
  };
}

function legalDiscards(view: PublicView): LegalAction[] {
  const seat = view.viewer;
  const out: LegalAction[] = [];
  const seen = new Set<number>();
  for (const tile of view.hand) {
    const k = kindOf(tile);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      action: { type: 'discard', seat, tile },
      label: `discard ${k}`,
    });
  }
  return out;
}

function legalAnkans(view: PublicView): LegalAction[] {
  const seat = view.viewer;
  const counts = countsOf(view.hand);
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

function discardTile(seat: SimSeat, tile: TileId, turnNumber: number, riichi: boolean): void {
  const k = kindOf(tile);
  const idx = seat.hand.findIndex((t) => t === tile);
  if (idx >= 0) seat.hand.splice(idx, 1);
  else {
    const j = seat.hand.findIndex((t) => kindOf(t) === k);
    if (j >= 0) seat.hand.splice(j, 1);
  }
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
      // --- Active seat draws (unless they just called) ---
      if (drawsThisTurn) {
        if (wall.length <= 0) { done = true; break; }
        seats[active].hand.push(wall.pop()!);
      }
      drawsThisTurn = true; // a normal turn draws; only an immediate call skips it

      // --- Active seat: tsumo / ankan / discard ---
      const view = buildView(active, seats, wall, doraIndicators, lastDiscard, turnNumber);
      let legal: LegalAction[];
      if (shanten(view.hand, seats[active].melds) === -1) {
        legal = [{ action: { type: 'tsumo', seat: active }, label: 'tsumo' }];
      } else {
        legal = legalAnkans(view).concat(legalDiscards(view));
      }
      seats[active].decisions++;
      let decision = ais[active].decide(view, legal).action;
      if (!legal.some((l) => actionsEqual(l.action, decision))) {
        result.perSeat[active].illegal++;
        decision = { type: 'discard', seat: active, tile: view.hand[view.hand.length - 1] };
      }

      if (decision.type === 'tsumo') {
        seats[active].tsumoWins++;
        seats[active].pointsDelta += 2000;
        for (let s = 0; s < 4; s++) if (s !== active) seats[s].pointsDelta -= 667;
        done = true;
        break;
      }

      if (decision.type === 'ankan') {
        const kind = decision.kind;
        seats[active].hand = removeTiles(seats[active].hand, (t) => kindOf(t) === kind, 4);
        const tiles: TileId[] = [kind * 4, kind * 4 + 1, kind * 4 + 2, kind * 4 + 3];
        seats[active].melds.push({ type: 'ankan', tiles, calledFrom: null, calledTile: null, concealed: true });
        if (wall.length > 0) seats[active].hand.push(wall.pop()!); // rinshan
        // Now discard.
        const v2 = buildView(active, seats, wall, doraIndicators, lastDiscard, turnNumber);
        const legal2 = legalDiscards(v2);
        seats[active].decisions++;
        let d2 = ais[active].decide(v2, legal2).action;
        if (!legal2.some((l) => actionsEqual(l.action, d2))) {
          result.perSeat[active].illegal++;
          d2 = { type: 'discard', seat: active, tile: v2.hand[v2.hand.length - 1] };
        }
        if (d2.type === 'discard') {
          decision = d2;
        }
      }

      if (decision.type === 'discard') {
        // The AI sets riichi=true on the discard action when it declares. The
        // sim honors it only when the hand is closed and not already riichi.
        const wantRiichi =
          decision.riichi === true &&
          isHandClosed(seats[active].melds) &&
          !seats[active].riichi &&
          wall.length >= 4;
        discardTile(seats[active], decision.tile, turnNumber, wantRiichi);
        if (wantRiichi) {
          seats[active].riichi = true;
          seats[active].riichiTurn = turnNumber;
          seats[active].riichiCount++;
          seats[active].pointsDelta -= 1000;
        }
        lastDiscard = { tile: decision.tile, from: active };
        turnNumber++;
      } else {
        // Non-discard from draw phase (shouldn't happen) — force a discard.
        const v = buildView(active, seats, wall, doraIndicators, lastDiscard, turnNumber);
        const t = v.hand[v.hand.length - 1];
        discardTile(seats[active], t, turnNumber, false);
        lastDiscard = { tile: t, from: active };
        turnNumber++;
      }

      // --- Call window on the new discard (turn order, head bump) ---
      const discarder = active;
      let caller = -1;
      let callAction: Action | null = null;
      for (let step = 1; step <= 3; step++) {
        const seat = ((discarder + step) % 4) as SeatIndex;
        const cview = buildView(seat, seats, wall, doraIndicators, lastDiscard, turnNumber);
        const clegal = legalCalls(seat, seats, lastDiscard!, wall.length);
        seats[seat].decisions++;
        let cdec = ais[seat].decide(cview, clegal).action;
        if (!clegal.some((l) => actionsEqual(l.action, cdec))) {
          result.perSeat[seat].illegal++;
          cdec = { type: 'pass', seat };
        }
        if (cdec.type === 'ron') {
          seats[seat].ronWins++;
          seats[seat].pointsDelta += 3000;
          seats[discarder].pointsDelta -= 3000;
          seats[discarder].dealIn++;
          done = true;
          caller = -2;
          break;
        }
        if (cdec.type === 'pon' || cdec.type === 'chi' || cdec.type === 'minkan') {
          callAction = cdec;
          caller = seat;
          break; // first claim in turn order wins
        }
      }

      if (done) break;

      if (caller >= 0 && callAction) {
        // Apply the call.
        const calledTile = lastDiscard!.tile;
        const from = lastDiscard!.from;
        let type: Meld['type'];
        let contrib: TileId[] = [];
        if (callAction.type === 'pon') {
          type = 'pon';
          contrib = callAction.tiles.slice();
          seats[caller].hand = removeTiles(seats[caller].hand, (t) => kindOf(t) === kindOf(calledTile), 2);
        } else if (callAction.type === 'chi') {
          type = 'chi';
          contrib = callAction.tiles.slice();
          const k1 = kindOf(contrib[0]);
          const k2 = kindOf(contrib[1]);
          seats[caller].hand = removeTiles(seats[caller].hand, (t) => kindOf(t) === k1, 1);
          seats[caller].hand = removeTiles(seats[caller].hand, (t) => kindOf(t) === k2, 1);
        } else {
          type = 'minkan';
          contrib = callAction.tiles.slice();
          seats[caller].hand = removeTiles(seats[caller].hand, (t) => kindOf(t) === kindOf(calledTile), 3);
        }
        const river = seats[from].river;
        for (let i = river.length - 1; i >= 0; i--) {
          if (river[i].tile === calledTile && river[i].calledBy === null) {
            river[i].calledBy = caller as SeatIndex;
            break;
          }
        }
        seats[caller].melds.push({
          type,
          tiles: contrib.concat(calledTile).sort((a, b) => a - b),
          calledFrom: from,
          calledTile,
          concealed: false,
        });
        seats[caller].calls++;

        // Caller discards without drawing (they hold one extra tile).
        const dview = buildView(caller as SeatIndex, seats, wall, doraIndicators, lastDiscard, turnNumber);
        const dlegal = legalDiscards(dview);
        seats[caller].decisions++;
        let ddec = ais[caller].decide(dview, dlegal).action;
        if (!dlegal.some((l) => actionsEqual(l.action, ddec))) {
          result.perSeat[caller].illegal++;
          ddec = { type: 'discard', seat: caller as SeatIndex, tile: dview.hand[dview.hand.length - 1] };
        }
        if (ddec.type === 'discard') {
          discardTile(seats[caller], ddec.tile, turnNumber, false);
          lastDiscard = { tile: ddec.tile, from: caller as SeatIndex };
          turnNumber++;
        }
        // Next active seat is the one AFTER the caller.
        active = ((caller + 1) % 4) as SeatIndex;
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
