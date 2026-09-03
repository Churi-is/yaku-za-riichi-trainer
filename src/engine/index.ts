/**
 * SHARED CONTRACT — public surface of the rules engine. Owned by Worker A.
 * The UI (Worker D) and AI (Worker B) drive the game exclusively through this.
 *
 * These are STUBS so every branch compiles and runs from day one.
 * Worker A replaces the bodies; the SIGNATURES are the contract and must not
 * change without a note in docs/CONTRACTS.md.
 */
import type {
  Action, GameState, LegalAction, PublicView, SeatIndex, TableSettings,
  ScoreResult, TileId, TileKind, Meld, Wind,
} from './types';
import { shanten as shantenImpl, waits as waitsImpl, ukeire as ukeireImpl } from './shanten';
import { scoreHand as scoreHandImpl, isLegalWin, basePoints, computePayments } from './scoring';

export * from './types';
export {
  kindOf, suitOf, rankOf, isRed, isHonor, isTerminal, isSimple, isTerminalOrHonor,
  isDragon, isWind, isGreen, countsFromIds, idsFromCounts, tileName, tileNameOfId,
  tileLabel, kindsLabel, doraKindForIndicator, kindOfWind, windOfKind, yakuhaiKinds,
  sortIds, makeTile, allTileIds, RED_FIVE_IDS, KIND_COUNT, TILE_COUNT,
} from './tiles';
export {
  shantenFromCounts, isTenpai, isAgari, ukeireTotal, improvingKinds,
  waitingHandSize, clearShantenCache,
} from './shanten';

const TODO = (fn: string): never => {
  throw new Error(`engine.${fn} not implemented yet (Worker A)`);
};

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

/** Create a fresh match (deals the first hand). `seed` makes runs reproducible. */
export function createMatch(settings: TableSettings, seed?: number): GameState {
  return TODO('createMatch');
}

/** Apply an action. Returns a NEW state (pure; never mutates the input). */
export function applyAction(state: GameState, action: Action): GameState {
  return TODO('applyAction');
}

/** All legal actions for a seat right now (empty if it is not their decision). */
export function getLegalActions(state: GameState, seat: SeatIndex): LegalAction[] {
  return TODO('getLegalActions');
}

/** Seats that currently owe a decision (a call window may involve several). */
export function pendingSeats(state: GameState): SeatIndex[] {
  return TODO('pendingSeats');
}

/** Project the full state down to what `seat` may legally know. */
export function toPublicView(state: GameState, seat: SeatIndex): PublicView {
  return TODO('toPublicView');
}

/** Advance to the next hand; sets `matchOver` when the match ends. */
export function nextHand(state: GameState): GameState {
  return TODO('nextHand');
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
