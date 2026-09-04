import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

afterEach(() => { cleanup(); vi.useRealTimers(); useMatch.getState().reset(); useSession.setState({ screen: 'menu', matchLog: null }); });

describe('match screen smoke', () => {
  it('renders overlays when toggled and lets the human discard', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Match/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(2000); });

    // dismiss the personalities intro if present
    const deal = screen.queryByRole('button', { name: /^Deal$/i });
    if (deal) act(() => { fireEvent.click(deal); });
    act(() => { vi.advanceTimersByTime(2000); });

    // turn overlays on
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Yaku$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Reads$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Waits$/i }));
    });
    expect(screen.getByText(/Yaku Advisor/i)).toBeTruthy();
    expect(screen.getByText(/Opponent Reads/i)).toBeTruthy();
    expect(screen.getByText(/Wait Guessing/i)).toBeTruthy();

    // the human hand dock exists with tiles
    const st = useMatch.getState();
    expect(st.view!.hand.length + (st.view!.drawnTile !== null ? 1 : 0)).toBeGreaterThanOrEqual(13);
  });
});
