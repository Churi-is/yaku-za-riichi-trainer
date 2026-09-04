import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PublicView, SeatIndex } from '@engine/types';
import { DEFAULT_SETTINGS } from '@engine/types';
import YakuAdvisorPanel from '@ui/overlays/YakuAdvisorPanel';
import OpponentReadingPanel from '@ui/overlays/OpponentReadingPanel';
import WaitGuessingPanel from '@ui/overlays/WaitGuessingPanel';

afterEach(cleanup);

/** An empty-ish but well-formed public view (no tiles, empty rivers). */
function emptyView(): PublicView {
  const seats = {} as PublicView['seats'];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    seats[s] = {
      seat: s,
      seatWind: 'east',
      melds: [],
      river: [],
      points: 25000,
      riichi: false,
      riichiTurn: null,
      ippatsu: false,
      concealedCount: s === 0 ? 13 : 13,
      isClosed: true,
      aiPersonalityId: s === 0 ? null : 'x',
    };
  }
  return {
    viewer: 0,
    settings: { ...DEFAULT_SETTINGS },
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: 0,
    phase: 'awaitingDiscard',
    hand: [],
    drawnTile: null,
    seats,
    doraIndicators: [0],
    tilesRemaining: 70,
    lastDiscard: null,
    visibleCounts: new Array(34).fill(0),
  };
}

const seatName = (s: SeatIndex) => (s === 0 ? 'You' : `Seat ${s}`);

describe('overlay panels render with empty/minimal data', () => {
  it('Yaku advisor renders its header without crashing', () => {
    render(<YakuAdvisorPanel view={emptyView()} />);
    expect(screen.getByText(/Yaku Advisor/i)).toBeTruthy();
    // The advisor must never reference specific tiles to keep/seek/cut. It may
    // only show yaku names, han, definitions and bands. Assert no tile tokens
    // (e.g. "3m", "5p", "East") appear in the rendered advisor output.
    const advisor = screen.getByText(/Yaku Advisor/i).closest('.overlay-panel')!;
    expect(advisor.textContent).not.toMatch(/\b\d+[mps]\b/);
  });

  it('Yaku advisor labels its output as simulated, never as certain', () => {
    render(<YakuAdvisorPanel view={emptyView()} />);
    expect(screen.getAllByText(/simulat/i).length).toBeGreaterThan(0);
  });

  it('Opponent reading renders one section per opponent', () => {
    render(<OpponentReadingPanel view={emptyView()} seatName={seatName} />);
    expect(screen.getByText(/Opponent Reads/i)).toBeTruthy();
    expect(screen.getByText('Seat 1')).toBeTruthy();
    expect(screen.getByText('Seat 2')).toBeTruthy();
    expect(screen.getByText('Seat 3')).toBeTruthy();
  });

  it('Wait guessing renders header and practice toggle', () => {
    render(<WaitGuessingPanel view={emptyView()} seatName={seatName} />);
    expect(screen.getByText(/Wait Guessing/i)).toBeTruthy();
    expect(screen.getByText(/Practice mode/i)).toBeTruthy();
  });
});
