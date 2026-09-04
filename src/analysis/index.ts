/**
 * SHARED CONTRACT — the single public-information analysis module.
 * Owned by Worker C. Overlays (D) and replay grading both call these, so
 * live hints and post-game grades always agree.
 *
 * Every function here takes a PublicView (or the recorded log of public
 * views) and never touches hidden tiles. Live overlays consume only the
 * `suggestYaku` / `readOpponents` / `guessWaits` results — replay-only
 * detail (alternatives, best discards) lives in grading.ts and must never be
 * surfaced during live play.
 */
import type { PublicView } from '@engine/types';
import type {
  YakuSuggestion, OpponentRead, OpponentWaitRead, GradedTurn, WaitGuessRecord,
} from './types';
import type { ActionLogEntry } from '@replay/types';
import { yakuAdvisor } from './yakuAdvisor';
import { readOpponents as readOpponentsImpl } from './opponentRead';
import { guessWaits as guessWaitsImpl, resolveWaitGuesses as resolveGuesses } from './waitGuess';
import { gradeMatch as grade } from './grading';

export * from './types';

/** Overlay A. Top 5 reachable yaku, definitions only, no advice. */
export function suggestYaku(view: PublicView): YakuSuggestion[] {
  return yakuAdvisor(view);
}

/** Overlay B. One read per opponent seat. */
export function readOpponents(view: PublicView): OpponentRead[] {
  return readOpponentsImpl(view);
}

/** Overlay C. Wait guesses for seats judged tenpai. */
export function guessWaits(view: PublicView): OpponentWaitRead[] {
  return guessWaitsImpl(view);
}

/** Replay. Grades every human turn from the recorded log. */
export function gradeMatch(log: ActionLogEntry[]): GradedTurn[] {
  return grade(log);
}

/** Resolve practice-mode wait guesses against revealed hands at round end. */
export function resolveWaitGuesses(
  records: WaitGuessRecord[], log: ActionLogEntry[],
): WaitGuessRecord[] {
  return resolveGuesses(records, log);
}
