/**
 * SHARED CONTRACT — the single public-information analysis module.
 * Owned by Worker C. Overlays (D) and replay grading both call these, so
 * live hints and post-game grades always agree.
 *
 * STUBS return empty results so the UI can render before C lands.
 * Implementations MUST NOT read hidden state — PublicView is the only input.
 */
import type { PublicView } from '@engine/types';
import type {
  YakuSuggestion, OpponentRead, OpponentWaitRead, GradedTurn, WaitGuessRecord,
} from './types';
import type { ActionLogEntry } from '@replay/types';

export * from './types';

/** Overlay A. Top 5 realistically feasible yaku, definitions only, no advice. */
export function suggestYaku(view: PublicView): YakuSuggestion[] {
  return [];
}

/** Overlay B. One read per opponent seat. */
export function readOpponents(view: PublicView): OpponentRead[] {
  return [];
}

/** Overlay C. Wait guesses for seats judged tenpai. */
export function guessWaits(view: PublicView): OpponentWaitRead[] {
  return [];
}

/** Replay. Grades every human turn from the recorded log. */
export function gradeMatch(log: ActionLogEntry[]): GradedTurn[] {
  return [];
}

/** Resolve practice-mode wait guesses against revealed hands at round end. */
export function resolveWaitGuesses(
  records: WaitGuessRecord[], log: ActionLogEntry[],
): WaitGuessRecord[] {
  return records;
}
