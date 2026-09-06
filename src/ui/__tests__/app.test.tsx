import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import { DEFAULT_OPPONENTS } from '@ai/index';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useMatch.getState().reset();
  useSession.setState({
    screen: 'menu', opponents: [...DEFAULT_OPPONENTS], lessonId: null, completed: [],
  });
});

describe('App shell + screen wiring', () => {
  it('renders the main menu', () => {
    render(<App />);
    expect(screen.getByText(/Mahjong Trainer/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Play a Match/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /The Dojo/i })).toBeTruthy();
  });

  it('navigates menu → opponents → settings and shows the rules summary card', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    expect(screen.getByText(/Table Settings/i)).toBeTruthy();
    expect(screen.getByText(/Current rules/i)).toBeTruthy();
    // toggles present
    expect(screen.getByLabelText(/Red fives/i)).toBeTruthy();
  });

  it('starts a match, deals a hand, and renders the table without crashing', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Start Match/i }));
    });
    // let the async pump run a few AI steps
    act(() => { vi.advanceTimersByTime(3000); });
    // the personalities intro or the table should be visible
    const state = useMatch.getState();
    expect(state.state).not.toBeNull();
    expect(state.view).not.toBeNull();
    // human hand has 13 or 14 tiles
    expect(state.view!.hand.length).toBeGreaterThanOrEqual(13);
  });
});

describe('modes', () => {
  it('routes the menu into a match through opponent selection', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    expect(screen.getByText(/Choose Your Table/i)).toBeTruthy();

    // Three are preselected by default, so the table is always playable.
    expect(useSession.getState().opponents).toHaveLength(3);

    // A new character replaces only the explicitly selected physical seat.
    const before = [...useSession.getState().opponents];
    fireEvent.click(screen.getByRole('button', { name: /Edit Across seat/i }));
    fireEvent.click(screen.getByRole('button', { name: /Goro Majima — Place at Across/i }));
    expect(useSession.getState().opponents).toEqual([before[0], 'majima', before[2]]);
  });

  it('seats exactly the three opponents the player chose', () => {
    vi.useFakeTimers();
    useSession.setState({ opponents: ['ryuji', 'saeko', 'shinada'] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(1500); });

    const seated = useMatch.getState().seatPersonalities;
    expect(seated.map((s) => s.id)).toEqual(['ryuji', 'saeko', 'shinada']);
    expect(seated.map((s) => s.seat)).toEqual([1, 2, 3]);
    vi.useRealTimers();
  });

  it('walks a lesson turn by turn and will not skip a drill', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
    // The dojo is the basics, strategy and yaku-codex tracks.
    expect(screen.getByText(/of 56 lessons/i)).toBeTruthy();
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Strategy')).toBeTruthy();
    // The course opens on the first basics lesson; jump into the first
    // strategy lesson to exercise a table-led tile-efficiency lesson.
    fireEvent.click(screen.getByRole('button', { name: /Blocks, partial sets and floaters/i }));

    // A lesson opens on a live board, not on a wall of prose.
    expect(screen.getByText(/Blocks, partial sets and floaters/i)).toBeTruthy();
    expect(screen.getByText('1 / 6')).toBeTruthy();
    expect(document.querySelector('.board')).not.toBeNull();
    expect(document.querySelector('.coach')).not.toBeNull();
    // The whole table is there: the player's hand, the opponents' backs.
    expect(document.querySelectorAll('.board .tile').length).toBeGreaterThan(40);
    // and the coach is pointing at something.
    expect(document.querySelectorAll('.board .tile-focus').length).toBeGreaterThan(0);

    // Step through the guided example.
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(screen.getByText('2 / 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(screen.getByText('4 / 6')).toBeTruthy();

    // Now a drill: answered by tapping the felt, and it blocks until you do.
    const advance = screen.getByRole('button', { name: /Tap a tile/i });
    expect((advance as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.drill-why')).toBeNull();
    const playable = document.querySelectorAll('.board .hand-tile:not(:disabled)');
    expect(playable.length).toBeGreaterThan(0);
    fireEvent.click(playable[0] as HTMLElement);
    expect(document.querySelector('.drill-why')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Continue/i })).toBeTruthy();
  });

  it('marks a lesson complete only at the end and moves to the next', () => {
    useSession.setState({ lessonId: 'source', screen: 'lesson' });
    render(<App />);
    // The credits lesson is two steps and has no drills.
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(useSession.getState().completed).not.toContain('source');
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    // It is followed by the yaku codex, so the button advances to the next
    // lesson (the very last lesson in the course reads "Finish").
    fireEvent.click(screen.getByRole('button', { name: /Next lesson/i }));
    expect(useSession.getState().completed).toContain('source');
    expect(useSession.getState().lessonId).toBe('menzen-tsumo');
  });
});
