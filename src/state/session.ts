/**
 * SHARED CONTRACT (light) — screen routing + session-scoped state.
 * Owned by Worker D. Nothing persists between sessions.
 */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type TableSettings } from '@engine/types';
import { DEFAULT_OPPONENTS } from '@ai/personalities';

export type Screen =
  | 'menu'
  | 'opponents'
  | 'settings'
  | 'match'
  | 'dojo'
  | 'lesson';

interface SessionStore {
  screen: Screen;
  settings: TableSettings;
  /** Personality ids seated at 1, 2 and 3. Always exactly three. */
  opponents: string[];
  /** Lesson currently open in the dojo. */
  lessonId: string | null;
  /** Lessons finished this session. Nothing persists between sessions. */
  completed: string[];
  go: (screen: Screen) => void;
  setSettings: (s: Partial<TableSettings>) => void;
  setOpponents: (ids: string[]) => void;
  openLesson: (id: string) => void;
  completeLesson: (id: string) => void;
}

export const useSession = create<SessionStore>((set) => ({
  screen: 'menu',
  settings: { ...DEFAULT_SETTINGS },
  opponents: [...DEFAULT_OPPONENTS],
  lessonId: null,
  completed: [],
  go: (screen) => set({ screen }),
  setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
  setOpponents: (ids) => set({ opponents: ids.slice(0, 3) }),
  openLesson: (lessonId) => set({ lessonId, screen: 'lesson' }),
  completeLesson: (id) => set((st) => (
    st.completed.includes(id) ? {} : { completed: [...st.completed, id] }
  )),
}));
