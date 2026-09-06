import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '@ui/App';
import { TRACKS } from '@dojo/course';
import { useSession } from '@state/session';

const goDojo = () => {
  useSession.setState({ screen: 'menu', lessonId: null, completed: [] });
  const r = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
  return r;
};

afterEach(() => {
  cleanup();
  useSession.setState({ lessonId: null, completed: [] });
});

describe('the two-track dojo', () => {
  it('lists a Basics track and a Strategy track in teaching order', () => {
    expect(TRACKS.map((t) => t.id)).toEqual(['basics', 'strategy']);
    goDojo();
    const basics = screen.getByText('Basics').closest('section')!;
    const strategy = screen.getByText('Strategy').closest('section')!;
    // Basics precedes Strategy in the document.
    expect(basics.compareDocumentPosition(strategy) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    // The strategy track still points at the Riichi Book I chapters.
    expect(within(strategy).getByText(/Book ch\.3/i)).toBeTruthy();
    // The basics track shows no book tags — it is not a book chapter.
    expect(within(basics).queryByText(/Book ch\./i)).toBeNull();
  });

  it('opens the first basics lesson from the up-front CTA, and the lesson says so', () => {
    goDojo();
    expect(screen.getByRole('button', { name: /Start with the basics/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Start with the basics/i }));
    // Now on the lesson screen for the first basics lesson; the crumb names
    // the track and chapter.
    expect(screen.getByText(/Basics ·/i)).toBeTruthy();
    expect(screen.getAllByText(/A hand you build yourself/i).length).toBeGreaterThan(0);
  });

  it('points the up-next row at the first basics lesson while basics is unfinished', () => {
    goDojo();
    const basicsRows = document.querySelectorAll('.track-basics .lesson-row');
    const strategyRows = document.querySelectorAll('.track-strategy .lesson-row');
    expect(basicsRows[0].classList.contains('next')).toBe(true);
    strategyRows.forEach((row) => expect(row.classList.contains('next')).toBe(false));
    expect(basicsRows.length).toBe(11);
  });

  it('advances the up-next pointer into strategy once all basics are done', () => {
    const basicsLessonIds = TRACKS.find((t) => t.id === 'basics')!.chapters
      .flatMap((c) => c.lessons.map((l) => l.id));
    useSession.setState({ screen: 'menu', lessonId: null, completed: basicsLessonIds });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
    const strategyRows = document.querySelectorAll('.track-strategy .lesson-row');
    expect(strategyRows[0].classList.contains('next')).toBe(true);
    expect(screen.getByRole('button', { name: /Continue the strategy course/i })).toBeTruthy();
    // The basics track header reads as complete.
    const basics = screen.getByText('Basics').closest('section')!;
    expect(within(basics).getByText('complete')).toBeTruthy();
  });
});
