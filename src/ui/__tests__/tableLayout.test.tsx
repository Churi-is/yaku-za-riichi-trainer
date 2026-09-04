/** Layout contract: the match screen is a top-down table in both orientations. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, cleanup, fireEvent, screen } from '@testing-library/react';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useMatch.getState().reset();
  useSession.setState({ screen: 'menu', matchLog: null });
});

function startMatch() {
  vi.useFakeTimers();
  const r = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /New Match/i }));
  act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
  act(() => { vi.advanceTimersByTime(2000); });
  const deal = screen.queryByRole('button', { name: /^Deal$/i });
  if (deal) act(() => { fireEvent.click(deal); });
  act(() => { vi.advanceTimersByTime(2000); });
  return r;
}

describe('top-down table layout', () => {
  it('renders a deterministically positioned board with centre info and score strip', () => {
    const { container } = startMatch();
    const board = container.querySelector('.board') as HTMLElement;
    expect(board).toBeTruthy();
    expect(['portrait', 'landscape']).toContain(board!.getAttribute('data-orient'));
    // every felt object is absolutely positioned by the layout model
    const placed = Array.from(board!.children).filter((el) => el.classList.contains('abs'));
    expect(placed.length).toBeGreaterThan(40);
    placed.forEach((el) => {
      const st = (el as HTMLElement).style;
      expect(st.left !== '' || st.transform !== '').toBe(true);
      expect(st.top !== '' || st.transform !== '').toBe(true);
    });
    expect(container.querySelectorAll('.plate-box').length).toBe(3);
    expect(container.querySelector('.wind-cube')).toBeTruthy();
    expect(container.querySelector('.dora-tray')).toBeTruthy();
    expect(container.querySelectorAll('.score-plate').length).toBe(4);
    // hand + calls live below the felt, in that order
    const dock = container.querySelector('.dock-bottom');
    expect(dock!.querySelector('.hand-dock')).toBeTruthy();
    expect(dock!.querySelector('.call-bar')).toBeTruthy();
    // no redundant points plate or waiting row in the dock: the score strip
    // carries points and the turn status lives up with the trainer toggles
    expect(dock!.querySelector('.player-plate')).toBeNull();
    expect(dock!.querySelector('.hand-status')).toBeNull();
  });

  it('keeps every opponent concealed: only backs for concealed tiles', () => {
    const { container } = startMatch();
    const backs = container.querySelectorAll('.board .tile-back');
    expect(backs.length).toBeGreaterThanOrEqual(39);
    backs.forEach((b) => expect(b.textContent).toBe(''));
  });

  it('docks the trainer overlays instead of floating them over the table', () => {
    const { container } = startMatch();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Yaku' })); });
    const dock = container.querySelector('.overlay-dock');
    expect(dock).toBeTruthy();
    // in flow, i.e. a sibling of the felt, not an absolutely positioned layer
    expect(dock!.parentElement!.className).toContain('match-main');
    expect(container.querySelector('.overlay-layer')).toBeNull();
  });
});
