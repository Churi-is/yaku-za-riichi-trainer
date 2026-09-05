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
  allTileIds, createMatch, DEFAULT_SETTINGS, kindOf, sortIds, toPublicView,
} from '@engine/index';
import type {
  GameState, PublicView, SeatIndex, TableSettings, TileId, Wind,
} from '@engine/types';
import { parseHand } from '@ai/handEval';

export interface TableScript {
  /** The viewer's concealed tiles, in engine notation. */
  hand: string;
  /** The tile just drawn, shown apart from the hand. */
  draw?: string;
  /** Face-up dora indicator. Defaults to a tile nobody in the script holds. */
  dora?: string;
  /** Discards already made, per seat, oldest first. */
  rivers?: Partial<Record<SeatIndex, string>>;
  /** Seats that have declared riichi. */
  riichi?: SeatIndex[];
  /** Tiles left in the live wall. Defaults to a mid-hand figure. */
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

  const rivers: Record<SeatIndex, TileId[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const s of SEATS) {
    const notation = script.rivers?.[s];
    // Discards are chronological: parse token by token so the river keeps the
    // order it was thrown in (parseHand sorts, and the last tile of a riichi
    // seat's river is its sideways declaration tile).
    if (notation) {
      rivers[s] = notation.trim().split(/\s+/).filter(Boolean).flatMap((t) => parseHand(t));
    }
  }

  const dora = script.dora ? parseHand(script.dora) : [];

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

  // Whatever is left fills the opponents' hands, the wall and the dead wall.
  const rest = pool;
  let at = 0;
  const deal = (n: number) => rest.slice(at, at += n);

  const riichiSeats = new Set(script.riichi ?? []);
  const players = SEATS.map((s) => {
    const isMe = s === 0;
    const river = riverTiles[s];
    return {
      ...base.players[s],
      seat: s,
      seatWind: isMe ? (script.seatWind ?? 'east') : WINDS[(s + WINDS.indexOf(script.seatWind ?? 'east')) % 4],
      hand: isMe ? myHand : sortIds(deal(13)),
      drawnTile: isMe ? myDraw : null,
      melds: [],
      river: river.map((tile, i) => ({
        tile,
        tsumogiri: false,
        // A declared seat lies its declaration tile sideways in the river,
        // exactly like the real table — the last discard it ever makes.
        riichiDeclaration: riichiSeats.has(s) && i === river.length - 1,
        calledBy: null,
        turnNumber: i,
      })),
      riichi: riichiSeats.has(s),
      riichiTurn: riichiSeats.has(s) ? 0 : null,
      ippatsu: false,
      isClosed: true,
      forbiddenDiscards: [],
      aiPersonalityId: isMe ? null : `dojo-${s}`,
    };
  }) as unknown as GameState['players'];

  const deadWall = deal(14);
  const wallSize = Math.max(0, Math.min(script.wall ?? 40, rest.length - at));

  return {
    ...base,
    settings,
    roundWind: script.roundWind ?? 'east',
    players,
    wall: deal(wallSize),
    deadWall,
    doraIndicators: doraTiles.length ? doraTiles : [deadWall[0]],
    uraIndicators: [deadWall[5]],
    turn: 0,
    // Fourteen tiles means it is your turn to throw, whether the script
    // separated the drawn tile out or not.
    phase: handSize === 14 ? 'awaitingDiscard' : 'awaitingDraw',
    turnNumber: SEATS.reduce<number>((n, s) => n + riverTiles[s].length, 0),
    lastDiscard: null,
    callWindow: null,
    handOver: null,
    matchOver: null,
  };
}

/** The public view of a scripted position, as the viewer sees it. */
export function scriptedView(script: TableScript): PublicView {
  return toPublicView(scriptedState(script), 0);
}

/** Tile ids in any pond matching a notation string — for pointing at discards. */
export function tilesInRivers(view: PublicView, notation: string): TileId[] {
  const wanted = parseHand(notation).map(kindOf);
  const out: TileId[] = [];
  for (const k of wanted) {
    for (const s of SEATS) {
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
