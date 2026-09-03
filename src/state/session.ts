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

interface SessionStore {
  screen: Screen;
  settings: TableSettings;
  overlays: OverlayToggles;
  matchLog: MatchLog | null;
  go: (screen: Screen) => void;
  setSettings: (s: Partial<TableSettings>) => void;
  toggleOverlay: (k: keyof OverlayToggles) => void;
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
  matchLog: null,
  go: (screen) => set({ screen }),
  setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
  toggleOverlay: (k) => set((st) => ({ overlays: { ...st.overlays, [k]: !st.overlays[k] } })),
  setMatchLog: (matchLog) => set({ matchLog }),
}));
