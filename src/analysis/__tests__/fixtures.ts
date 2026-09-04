/**
 * analysis/__tests__/fixtures — Worker C test helpers.
 * Builds hand-verified PublicViews for the overlays and graders. Everything
 * is public data: own hand, rivers, melds, dora, counts.
 */
import type {
  Meld, PublicSeatView, PublicView, SeatIndex, TableSettings, TileId, Wind,
} from '@engine/types';
import { countsFromIds, kindOf } from '../tileUtil';

export const SETTINGS: TableSettings = {
  redDora: true,
  kuitan: true,
  twoHanMinimum: false,
  gameLength: 'hanchan',
  difficulty: 'normal',
};

/** Turn shorts ("4m","7p","E") into TileIds (copy 0 unless the 5th copy). */
export function ids(...shorts: string[]): TileId[] {
  return shorts.map((s) => {
    const kind = kindOfShort(s);
    return kind * 4;
  });
}

export function kindOfShort(s: string): number {
  const suit = s.slice(-1);
  const rank = parseInt(s.slice(0, -1), 10);
  if (suit === 'm') return rank - 1;
  if (suit === 'p') return 9 + rank - 1;
  if (suit === 's') return 18 + rank - 1;
  const honors: Record<string, number> = {
    E: 27, S: 28, W: 29, N: 30, H: 31, G: 32, C: 33,
  };
  return honors[suit] ?? 0;
}

export function makeMeld(
  type: Meld['type'],
  tiles: TileId[],
  calledFrom: SeatIndex | null = null,
): Meld {
  return {
    type,
    tiles,
    calledFrom,
    calledTile: calledFrom === null ? null : tiles[0],
    concealed: type === 'ankan',
  };
}

interface FixtureOpts {
  hand?: TileId[];
  drawn?: TileId | null;
  /** Player's own melds. */
  melds?: Meld[];
  /** Melds for any seat (overrides seat 0 when present). */
  meldsBySeat?: Partial<Record<SeatIndex, Meld[]>>;
  /** Per-seat discards (tile shorts), keyed by seat. */
  rivers?: Partial<Record<SeatIndex, string[]>>;
  riichi?: SeatIndex[];
  dora?: string[];
  tilesRemaining?: number;
  turnNumber?: number;
  seatWind?: Wind;
  roundWind?: Wind;
  settings?: TableSettings;
  points?: Partial<Record<SeatIndex, number>>;
  isClosed?: boolean;
}

const emptySeat = (seat: SeatIndex, wind: Wind, pts: number): PublicSeatView => ({
  seat,
  seatWind: wind,
  melds: [],
  river: [],
  points: pts,
  riichi: false,
  riichiTurn: null,
  ippatsu: false,
  concealedCount: 13,
  isClosed: true,
  aiPersonalityId: null,
});

export function makeView(opts: FixtureOpts = {}): PublicView {
  const hand = opts.hand ?? [];
  const drawn = opts.drawn ?? null;
  const melds = opts.melds ?? [];
  const settings = opts.settings ?? SETTINGS;
  const winds: Wind[] = ['east', 'south', 'west', 'north'];
  const pts = opts.points ?? {};
  const riichi = new Set<SeatIndex>(opts.riichi ?? []);
  const roundWind = opts.roundWind ?? 'east';

  const seats = {} as Record<SeatIndex, PublicSeatView>;
  for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
    const riverTiles = opts.rivers?.[seat] ?? [];
    const river = riverTiles.map((s, i) => ({
      tile: ids(s)[0],
      tsumogiri: false,
      riichiDeclaration: false,
      calledBy: null,
      turnNumber: i + 1,
    }));
    const seatMelds = seat === 0
      ? (opts.meldsBySeat?.[0] ?? melds)
      : (opts.meldsBySeat?.[seat] ?? []);
    seats[seat] = {
      ...emptySeat(seat, winds[seat] ?? 'east', pts[seat] ?? 25000),
      river,
      riichi: riichi.has(seat),
      riichiTurn: riichi.has(seat) ? riverTiles.length : null,
      melds: seatMelds,
      concealedCount: seat === 0 ? hand.length : 13,
      isClosed: seat === 0 ? (opts.isClosed ?? melds.length === 0) : seatMelds.length === 0,
    };
  }

  const allVisible: TileId[] = [
    ...hand, ...(drawn ? [drawn] : []),
    ...Object.values(opts.meldsBySeat ?? {}).flatMap((ms) => ms.flatMap((m) => m.tiles)),
    ...melds.flatMap((m) => m.tiles),
    ...Object.values(opts.rivers ?? {}).flatMap((r) => r.map((s) => ids(s)[0])),
    ...(opts.dora ?? []).map((s) => ids(s)[0]),
  ];
  const dora = (opts.dora ?? []).map((s) => ids(s)[0]);

  return {
    viewer: 0,
    settings,
    roundWind,
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: 0,
    phase: 'awaitingDiscard',
    hand,
    drawnTile: drawn,
    seats,
    doraIndicators: dora,
    tilesRemaining: opts.tilesRemaining ?? 60,
    lastDiscard: null,
    visibleCounts: countsFromIds(allVisible),
  };
}

/** Tile kind for a short string (for assertions). */
export function kindOfS(s: string): number {
  return kindOf(ids(s)[0]);
}
