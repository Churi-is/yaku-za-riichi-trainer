/**
 * SHARED CONTRACT — public-information analysis. Owned by Worker C.
 * Consumed by the overlays (Worker D) and replay grading (Worker C).
 * EVERY function here must take a PublicView and nothing else.
 */
import type { SeatIndex, TileKind, YakuId } from '@engine/types';

export type ProbabilityBand = 'Very low' | 'Low' | 'Medium' | 'High' | 'Very high';
export type RiskLevel = 'Low' | 'Medium' | 'High';

// --- Overlay A: yaku advisor ----------------------------------------------

export interface YakuSuggestion {
  id: YakuId;
  name: string;
  /** Han shown as closed/open, e.g. "2 / 1" or "Yakuman". */
  hanLabel: string;
  /** The yaku's standard DEFINITION ONLY. Never advice, never tile references. */
  description: string;
  band: ProbabilityBand;
  /** Measured reachability as a percentage, 0-100. */
  approxPercent?: number;
  /** Raw sample behind `approxPercent`, so the UI can show its own error bars. */
  hits?: number;
  runs?: number;
  /** Tooltip explaining how the estimate was produced (method, not hand contents). */
  methodNote: string;
}

// --- Overlay B: opponent reading ------------------------------------------

export interface ReadSignal {
  /** Short probabilistic phrasing, e.g. "Likely honitsu in bamboo". */
  text: string;
  /** Tooltip explaining WHY (the method behind the signal). */
  why: string;
}

export interface OpponentRead {
  seat: SeatIndex;
  /** Named yaku directions suggested by melds/river. */
  handDirection: ReadSignal[];
  riverCues: ReadSignal[];
  threat: { riichi: boolean; likelyTenpai: boolean; note: string };
  dealInRisk: RiskLevel;
  dealInRiskWhy: string;
  /** Tile classes currently safe against this seat (genbutsu + suji). */
  safeTiles: TileKind[];
  dangerTiles: TileKind[];
}

// --- Overlay C: wait guessing ---------------------------------------------

export interface WaitGuess {
  /** Tile kinds the opponent may be waiting on. */
  kinds: TileKind[];
  label: string;
  confidence: ProbabilityBand;
  reasoning: string;
}

export interface OpponentWaitRead {
  seat: SeatIndex;
  tenpaiLikely: boolean;
  guesses: WaitGuess[];
}

/** Practice-mode record: the player's submitted guess vs. reality. */
export interface WaitGuessRecord {
  handId: number;
  seat: SeatIndex;
  submittedKinds: TileKind[];
  /** Filled in at round end from the revealed hand. */
  actualWaits: TileKind[] | null;
  correct: boolean | null;
}

// --- Replay grading --------------------------------------------------------

export type Grade = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Blunder';

export type MistakeCategory =
  | 'efficiency' | 'valueVsSpeed' | 'callJudgment' | 'riichiTiming'
  | 'pushFold' | 'missedOpportunity' | 'none';

export interface AlternativeAction {
  label: string;
  reasoning: string;
  /** Relative merit score used to rank alternatives. */
  score: number;
}

export interface GradedTurn {
  handId: number;
  turnNumber: number;
  /** Plain description of what the player did. */
  actionLabel: string;
  grade: Grade;
  category: MistakeCategory;
  explanation: string;
  /** Revealed only in replay, never live. */
  alternatives: AlternativeAction[];
  shantenBefore: number;
  shantenAfter: number;
  ukeireBefore: number;
  ukeireAfter: number;
}
