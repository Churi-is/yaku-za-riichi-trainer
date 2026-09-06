import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, cleanup, fireEvent, screen } from '@testing-library/react';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

afterEach(() => { cleanup(); vi.useRealTimers(); useMatch.getState().reset(); useSession.setState({ screen: 'menu' }); });

describe('match screen smoke', () => {
  it('deals a full hand to the human seat', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(2000); });
    // "Deal" dismisses the intro and starts play (the pump holds until then).
    const deal = screen.getByRole('button', { name: /Deal/i });
    act(() => { fireEvent.click(deal); });
    act(() => { vi.advanceTimersByTime(2000); });

    const st = useMatch.getState();
    expect(st.view!.hand.length + (st.view!.drawnTile !== null ? 1 : 0)).toBeGreaterThanOrEqual(13);
  });

  it('discards in two taps: lift the tile, then confirm', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(2000); });
    // "Deal" dismisses the intro and starts play (the pump holds until then).
    const deal = screen.getByRole('button', { name: /Deal/i });
    act(() => { fireEvent.click(deal); });
    act(() => { vi.advanceTimersByTime(3000); });

    // wait for the human's turn
    for (let i = 0; i < 40 && useMatch.getState().humanLegal.length === 0; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    const playable = () => Array.from(
      container.querySelectorAll('.board .hand-tile'),
    ).filter((b) => !(b as HTMLButtonElement).disabled) as HTMLButtonElement[];
    expect(playable().length).toBeGreaterThan(0);

    const riverBefore = useMatch.getState().view!.seats[0].river.length;
    const tile = playable()[0];
    act(() => { fireEvent.click(tile); });
    // first tap only lifts it — nothing has left the hand yet
    expect(useMatch.getState().view!.seats[0].river.length).toBe(riverBefore);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    const confirm = container.querySelector('.call-btn.confirm') as HTMLButtonElement;
    expect(confirm).toBeTruthy();

    act(() => { fireEvent.click(confirm); });
    expect(useMatch.getState().view!.seats[0].river.length).toBe(riverBefore + 1);
  });

  it('tapping the same tile twice throws it', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(2000); });
    // "Deal" dismisses the intro and starts play (the pump holds until then).
    const deal = screen.getByRole('button', { name: /Deal/i });
    act(() => { fireEvent.click(deal); });
    act(() => { vi.advanceTimersByTime(3000); });
    for (let i = 0; i < 40 && useMatch.getState().humanLegal.length === 0; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    const tile = (Array.from(container.querySelectorAll('.board .hand-tile'))
      .filter((b) => !(b as HTMLButtonElement).disabled) as HTMLButtonElement[])[0];
    const before = useMatch.getState().view!.seats[0].river.length;
    act(() => { fireEvent.click(tile); });
    act(() => { fireEvent.click(tile); });
    expect(useMatch.getState().view!.seats[0].river.length).toBe(before + 1);
  });
});
