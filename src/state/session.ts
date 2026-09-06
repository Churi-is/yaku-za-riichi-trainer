/**
 * SHARED CONTRACT (light) — screen routing + session-scoped state.
 * Nothing persists between sessions.
 */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type TableSettings } from '@engine/types';
import { DEFAULT_OPPONENTS } from '@ai/personalities';
import { assignOpponent, normalizeOpponents, type OpponentSeat, type OpponentSeats } from './opponents';

type Screen =
  | 'menu'
  | 'opponents'
  | 'settings'
  | 'match'
  | 'dojo'
  | 'lesson';

interface SessionStore {
  screen: Screen;
  settings: TableSettings;
  /** Right, across, left. Empty seats stay in place until explicitly filled. */
  opponents: OpponentSeats;
  /** Lesson currently open in the dojo. */
  lessonId: string | null;
  /** Lessons finished this session. Nothing persists between sessions. */
  completed: string[];
  go: (screen: Screen) => void;
  setSettings: (s: Partial<TableSettings>) => void;
  setOpponents: (ids: readonly (string | null)[]) => void;
  seatOpponent: (seat: OpponentSeat, id: string) => void;
  clearOpponent: (seat: OpponentSeat) => void;
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
  setOpponents: (ids) => set({ opponents: normalizeOpponents(ids) }),
  seatOpponent: (seat, id) => set((st) => ({ opponents: assignOpponent(st.opponents, seat, id) })),
  clearOpponent: (seat) => set((st) => {
    const opponents: OpponentSeats = [...st.opponents];
    opponents[seat - 1] = null;
    return { opponents };
  }),
  openLesson: (lessonId) => set({ lessonId, screen: 'lesson' }),
  completeLesson: (id) => set((st) => (
    st.completed.includes(id) ? {} : { completed: [...st.completed, id] }
  )),
}));
