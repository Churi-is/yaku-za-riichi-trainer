/**
 * SHARED CONTRACT — the compact action log that drives replay + grading.
 * Schema owned by Worker C; written by the game loop (Worker D); read by
 * grading (C) and the replay UI (D).
 */
import type {
  Action, HandResult, SeatIndex, TableSettings, TileId, PublicView, Wind,
} from '@engine/types';
import type { WaitGuessRecord, GradedTurn } from '@analysis/types';

export interface ActionLogEntry {
  handId: number;
  /** Monotonic index within the hand. */
  seq: number;
  seat: SeatIndex;
  action: Action;
  /** Public view from the HUMAN seat immediately before this action.
   *  Lets grading rerun the same analysis the overlays would have shown. */
  viewBefore: PublicView | null;
  /**
   * Optional, written on the FINAL entry of a hand by the game loop.
   * Lets `resolveWaitGuesses` score practice guesses against the revealed
   * hands (Worker C schema). Absent for hands without a recorded reveal.
   */
  handReveal?: {
    revealedHands: Record<SeatIndex, TileId[]>;
    winningTile: TileId | null;
  };
}

export interface HandLog {
  handId: number;
  roundWind: Wind;
  roundNumber: number;
  honba: number;
  dealer: SeatIndex;
  entries: ActionLogEntry[];
  result: HandResult;
  /** Full hands of every seat at hand end, for the replay reveal. */
  revealedHands: Record<SeatIndex, TileId[]>;
}

export interface MatchLog {
  settings: TableSettings;
  hands: HandLog[];
  waitGuesses: WaitGuessRecord[];
}

export interface SessionSummary {
  handsPlayed: number;
  wins: number;
  placement: number;
  finalPoints: number;
  /** Yaku names the player won with, with counts. */
  yakuWon: { name: string; count: number }[];
  gradeDistribution: Record<GradedTurn['grade'], number>;
  waitGuessAccuracy: { attempted: number; correct: number };
  topMistakes: { category: string; count: number }[];
}
