/**
 * useYakuAdvisor — runs the yaku advisor off the main thread and hands the
 * panel the freshest answer it has.
 *
 * Behaviour that matters for the feel of the overlay:
 *   - the previous position's answer stays on screen while the next one is
 *     simulating, so the panel never blinks empty between draws;
 *   - full-game mode streams partial results, because a 200-run simulation is
 *     a coffee break and a frozen panel would be unacceptable;
 *   - only the newest request counts — if you discard three times quickly, the
 *     stale replies are dropped;
 *   - every completed run feeds its real cost back into the store, so the time
 *     estimates the settings show are this device's numbers, not a guess;
 *   - where Worker is unavailable (tests, very old browsers) it falls back to
 *     computing synchronously, which is slower but always correct.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicView } from '@engine/types';
import type { AdvisorOutcome } from '@analysis/types';
import { positionSeed } from '@analysis/yakuAdvisor';
import { advise } from '@state/analysisAdapter';
import { useSession } from '@state/session';
import type { YakuRequest, YakuResponse } from '@ui/workers/yakuAdvisor.worker';

export interface AdvisorState {
  outcome: AdvisorOutcome | null;
  /** True while a fresh position is still simulating. */
  pending: boolean;
  /** Runs finished so far in the job that is currently running. */
  progress: number;
  /** Cost of the last completed job, in ms. */
  ms: number;
}

const EMPTY: AdvisorState = { outcome: null, pending: false, progress: 0, ms: 0 };

const canUseWorker = () => typeof Worker !== 'undefined' && typeof URL !== 'undefined';

export function useYakuAdvisor(view: PublicView | null, enabled: boolean): AdvisorState {
  const [state, setState] = useState<AdvisorState>(EMPTY);
  const sim = useSession((s) => s.sim);
  const recordSimCost = useSession((s) => s.recordSimCost);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);
  const busyRef = useRef(false);

  // One position and one setting => one simulation. The seed is the identity.
  const key = useMemo(
    () => (view ? `${positionSeed(view)}:${sim.depth}:${sim.fullGame}` : ''),
    [view, sim.depth, sim.fullGame],
  );
  const mode = sim.fullGame ? 'full' : 'quick';

  useEffect(() => {
    if (!enabled || !view) return undefined;

    if (!canUseWorker()) {
      // Synchronous fallback: correctness over smoothness. Full-game mode would
      // lock the thread for a minute, so it is not offered without a worker.
      const outcome = advise(view, 'quick', sim.depth);
      setState({ outcome, pending: false, progress: outcome.requested, ms: 0 });
      return undefined;
    }

    // A worker cannot be interrupted mid-loop, and a 200-run full-game job can
    // take a minute. If the position moves on while one is running, throw the
    // worker away rather than queueing behind work nobody wants any more.
    if (busyRef.current && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
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
      const msg = e.data;
      if (msg.id !== reqRef.current) return; // a newer position has been asked for
      setState({
        outcome: msg.outcome,
        pending: !msg.done,
        progress: msg.outcome.summary?.runs ?? msg.outcome.requested,
        ms: msg.ms,
      });
      if (msg.done) {
        busyRef.current = false;
        recordSimCost(mode, msg.ms, msg.outcome.requested);
      }
    };
    worker.addEventListener('message', onMessage);
    busyRef.current = true;
    setState((s) => ({ ...s, pending: true, progress: 0 }));
    const req: YakuRequest = { id, view, mode, runs: sim.depth };
    worker.postMessage(req);
    return () => worker.removeEventListener('message', onMessage);
  }, [key, enabled, view, mode, sim.depth, recordSimCost]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return state;
}

/** Estimated wall-clock cost of a simulation, from this device's own history. */
export function estimateMs(costPerRun: number, runs: number): number {
  return Math.round(costPerRun * runs);
}

/** "≈4 s" / "≈450 ms" / "≈1 min 20 s" */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `≈${Math.round(ms / 50) * 50} ms`;
  if (ms < 60000) return `≈${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return sec ? `≈${min} min ${sec} s` : `≈${min} min`;
}
