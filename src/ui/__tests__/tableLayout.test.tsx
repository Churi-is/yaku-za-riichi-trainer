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
  it('renders walls, four seat zones, centre info and the score strip', () => {
    const { container } = startMatch();
    const board = container.querySelector('.board');
    expect(board).toBeTruthy();
    expect(['portrait', 'landscape']).toContain(board!.getAttribute('data-orient'));
    expect(container.querySelectorAll('.wall').length).toBe(4);
    expect(container.querySelectorAll('.zone').length).toBe(5);
    expect(container.querySelector('.wind-cube')).toBeTruthy();
    expect(container.querySelector('.dora-tray')).toBeTruthy();
    expect(container.querySelectorAll('.score-plate').length).toBe(4);
    // hand + calls live below the felt, in that order
    const dock = container.querySelector('.dock-bottom');
    expect(dock!.querySelector('.hand-dock')).toBeTruthy();
    expect(dock!.querySelector('.call-bar .player-plate')).toBeTruthy();
  });

  it('keeps every opponent concealed: only backs on the felt', () => {
    const { container } = startMatch();
    const zones = container.querySelectorAll('.zone-top .tile, .zone-left .tile, .zone-right .tile');
    expect(zones.length).toBeGreaterThan(0);
    zones.forEach((z) => {
      // river/meld tiles are faces; concealed tiles must be backs with no art
      if (z.querySelector('.tile-art')) {
        expect(z.className).not.toContain('tile-back');
      }
    });
    const backs = container.querySelectorAll('.zone-top .tile-back, .zone-left .tile-back, .zone-right .tile-back');
    expect(backs.length).toBeGreaterThanOrEqual(39);
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
