/** Mobile layout tests — PLAN-MOBILE-LAYOUT §12.2. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DiscardEntry, PublicSeatView } from '@engine/types';
import Tile from '@ui/components/Tile';
import DiscardRiver from '@ui/components/DiscardRiver';
import SeatInfo from '@ui/components/SeatInfo';
import CallButtons from '@ui/components/CallButtons';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useMatch.getState().reset();
  useSession.setState({ screen: 'menu', matchLog: null });
  window.matchMedia = undefined as unknown as typeof window.matchMedia;
});

function entry(over: Partial<DiscardEntry> = {}): DiscardEntry {
  return { tile: 0, tsumogiri: false, riichiDeclaration: false, calledBy: null, turnNumber: 0, ...over };
}

const SEAT: PublicSeatView = {
  seat: 3, seatWind: 'east', melds: [], river: [], points: 25000,
  riichi: false, riichiTurn: null, ippatsu: false, concealedCount: 13,
  isClosed: true, aiPersonalityId: null,
};

describe('Tile sideways orientation', () => {
  it('renders left/right sideways classes and cancels them for markers', () => {
    const { container } = render(<Tile id={0} orientation="left" />);
    expect(container.querySelector('.tile-s-left')).toBeTruthy();
    expect(container.querySelector('.tile-s-left .tile-face')).toBeTruthy();
  });

  it('adds tile-marker and keeps an upright box for markers', () => {
    const { container } = render(<Tile id={0} orientation="right" marker />);
    expect(container.querySelector('.tile-s-right.tile-marker')).toBeTruthy();
  });
});

describe('DiscardRiver side columns', () => {
  it('chunks a side river into columns of 6 with marker on the riichi declaration', () => {
    const river = [
      entry({ tile: 0 }),
      entry({ tile: 4 }),
      entry({ tile: 8, riichiDeclaration: true }),
      entry({ tile: 12 }),
      entry({ tile: 16 }),
      entry({ tile: 20 }),
      entry({ tile: 24 }),
    ];
    const { container } = render(<DiscardRiver river={river} orientation="left" />);
    const cols = container.querySelectorAll('.river-col');
    expect(cols.length).toBe(2);
    expect(cols[0].querySelectorAll('.tile').length).toBe(6);
    expect(cols[1].querySelectorAll('.tile').length).toBe(1);
    // DOM order = discard order (5th tile is the riichi declaration, index 2).
    const tiles = container.querySelectorAll('.river-side .tile');
    expect(tiles[2].classList.contains('tile-marker')).toBe(true);
    expect(tiles[0].classList.contains('tile-s-left')).toBe(true);
  });

  it('marks called-away tiles dimmed', () => {
    const { container } = render(
      <DiscardRiver river={[entry({ calledBy: 1 })]} orientation="right" />,
    );
    expect(container.querySelector('.tile-dimmed')).toBeTruthy();
    expect(container.querySelector('.tile-s-right')).toBeTruthy();
  });
});

describe('SeatInfo compact mode', () => {
  it('renders the backs ladder (mini grid + count) when compact', () => {
    const { container } = render(
      <SeatInfo seat={SEAT} personalityName="Rin" isTurn={false} isDealer={false} compact orientation="left" />,
    );
    expect(container.querySelector('.backs-grid.mini')).toBeTruthy();
    expect(container.querySelector('.backs-count')?.textContent).toBe('13');
    expect(container.querySelector('.tile-s-left')).toBeTruthy();
  });

  it('keeps the full backs row in non-compact (desktop) mode', () => {
    const { container } = render(
      <SeatInfo seat={SEAT} personalityName="Rin" isTurn={false} isDealer={false} />,
    );
    expect(container.querySelector('.backs-grid')).toBeNull();
    expect(container.querySelectorAll('.opp-backs > .tile').length).toBe(13);
  });
});

describe('CallButtons idle', () => {
  it('renders nothing when there are no legal actions', () => {
    const { container } = render(
      <CallButtons legal={[]} riichiMode={false} onEnterRiichiMode={() => {}} onCancelRiichi={() => {}} onAct={() => {}} />,
    );
    expect(container.childElementCount).toBe(0);
  });
});

describe('MatchScreen mobile skeletons', () => {
  function mockViewport(viewport: 'portrait' | 'landscape') {
    const make = (matches: boolean) => ({
      matches,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    window.matchMedia = vi.fn((q: string) =>
      make(q.includes('portrait') ? viewport === 'portrait' : viewport === 'landscape'),
    ) as unknown as typeof window.matchMedia;
  }

  function startMatch() {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Match/i }));
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
    act(() => { vi.advanceTimersByTime(2000); });
    const deal = screen.queryByRole('button', { name: /^Deal$/i });
    if (deal) act(() => { fireEvent.click(deal); });
    act(() => { vi.advanceTimersByTime(2000); });
  }

  it('adds the portrait skeleton class and opens the overlay sheet as a dialog', () => {
    mockViewport('portrait');
    startMatch();
    const matchEl = document.querySelector('.match');
    expect(matchEl?.classList.contains('match-portrait')).toBe(true);

    act(() => { fireEvent.click(screen.getByRole('button', { name: /^Yaku$/i })); });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(/Yaku Advisor/i)).toBeTruthy();
  });

  it('adds the landscape skeleton class', () => {
    mockViewport('landscape');
    startMatch();
    expect(document.querySelector('.match')?.classList.contains('match-landscape')).toBe(true);
  });
});
