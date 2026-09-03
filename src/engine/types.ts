/**
 * SHARED CONTRACT — owned by Worker A (engine).
 * Workers B/C/D import from here. Changes to exported shapes must be announced
 * in docs/CONTRACTS.md and pushed early so other branches can rebase.
 */

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/** Suits. 'z' = honors (1-4 = E/S/W/N winds, 5-7 = White/Green/Red dragons). */
export type Suit = 'm' | 'p' | 's' | 'z';

/**
 * Canonical tile id, 0..135, one per physical tile in the 136-tile set.
 * Ordering convention: id = kind * 4 + copyIndex, kind = 0..33 ordered
 * m1..m9 (0-8), p1..p9 (9-17), s1..s9 (18-26), E,S,W,N (27-30), Haku, Hatsu, Chun (31-33).
 */
export type TileId = number;

/** Tile kind, 0..33 (see TileId ordering). Suit+rank identity, ignores copies. */
export type TileKind = number;

export interface Tile {
  id: TileId;
  kind: TileKind;
  suit: Suit;
  /** 1-9 for suits; 1-7 for honors. */
  rank: number;
  /** True for the red-five copies when aka dora is enabled. */
  red: boolean;
}

// ---------------------------------------------------------------------------
// Seats, winds, rounds
// ---------------------------------------------------------------------------

/** 0 = human player (South-facing bottom seat in UI), 1..3 = AI, clockwise to the right. */
export type SeatIndex = 0 | 1 | 2 | 3;
export type Wind = 'east' | 'south' | 'west' | 'north';

// ---------------------------------------------------------------------------
// Melds
// ---------------------------------------------------------------------------

export type MeldType = 'chi' | 'pon' | 'ankan' | 'minkan' | 'kakan';

export interface Meld {
  type: MeldType;
  /** Tiles composing the meld (3 for chi/pon, 4 for kans), sorted by kind. */
  tiles: TileId[];
  /** Seat the called tile came from; null for ankan. */
  calledFrom: SeatIndex | null;
  /** The specific tile that was called; null for ankan. */
  calledTile: TileId | null;
  /** True for ankan only. Kakan (added kan) is open — it began as a pon. */
  concealed: boolean;
}

// ---------------------------------------------------------------------------
// Rules / table settings
// ---------------------------------------------------------------------------

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameLength = 'east' | 'hanchan';

export interface TableSettings {
  /** Red fives: one per suit (3 total) when true. */
  redDora: boolean;
  /** Open tanyao allowed. */
  kuitan: boolean;
  /** Two-han minimum to win. */
  twoHanMinimum: boolean;
  gameLength: GameLength;
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: TableSettings = {
  redDora: true,
  kuitan: true,
  twoHanMinimum: false,
  gameLength: 'hanchan',
  difficulty: 'normal',
};

// ---------------------------------------------------------------------------
// Discard river
// ---------------------------------------------------------------------------

export interface DiscardEntry {
  tile: TileId;
  /** Discard was the tile just drawn (tsumogiri). */
  tsumogiri: boolean;
  /** This discard was the riichi declaration tile (rotated sideways). */
  riichiDeclaration: boolean;
  /** Set when another player called this tile (it left the river). */
  calledBy: SeatIndex | null;
  /** Global turn counter at time of discard, for river-reading. */
  turnNumber: number;
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------

export interface PlayerState {
  seat: SeatIndex;
  seatWind: Wind;
  /** Concealed tiles, sorted; excludes the just-drawn tile if `drawnTile` set. */
  hand: TileId[];
  /** Freshly drawn tile awaiting discard, else null. */
  drawnTile: TileId | null;
  melds: Meld[];
  river: DiscardEntry[];
  points: number;
  riichi: boolean;
  doubleRiichi: boolean;
  /** Turn index at which riichi was declared, else null. */
  riichiTurn: number | null;
  ippatsu: boolean;
  /** Permanent furiten (own discard matches a wait). */
  furiten: boolean;
  /** Temporary furiten (passed on a ron chance this go-around). */
  temporaryFuriten: boolean;
  /** Riichi furiten — locked for the rest of the hand. */
  riichiFuriten: boolean;
  /** No calls made yet this hand (menzen). */
  isClosed: boolean;
  /**
   * Kinds this seat may not discard right now (kuikae). Set by a call and
   * cleared by the seat's next discard.
   */
  forbiddenDiscards: TileKind[];
  /** AI seats only: assigned personality id (see @ai/types). */
  aiPersonalityId: string | null;
}

// ---------------------------------------------------------------------------
// Game / hand state
// ---------------------------------------------------------------------------

export type HandPhase =
  | 'dealing'
  | 'awaitingDraw'
  | 'awaitingDiscard'
  | 'awaitingCalls'
  | 'handOver'
  | 'matchOver';

/**
 * An open call window on a discard. The engine creates this the moment a tile
 * hits the river and at least one seat could call it; it is cleared once every
 * candidate has acted.
 */
export interface CallWindow {
  /** The tile sitting in the river that may be called. */
  tile: TileId;
  /** Who discarded it. */
  from: SeatIndex;
  /** Candidates that have already passed. Pending = candidates minus these. */
  passed: SeatIndex[];
  /** Seats that could ron this tile (before furiten / head-bump gating). */
  ronSeats: SeatIndex[];
  /** True when the tile is an added kan being called for chankan. */
  chankan: boolean;
}

export interface GameState {
  settings: TableSettings;
  /** Root seed; every hand's shuffle derives from `seed` + `handNumber`. */
  seed: number;
  /** 1-based index of the current hand within the match. */
  handNumber: number;
  roundWind: Wind;
  /** 1-4 within the round wind. */
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  dealer: SeatIndex;
  turn: SeatIndex;
  phase: HandPhase;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  /** Live wall tiles remaining to draw (excludes dead wall). */
  wall: TileId[];
  /**
   * Dead wall. Fixed layout for the first 14 entries:
   * `[0..4]` dora indicator slots, `[5..9]` ura indicator slots,
   * `[10..13]` kan replacement tiles (drawn in index order).
   * One extra entry is appended per kan: the live-wall tile moved in to keep
   * the dead wall whole, which is what shrinks `wall` by one per kan.
   */
  deadWall: TileId[];
  /** Face-up dora indicators (grows with kan). */
  doraIndicators: TileId[];
  /** Ura indicators, revealed only to riichi winners at scoring time. */
  uraIndicators: TileId[];
  /** Kans declared this hand, total across all players. */
  kanCount: number;
  /** Global turn counter, increments on each discard. */
  turnNumber: number;
  /** The tile most recently discarded, pending call resolution. */
  lastDiscard: { tile: TileId; from: SeatIndex } | null;
  /** Open call window, when a discard is awaiting call decisions. */
  callWindow: CallWindow | null;
  /** True while the current draw came from the dead wall (rinshan). */
  rinshanPending: boolean;
  /** Set during a kakan tile's call window, for chankan. */
  chankanTile: TileId | null;
  /**
   * Pao (liability) seat: whoever fed the third dragon or fourth wind meld.
   * Settled at scoring time for daisangen / daisuushii.
   */
  paoSeat: SeatIndex | null;
  handOver: HandResult | null;
  matchOver: MatchResult | null;
}

// ---------------------------------------------------------------------------
// Actions (the single input channel to the engine)
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'draw'; seat: SeatIndex }
  | { type: 'discard'; seat: SeatIndex; tile: TileId; riichi?: boolean }
  | { type: 'chi'; seat: SeatIndex; tiles: [TileId, TileId] }
  | { type: 'pon'; seat: SeatIndex; tiles: [TileId, TileId] }
  | { type: 'minkan'; seat: SeatIndex; tiles: [TileId, TileId, TileId] }
  | { type: 'ankan'; seat: SeatIndex; kind: TileKind }
  | { type: 'kakan'; seat: SeatIndex; tile: TileId }
  | { type: 'ron'; seat: SeatIndex }
  | { type: 'tsumo'; seat: SeatIndex }
  | { type: 'pass'; seat: SeatIndex };

/** A legal action offered to a seat, with the UI-facing metadata it needs. */
export interface LegalAction {
  action: Action;
  /** Human label, e.g. "Chi 3-4m". */
  label: string;
  /** Tiles that would be forbidden as the follow-up discard (kuikae). */
  forbiddenDiscards?: TileKind[];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type YakuId =
  | 'menzenTsumo' | 'riichi' | 'ippatsu' | 'pinfu' | 'tanyao'
  | 'yakuhaiHaku' | 'yakuhaiHatsu' | 'yakuhaiChun'
  | 'yakuhaiRoundWind' | 'yakuhaiSeatWind'
  | 'doubleRiichi' | 'chankan' | 'haitei' | 'houtei' | 'rinshan'
  | 'chiitoitsu' | 'toitoi' | 'sanshokuDoujun' | 'ittsu' | 'chanta'
  | 'honroutou' | 'shousangen' | 'sanankou' | 'sankantsu'
  | 'sanshokuDoukou'
  | 'honitsu' | 'junchan' | 'ryanpeikou'
  | 'chinitsu'
  | 'renhou'
  | 'kokushi' | 'suuankou' | 'daisangen' | 'shousuushi' | 'daisuushii'
  | 'tsuuiisou' | 'chinroutou' | 'ryuuiisou' | 'chuurenPoutou' | 'suukantsu'
  | 'tenhou' | 'chiihou';

export interface YakuHit {
  id: YakuId;
  name: string;
  han: number;
  yakuman: boolean;
}

export interface ScoreResult {
  yaku: YakuHit[];
  han: number;
  fu: number;
  /** Dora/aka/ura counts, already folded into `han`. */
  dora: number;
  akaDora: number;
  uraDora: number;
  /** Total points moving to the winner (excludes sticks/honba). */
  points: number;
  /** Per-seat point deltas, applied by the engine. */
  payments: Record<SeatIndex, number>;
  limitName: '' | 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'yakuman';
}

export type HandEndReason = 'ron' | 'tsumo' | 'exhaustiveDraw';

export interface HandResult {
  reason: HandEndReason;
  winner: SeatIndex | null;
  loser: SeatIndex | null;
  score: ScoreResult | null;
  /** Winning tile for ron/tsumo. */
  winningTile: TileId | null;
  /** Exhaustive draw: which seats were tenpai. */
  tenpaiSeats: SeatIndex[];
  /** Point deltas actually applied, including sticks and honba. */
  deltas: Record<SeatIndex, number>;
  /** Dealer keeps dealership. */
  renchan: boolean;
  /** Final concealed hands of every seat, for the replay reveal. */
  revealedHands: Record<SeatIndex, TileId[]>;
  /** Pao (liability) seat, if any. */
  paoSeat: SeatIndex | null;
  /** Dora indicators in play at hand end. */
  doraIndicators?: TileId[];
  /** Ura indicators, populated only when a riichi winner exists. */
  uraIndicators?: TileId[];
}

export interface MatchResult {
  /** Seats ordered best to worst by final points (plain ranking, no uma/oka). */
  ranking: SeatIndex[];
  finalPoints: Record<SeatIndex, number>;
  handsPlayed: number;
}

// ---------------------------------------------------------------------------
// Public view (the ONLY thing AI + overlays may read)
// ---------------------------------------------------------------------------

/**
 * Everything visible at the table from one seat's perspective.
 * The engine derives this; the AI and all analysis MUST consume only this.
 */
export interface PublicView {
  viewer: SeatIndex;
  settings: TableSettings;
  roundWind: Wind;
  roundNumber: number;
  honba: number;
  riichiSticks: number;
  dealer: SeatIndex;
  turn: SeatIndex;
  phase: HandPhase;
  /** Viewer's own concealed hand + drawn tile. */
  hand: TileId[];
  drawnTile: TileId | null;
  /** Per-seat public info. */
  seats: Record<SeatIndex, PublicSeatView>;
  doraIndicators: TileId[];
  /** Live wall tiles remaining. */
  tilesRemaining: number;
  lastDiscard: { tile: TileId; from: SeatIndex } | null;
  /** Count of each tile kind visible to the viewer (own hand, rivers, melds, dora indicators). */
  visibleCounts: number[];
}

export interface PublicSeatView {
  seat: SeatIndex;
  seatWind: Wind;
  melds: Meld[];
  river: DiscardEntry[];
  points: number;
  riichi: boolean;
  riichiTurn: number | null;
  ippatsu: boolean;
  /** Concealed tile count only — never the tiles themselves. */
  concealedCount: number;
  isClosed: boolean;
  aiPersonalityId: string | null;
}
