/**
 * Analysis adapter (Worker D). Overlays AND replay grading both call THIS, so
 * live hints and post-game grades are computed by the same code path — the
 * "one analysis module, two disclosure policies" invariant holds by
 * construction. The only difference between live and replay is what the UI
 * chooses to render (live never shows tile advice).
 *
 * Routing: prefer Worker C's real @analysis module. Worker C's stubs return
 * empty results (not errors), so we detect "not landed yet" by emptiness on a
 * probe and use Worker D's fallback analysis until C's branch merges. Once C
 * lands with real content, the adapter yields to it automatically.
 *
 * FIREWALL: every function here takes only PublicView (+ the log, whose
 * viewBefore snapshots are PublicViews). Nothing reads hidden state.
 */
import * as analysis from '@analysis/index';
import type { PublicView } from '@engine/types';
import type {
  GradedTurn, OpponentRead, OpponentWaitRead, WaitGuessRecord, YakuSuggestion,
} from '@analysis/types';
import type { ActionLogEntry } from '@replay/types';
import * as fb from './fallbackAnalysis';

// Whether the real analysis module appears to have real behaviour yet.
// We probe once with a representative call; if it returns nothing, C's stubs
// are still in place and we use the fallback.
let realProbed = false;
let realHasContent = false;

function probeReal(view: PublicView): boolean {
  if (realProbed) return realHasContent;
  realProbed = true;
  try {
    const y = analysis.suggestYaku(view);
    const o = analysis.readOpponents(view);
    realHasContent = (y && y.length > 0) || (o && o.length > 0);
  } catch {
    realHasContent = false;
  }
  return realHasContent;
}

/**
 * Overlay A. No fallback: the yaku advisor is a simulation with exactly one
 * implementation. An empty list is a real answer ("nothing is reachable"), not
 * a signal that the module is missing.
 */
export function suggestYaku(view: PublicView): YakuSuggestion[] {
  return analysis.suggestYaku(view);
}

export function readOpponents(view: PublicView): OpponentRead[] {
  if (probeReal(view)) {
    const r = analysis.readOpponents(view);
    if (r.length) return r;
  }
  return fb.readOpponents(view);
}

export function guessWaits(view: PublicView): OpponentWaitRead[] {
  if (probeReal(view)) {
    const r = analysis.guessWaits(view);
    if (r.length) return r;
  }
  return fb.guessWaits(view);
}

export function gradeMatch(log: ActionLogEntry[]): GradedTurn[] {
  // Prefer real grading; fall back if it yields nothing but we have human turns.
  try {
    const r = analysis.gradeMatch(log);
    if (r.length) return r;
  } catch {
    /* fall through */
  }
  return fb.gradeMatch(log);
}

export function resolveWaitGuesses(records: WaitGuessRecord[], log: ActionLogEntry[]): WaitGuessRecord[] {
  try {
    const r = analysis.resolveWaitGuesses(records, log);
    // real module returns the same records if unimplemented; either way it's safe
    return r;
  } catch {
    return fb.resolveWaitGuesses(records, log);
  }
}
