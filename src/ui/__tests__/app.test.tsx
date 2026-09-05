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

  it('opens the dojo and walks a lesson', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
    expect(screen.getByText(/of 14 lessons/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Start the course/i }));
    expect(screen.getByText(/Blocks, partial sets and floaters/i)).toBeTruthy();
    // Tiles render as real tiles, not as notation text.
    expect(document.querySelectorAll('.lesson-body .tile').length).toBeGreaterThan(5);

    // A drill only explains itself after you commit to an answer.
    expect(document.querySelector('.drill-why')).toBeNull();
    fireEvent.click(document.querySelectorAll('.drill-opt')[0] as HTMLElement);
    expect(document.querySelector('.drill-why')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Done — next/i }));
    expect(useSession.getState().completed).toContain('blocks');
  });
});
