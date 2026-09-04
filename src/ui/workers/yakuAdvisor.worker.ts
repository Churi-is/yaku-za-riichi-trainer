/**
 * Yaku advisor worker. The advisor costs 100 ms in quick mode and can reach a
 * minute in full-game mode — fine, but not on the thread that is drawing the
 * table. The whole job is posted here, off the render path, and the panel keeps
 * showing the previous answer until this one lands.
 *
 * Full-game runs report progress as they go, so a long simulation is usable
 * while it is still running instead of being a spinner with no end in sight.
 *
 * PublicView is plain data, so it structured-clones without help.
 */
import type { PublicView } from '@engine/types';
import type { AdvisorMode, AdvisorOutcome } from '@analysis/types';
import { advise } from '@state/analysisAdapter';

export interface YakuRequest {
  id: number;
  view: PublicView;
  mode: AdvisorMode;
  runs: number;
}

export interface YakuResponse {
  id: number;
  outcome: AdvisorOutcome;
  /** Wall-clock cost so far, used to calibrate the time estimates shown. */
  ms: number;
  done: boolean;
}

self.onmessage = (e: MessageEvent<YakuRequest>) => {
  const { id, view, mode, runs } = e.data;
  const t0 = Date.now();
  const post = (outcome: AdvisorOutcome, done: boolean) => {
    const msg: YakuResponse = { id, outcome, ms: Date.now() - t0, done };
    (self as unknown as Worker).postMessage(msg);
  };

  try {
    // Progress is throttled: posting 200 times would cost more than it informs.
    let lastPost = 0;
    const outcome = advise(view, mode, runs, (done, total, partial) => {
      const now = Date.now();
      if (done === total || now - lastPost > 400) {
        lastPost = now;
        post(partial, false);
      }
    });
    post(outcome, true);
  } catch {
    post({ mode, requested: runs, suggestions: [] }, true);
  }
};
