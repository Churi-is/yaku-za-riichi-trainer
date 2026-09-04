/**
 * SHARED CONTRACT (light) — screen routing + session-scoped state.
 * Owned by Worker D. Nothing persists between sessions.
 */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type TableSettings } from '@engine/types';

export type Screen = 'menu' | 'settings' | 'match';

interface SessionStore {
  screen: Screen;
  settings: TableSettings;
  go: (screen: Screen) => void;
  setSettings: (s: Partial<TableSettings>) => void;
}

export const useSession = create<SessionStore>((set) => ({
  screen: 'menu',
  settings: { ...DEFAULT_SETTINGS },
  go: (screen) => set({ screen }),
  setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
}));
