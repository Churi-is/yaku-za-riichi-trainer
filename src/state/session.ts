/**
 * SHARED CONTRACT (light) — screen routing + session-scoped state.
 * Owned by Worker D. Nothing persists between sessions.
 */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type TableSettings } from '@engine/types';
import type { MatchLog } from '@replay/types';

export type Screen = 'menu' | 'settings' | 'match' | 'replay' | 'summary';

export interface OverlayToggles {
  yakuAdvisor: boolean;
  opponentReading: boolean;
  waitGuessing: boolean;
  /** Sub-toggle of wait guessing. */
  waitPracticeMode: boolean;
}

/** Runs per yaku the advisor simulates. More runs, tighter numbers, longer wait. */
export const SIM_DEPTHS = [60, 120, 200] as const;
export type SimDepth = typeof SIM_DEPTHS[number];

export interface SimSettings {
  depth: SimDepth;
  /**
   * Deep mode: play whole hands out against simulated opponents instead of
   * asking whether a yaku is reachable. Costs about fifty times as much.
   */
  fullGame: boolean;
}

/**
 * Measured cost of one simulation run, in milliseconds, as an exponential
 * moving average of what this device has actually managed. Seeded with the
 * numbers from the development machine so the first estimate shown is not a
 * fabrication, then corrected by reality within a run or two.
 */
export interface SimCost {
  quick: number;
  full: number;
}

// Measured on the development machine: ~5 ms per quick rollout, and a complete
// hand played out by four AIs somewhere between 70 ms (desktop Chromium) and
// 230 ms (Node). Start pessimistic — an estimate that shrinks is kinder than
// one that grows — and let the first real run correct it.
export const SIM_COST_PRIOR: SimCost = { quick: 5, full: 150 };

interface SessionStore {
  screen: Screen;
  settings: TableSettings;
  overlays: OverlayToggles;
  sim: SimSettings;
  simCost: SimCost;
  matchLog: MatchLog | null;
  go: (screen: Screen) => void;
  setSettings: (s: Partial<TableSettings>) => void;
  toggleOverlay: (k: keyof OverlayToggles) => void;
  setSim: (s: Partial<SimSettings>) => void;
  /** Fold a completed run's real cost into the estimate for its mode. */
  recordSimCost: (mode: keyof SimCost, ms: number, runs: number) => void;
  setMatchLog: (log: MatchLog | null) => void;
}

export const useSession = create<SessionStore>((set) => ({
  screen: 'menu',
  settings: { ...DEFAULT_SETTINGS },
  overlays: {
    yakuAdvisor: false,
    opponentReading: false,
    waitGuessing: false,
    waitPracticeMode: false,
  },
  sim: { depth: 60, fullGame: false },
  simCost: { ...SIM_COST_PRIOR },
  matchLog: null,
  go: (screen) => set({ screen }),
  setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
  toggleOverlay: (k) => set((st) => ({ overlays: { ...st.overlays, [k]: !st.overlays[k] } })),
  setSim: (s) => set((st) => ({ sim: { ...st.sim, ...s } })),
  recordSimCost: (mode, ms, runs) => set((st) => {
    if (runs <= 0 || ms <= 0) return {};
    const observed = ms / runs;
    // 60/40 towards history: fast enough to track a device, slow enough not to
    // jump on one unlucky run competing with an AI turn for the thread.
    const blended = st.simCost[mode] * 0.6 + observed * 0.4;
    return { simCost: { ...st.simCost, [mode]: blended } };
  }),
  setMatchLog: (matchLog) => set({ matchLog }),
}));
