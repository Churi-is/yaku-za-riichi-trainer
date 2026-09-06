import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeView } from '../../ai/__tests__/fixtures';
import ScoreStrip from '../components/ScoreStrip';

afterEach(cleanup);

describe('public Special reminders in the match', () => {
  it('shows the rule, not a hidden hand read, under each Special score', () => {
    const view = makeView({ hand: '123m456p789sEESN' });
    view.seats[1].aiPersonalityId = 'nugget';
    view.seats[2].aiPersonalityId = 'shakedown';
    view.seats[3].aiPersonalityId = 'komaki';
    render(<ScoreStrip view={view} seatName={(seat) => ['You', 'Nugget', 'Mr. Shakedown', 'Sotaro Komaki'][seat]} />);
    expect(screen.getByLabelText('Nugget: Self-sabotage')).toBeTruthy();
    expect(screen.getByLabelText('Mr. Shakedown: Mangan min.')).toBeTruthy();
    expect(screen.getByLabelText('Sotaro Komaki: Ron only')).toBeTruthy();
  });

  it('updates Fighter’s gear from his river, and explains the riichi lock', () => {
    const view = makeView({ hand: '123m456p789sEESN' });
    view.seats[1].aiPersonalityId = 'pocket-fighter';
    const seatName = () => 'Pocket Circuit Fighter';
    const { rerender } = render(<ScoreStrip view={view} seatName={seatName} />);
    expect(screen.getByText('Redline 1/3')).toBeTruthy();
    view.seats[1].river = Array.from({ length: 3 }, (_, i) => ({
      tile: i * 4, tsumogiri: true, riichiDeclaration: false, calledBy: null, turnNumber: i,
    }));
    rerender(<ScoreStrip view={view} seatName={seatName} />);
    expect(screen.getByText('Pit stop 1/3')).toBeTruthy();
    view.seats[1].riichi = true;
    rerender(<ScoreStrip view={view} seatName={seatName} />);
    expect(screen.getByText('Riichi locked')).toBeTruthy();
    view.seats[1].riichi = false;
    view.seats[1].river = [];
    rerender(<ScoreStrip view={view} seatName={seatName} />);
    expect(screen.getByText('Redline 1/3')).toBeTruthy();
  });
});
