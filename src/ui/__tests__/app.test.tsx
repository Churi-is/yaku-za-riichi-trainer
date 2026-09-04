import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useMatch.getState().reset();
  useSession.setState({ screen: 'menu', matchLog: null });
});

describe('App shell + screen wiring', () => {
  it('renders the main menu', () => {
    render(<App />);
    expect(screen.getByText(/Mahjong Trainer/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /New Match/i })).toBeTruthy();
  });

  it('navigates menu → settings and shows the rules summary card', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Match/i }));
    expect(screen.getByText(/Table Settings/i)).toBeTruthy();
    expect(screen.getByText(/Current rules/i)).toBeTruthy();
    // toggles present
    expect(screen.getByLabelText(/Red fives/i)).toBeTruthy();
  });

  it('starts a match, deals a hand, and renders the table without crashing', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Match/i }));
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
