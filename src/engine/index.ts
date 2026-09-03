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
  ScoreResult, TileId, Meld, Wind,
} from './types';

export * from './types';

const TODO = (fn: string): never => {
  throw new Error(`engine.${fn} not implemented yet (Worker A)`);
};

export interface ScoreInput {
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

/** Shanten number. 0 = tenpai, -1 = complete. */
export function shanten(hand: TileId[], melds: Meld[]): number {
  return TODO('shanten');
}

/** Tiles that improve shanten (ukeire), with remaining-count weights. */
export function ukeire(
  hand: TileId[], melds: Meld[], visibleCounts: number[],
): { kind: number; count: number }[] {
  return TODO('ukeire');
}

/** Winning tile kinds for a tenpai hand (empty if not tenpai). */
export function waits(hand: TileId[], melds: Meld[]): number[] {
  return TODO('waits');
}

/** Score a complete hand. Used by the engine and by replay grading. */
export function scoreHand(input: ScoreInput): ScoreResult {
  return TODO('scoreHand');
}
