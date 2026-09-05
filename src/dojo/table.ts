/**
 * dojo/table — a scripted position on the real engine.
 *
 * A lesson is not a picture of a table, it is a table. Every position in the
 * course is a genuine `GameState`: the engine deals it, the engine says which
 * discards are legal, the engine decides whether your hand is tenpai. The only
 * thing the lesson controls is what the wall hands you.
 *
 * That matters for more than presentation. A hand written by hand in a lesson
 * file can be quietly illegal — fifteen tiles, five copies of a tile, a
 * "tenpai" shape that is actually a complete hand. Build it through the engine
 * and those mistakes stop being possible: the state either constructs or it
 * throws, and the test suite runs every scripted position in the course.
 */
import {
  allTileIds, createMatch, DEFAULT_SETTINGS, doraKindForIndicator, kindOf, sortIds, toPublicView,
} from '@engine/index';
import type {
  GameState, Meld, PublicView, SeatIndex, TableSettings, TileId, Wind,
} from '@engine/types';
import { parseHand } from '@ai/handEval';

export interface TableScript {
  /** The viewer's concealed tiles, in engine notation. */
  hand: string;
  /** The tile just drawn, shown apart from the hand. */
  draw?: string;
  /**
   * Face-up dora indicator. When omitted, one is chosen whose dora is not in
   * the viewer's hand and is not a yakuhai, so an unstated dora can never
   * quietly change which discard a lesson should recommend.
   */
  dora?: string;
  /** Discards already made, per seat, oldest first. */
  rivers?: Partial<Record<SeatIndex, string>>;
  /** Seats that have declared riichi. */
  riichi?: SeatIndex[];
  /**
   * Open sets an opponent has called, per seat, each as a three-tile notation
   * ("111p" is a pon, "234s" a chi). They come out of that seat's concealed
   * tiles, so an opponent with two melds shows seven backs, as at a table.
   */
  melds?: Partial<Record<SeatIndex, string[]>>;
  /**
   * Tiles left in the live wall. Defaults to what the ponds imply: seventy at
   * the deal, one fewer per discard, so a scripted turn eight reads as one.
   */
  wall?: number;
  seatWind?: Wind;
  roundWind?: Wind;
  settings?: Partial<TableSettings>;
}

const SEATS: SeatIndex[] = [0, 1, 2, 3];
const WINDS: Wind[] = ['east', 'south', 'west', 'north'];

/**
 * Build a legal game state matching the script. Throws if the script asks for
 * something impossible (a fifth copy of a tile, a sixteen-tile hand), which is
 * exactly what we want a course full of hand-written positions to do.
 */
export function scriptedState(script: TableScript): GameState {
  const settings: TableSettings = { ...DEFAULT_SETTINGS, ...script.settings };
  const base = createMatch(settings, 1);

  const hand = sortIds(parseHand(script.hand));
  const drawn = script.draw ? parseHand(script.draw) : [];
  if (drawn.length > 1) throw new Error('dojo: a draw is one tile');

  // A pond is read oldest first, so keep the script's order: parseHand
  // sorts, and the declaration tile and the latest discard depend on it.
  const inOrder = (notation: string): TileId[] =>
    notation.trim().split(/\s+/).filter(Boolean).flatMap((group) => parseHand(group));
  const rivers: Record<SeatIndex, TileId[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const s of SEATS) {
    const notation = script.rivers?.[s];
    if (notation) rivers[s] = inOrder(notation);
  }

  const dora = script.dora ? parseHand(script.dora) : [];

  const meldTiles: Record<SeatIndex, TileId[][]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const s of SEATS) {
    for (const notation of script.melds?.[s] ?? []) {
      const ids = parseHand(notation);
      if (ids.length !== 3) throw new Error(`dojo: a called set is three tiles, got "${notation}"`);
      const kinds = ids.map(kindOf);
      const isPon = kinds.every((k) => k === kinds[0]);
      const isChi = !isPon && kinds[0] < 27 && kinds[1] === kinds[0] + 1 && kinds[2] === kinds[0] + 2
        && Math.floor(kinds[0] / 9) === Math.floor(kinds[2] / 9);
      if (!isPon && !isChi) throw new Error(`dojo: "${notation}" is neither a pon nor a chi`);
      meldTiles[s].push(ids);
    }
  }

  // Everything the script named, checked for duplicates through the id space:
  // parseHand hands out distinct copies, but two separate calls can collide.
  const used = new Map<number, number>(); // kind -> count
  const claim = (ids: TileId[], where: string) => {
    for (const id of ids) {
      const k = kindOf(id);
      const n = (used.get(k) ?? 0) + 1;
      if (n > 4) throw new Error(`dojo: a fifth copy of tile kind ${k} in ${where}`);
      used.set(k, n);
    }
  };
  claim(hand, 'hand');
  claim(drawn, 'draw');
  for (const s of SEATS) claim(rivers[s], `river ${s}`);
  for (const s of SEATS) for (const m of meldTiles[s]) claim(m, `meld of seat ${s}`);
  claim(dora, 'dora');

  const handSize = hand.length + drawn.length;
  if (handSize !== 13 && handSize !== 14) {
    throw new Error(`dojo: hand + draw must be 13 or 14 tiles, got ${handSize}`);
  }

  // Re-issue every scripted tile from the real 136 so no id is used twice.
  const pool = allTileIds();
  const takeExact = (want: TileId[]): TileId[] => want.map((id) => {
    const k = kindOf(id);
    const at = pool.findIndex((t) => kindOf(t) === k);
    if (at < 0) throw new Error(`dojo: no copies of tile kind ${k} left`);
    return pool.splice(at, 1)[0];
  });

  const myHand = takeExact(hand);
  const myDraw = takeExact(drawn)[0] ?? null;
  const riverTiles: Record<SeatIndex, TileId[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const s of SEATS) riverTiles[s] = takeExact(rivers[s]);
  const doraTiles = takeExact(dora);
  const calledSets: Record<SeatIndex, Meld[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const s of SEATS) {
    for (const want of meldTiles[s]) {
      const tiles = takeExact(want);
      const pon = tiles.every((t) => kindOf(t) === kindOf(tiles[0]));
      // Called from the seat before them in turn order, as most calls are.
      const from = ((s + 3) % 4) as SeatIndex;
      calledSets[s].push({
        type: pon ? 'pon' : 'chi', tiles, calledFrom: from, calledTile: tiles[0], concealed: false,
      });
    }
  }

  // Whatever is left fills the opponents' hands, the wall and the dead wall.
  const rest = pool;
  let at = 0;
  const deal = (n: number) => rest.slice(at, at += n);

  const riichiSeats = new Set(script.riichi ?? []);
  const players = SEATS.map((s) => {
    const isMe = s === 0;
    return {
      ...base.players[s],
      seat: s,
      seatWind: isMe ? (script.seatWind ?? 'east') : WINDS[(s + WINDS.indexOf(script.seatWind ?? 'east')) % 4],
      hand: isMe ? myHand : sortIds(deal(13 - 3 * calledSets[s].length)),
      drawnTile: isMe ? myDraw : null,
      melds: calledSets[s],
      // A riichi seat's most recent discard is its declaration tile (laid
      // sideways), which is where the eye goes first when reading a pond.
      river: riverTiles[s].map((tile, i) => ({
        tile, tsumogiri: false,
        riichiDeclaration: riichiSeats.has(s) && i === riverTiles[s].length - 1,
        calledBy: null, turnNumber: i,
      })),
      riichi: riichiSeats.has(s),
      riichiTurn: riichiSeats.has(s) ? Math.max(0, riverTiles[s].length - 1) : null,
      ippatsu: false,
      isClosed: calledSets[s].length === 0,
      forbiddenDiscards: [],
      aiPersonalityId: isMe ? null : `dojo-${s}`,
    };
  }) as unknown as GameState['players'];

  // The indicator lives at the front of the dead wall. With no dora scripted,
  // choose one the lesson can ignore.
  const indicator = doraTiles[0] ?? harmlessIndicator(
    [...myHand, ...(myDraw !== null ? [myDraw] : [])],
    SEATS.flatMap((s) => riverTiles[s]),
    rest.slice(at),
  );
  if (!doraTiles.length) rest.splice(rest.indexOf(indicator), 1);
  const deadWall = [indicator, ...deal(13)];
  // What is left after the hands, ponds, melds and dead wall is exactly the
  // live wall a real game would have at this point, so by default the count
  // in the middle of the table agrees with the ponds around it.
  const discards = SEATS.reduce<number>((n, s) => n + riverTiles[s].length, 0);
  const wallSize = Math.max(0, Math.min(script.wall ?? rest.length - at, rest.length - at));

  // The seat holding the East wind deals; only the viewer's wind is scripted.
  const dealer = SEATS.find((s) => players[s].seatWind === 'east') ?? 0;

  return {
    ...base,
    settings,
    roundWind: script.roundWind ?? 'east',
    players,
    wall: deal(wallSize),
    deadWall,
    dealer,
    doraIndicators: [indicator],
    uraIndicators: [deadWall[5]],
    turn: 0,
    // Fourteen tiles means it is your turn to throw, whether the script
    // separated the drawn tile out or not.
    phase: handSize === 14 ? 'awaitingDiscard' : 'awaitingDraw',
    turnNumber: discards,
    // Thirteen tiles means the seat before you has just thrown: that tile is
    // the one on the table right now, the one a call would be about.
    lastDiscard: handSize === 13 && riverTiles[3].length
      ? { tile: riverTiles[3][riverTiles[3].length - 1], from: 3 }
      : null,
    callWindow: null,
    handOver: null,
    matchOver: null,
  };
}

/**
 * An indicator whose dora matters as little as possible to the position: not
 * a tile the viewer holds or sits next to, not lying in a pond, never a
 * yakuhai, and preferably in the suit the viewer is using least.
 */
function harmlessIndicator(mine: TileId[], ponds: TileId[], candidates: TileId[]): TileId {
  const held = new Array<number>(34).fill(0);
  for (const id of mine) held[kindOf(id)] += 1;
  const seen = new Array<number>(34).fill(0);
  for (const id of ponds) seen[kindOf(id)] += 1;
  const suitLoad = [0, 1, 2].map((s) => held.slice(s * 9, s * 9 + 9).reduce((a, b) => a + b, 0));
  let best = candidates[0];
  let bestScore = Infinity;
  for (const id of candidates) {
    const k = kindOf(id);
    if (k >= 27) continue; // an honour indicator always points at a yakuhai
    const dora = doraKindForIndicator(k);
    // a dora next to something you hold is a dora you may be waiting on
    let score = held[dora] * 100 + seen[dora] * 20 + suitLoad[Math.floor(k / 9)] * 10;
    for (const d of [-2, -1, 1, 2]) {
      const n = dora + d;
      if (n >= 0 && n < 27 && Math.floor(n / 9) === Math.floor(dora / 9)) score += held[n] * 30;
    }
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best;
}

/**
 * The position fields a course step carries. One helper builds the script so
 * the screen and the test suite can never disagree about which fields count.
 */
export type PositionFields = Partial<Omit<TableScript, 'hand'>> & { hand?: string };

export function stepScript(step: PositionFields): TableScript | null {
  if (!step.hand) return null;
  return {
    hand: step.hand,
    draw: step.draw,
    dora: step.dora,
    rivers: step.rivers,
    riichi: step.riichi,
    melds: step.melds,
    wall: step.wall,
    seatWind: step.seatWind,
    roundWind: step.roundWind,
  };
}

/** The public view of a scripted position, as the viewer sees it. */
export function scriptedView(script: TableScript): PublicView {
  return toPublicView(scriptedState(script), 0);
}

/**
 * Tile ids in the ponds matching a notation string — for pointing at
 * discards. "1m 9m" searches every pond; "2:1m 9m" searches seat 2's only.
 */
export function tilesInRivers(view: PublicView, notation: string): TileId[] {
  const scoped = /^([0-3]):/.exec(notation);
  const seats: SeatIndex[] = scoped ? [Number(scoped[1]) as SeatIndex] : SEATS;
  const wanted = parseHand(scoped ? notation.slice(2) : notation).map(kindOf);
  const out: TileId[] = [];
  for (const k of wanted) {
    for (const s of seats) {
      const hit = view.seats[s].river
        .map((d) => d.tile)
        .find((t) => kindOf(t) === k && !out.includes(t));
      if (hit !== undefined) { out.push(hit); break; }
    }
  }
  return out;
}

/** Tile ids in the viewer's hand matching a notation string ("9s", "13p"). */
export function tilesInHand(view: PublicView, notation: string): TileId[] {
  const wanted = parseHand(notation).map(kindOf);
  const held = [...view.hand, ...(view.drawnTile !== null ? [view.drawnTile] : [])];
  const out: TileId[] = [];
  for (const k of wanted) {
    const found = held.find((t) => kindOf(t) === k && !out.includes(t));
    if (found !== undefined) out.push(found);
  }
  return out;
}
