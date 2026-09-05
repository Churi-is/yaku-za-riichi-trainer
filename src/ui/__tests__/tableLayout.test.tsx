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
  useSession.setState({ screen: 'menu' });
});

function startMatch() {
  vi.useFakeTimers();
  const r = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
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
    // no name plates on the felt: the score strip up top is the scoreboard
    expect(container.querySelectorAll('.plate-box').length).toBe(0);
    expect(board!.querySelector('.seat-plate')).toBeNull();
    expect(container.querySelector('.wind-cube')).toBeTruthy();
    expect(container.querySelector('.dora-tray')).toBeTruthy();
    expect(container.querySelectorAll('.score-plate').length).toBe(4);
    // the human hand sits on the felt, face-up and tappable
    const handTiles = board!.querySelectorAll('.tile-clickable');
    expect(handTiles.length).toBeGreaterThanOrEqual(13);
    // calls stay below the felt; no hand row or redundant plates down there
    const dock = container.querySelector('.dock-bottom');
    expect(dock!.querySelector('.hand-dock')).toBeNull();
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

});
