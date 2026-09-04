/**
 * useYakuAdvisor — runs the Monte-Carlo yaku advisor off the main thread and
 * hands the panel the freshest answer it has.
 *
 * Behaviour that matters for the feel of the overlay:
 *   - the previous position's answer stays on screen while the next one is
 *     simulating, so the panel never blinks empty between draws;
 *   - only the newest request counts — if you discard three times quickly, the
 *     two stale replies are dropped;
 *   - where Worker is unavailable (tests, very old browsers) it falls back to
 *     computing synchronously, which is slower but always correct.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicView } from '@engine/types';
import type { YakuSuggestion } from '@analysis/types';
import { positionSeed } from '@analysis/yakuAdvisor';
import { suggestYaku } from '@state/analysisAdapter';
import type { YakuRequest, YakuResponse } from '@ui/workers/yakuAdvisor.worker';

export interface AdvisorState {
  suggestions: YakuSuggestion[];
  /** True while a fresh position is still simulating. */
  pending: boolean;
  /** Wall-clock cost of the last completed run, for the dev overlay. */
  ms: number;
}

const canUseWorker = () => typeof Worker !== 'undefined' && typeof URL !== 'undefined';

export function useYakuAdvisor(view: PublicView | null, enabled: boolean): AdvisorState {
  const [state, setState] = useState<AdvisorState>({ suggestions: [], pending: false, ms: 0 });
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  // One position => one simulation. The seed is the position's identity.
  const key = useMemo(() => (view ? positionSeed(view) : 0), [view]);

  useEffect(() => {
    if (!enabled || !view) return undefined;

    if (!canUseWorker()) {
      // Synchronous fallback: correctness over smoothness.
      setState({ suggestions: suggestYaku(view), pending: false, ms: 0 });
      return undefined;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/yakuAdvisor.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }
    const worker = workerRef.current;
    const id = ++reqRef.current;
    const onMessage = (e: MessageEvent<YakuResponse>) => {
      if (e.data.id !== reqRef.current) return; // a newer position has been asked for
      setState({ suggestions: e.data.suggestions, pending: false, ms: e.data.ms });
    };
    worker.addEventListener('message', onMessage);
    setState((s) => ({ ...s, pending: true }));
    const req: YakuRequest = { id, view };
    worker.postMessage(req);
    return () => worker.removeEventListener('message', onMessage);
  }, [key, enabled, view]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return state;
}
