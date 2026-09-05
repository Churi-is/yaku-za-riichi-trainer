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

    // Choosing a fourth replaces the oldest rather than doing nothing.
    const before = useSession.getState().opponents;
    fireEvent.click(screen.getByRole('button', { name: /Goro the Bulldozer/i }));
    const after = useSession.getState().opponents;
    expect(after).toHaveLength(3);
    expect(after).toContain('goro');
    expect(after[2]).toBe('goro');
    expect(after[0]).toBe(before[1]);
  });

  it('seats exactly the three opponents the player chose', () => {
    vi.useFakeTimers();
    useSession.setState({ opponents: ['ryu', 'nao', 'hoshi'] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(1500); });

    const seated = useMatch.getState().seatPersonalities;
    expect(seated.map((s) => s.id)).toEqual(['ryu', 'nao', 'hoshi']);
    expect(seated.map((s) => s.seat)).toEqual([1, 2, 3]);
    vi.useRealTimers();
  });

  it('walks a lesson turn by turn and will not skip a drill', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
    expect(screen.getByText(/of 14 lessons/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Start the course/i }));

    // A lesson opens on its first scripted turn, not on a wall of prose.
    expect(screen.getByText(/Blocks, partial sets and floaters/i)).toBeTruthy();
    expect(screen.getByText('1 / 6')).toBeTruthy();
    expect(document.querySelector('.position')).not.toBeNull();
    expect(document.querySelectorAll('.tile').length).toBeGreaterThan(10);

    // Step through the guided example.
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(screen.getByText('2 / 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(screen.getByText('4 / 6')).toBeTruthy();

    // Now a drill: it blocks until answered, and explains every option after.
    const advance = screen.getByRole('button', { name: /Choose an answer/i });
    expect((advance as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.drill-why')).toBeNull();
    fireEvent.click(document.querySelectorAll('.drill-opt')[0] as HTMLElement);
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
    fireEvent.click(screen.getByRole('button', { name: /Finish the course/i }));
    expect(useSession.getState().completed).toContain('source');
    expect(useSession.getState().screen).toBe('dojo');
  });
});
