/**
 * Yaku advisor worker. The Monte-Carlo advisor costs 100-350 ms per position —
 * fine, but not on the thread that is drawing the table. The whole job is
 * posted here, off the render path, and the panel keeps showing the previous
 * answer until this one lands.
 *
 * PublicView is plain data, so it structured-clones without help.
 */
import type { PublicView } from '@engine/types';
import type { YakuSuggestion } from '@analysis/types';
import { suggestYaku } from '@state/analysisAdapter';

export interface YakuRequest { id: number; view: PublicView }
export interface YakuResponse { id: number; suggestions: YakuSuggestion[]; ms: number }

self.onmessage = (e: MessageEvent<YakuRequest>) => {
  const { id, view } = e.data;
  const t0 = Date.now();
  let suggestions: YakuSuggestion[] = [];
  try {
    suggestions = suggestYaku(view);
  } catch {
    suggestions = [];
  }
  const msg: YakuResponse = { id, suggestions, ms: Date.now() - t0 };
  (self as unknown as Worker).postMessage(msg);
};
