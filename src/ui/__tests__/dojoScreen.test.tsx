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

const lessonIdsOf = (trackId: string) =>
  TRACKS.find((t) => t.id === trackId)!.chapters
    .flatMap((c) => c.lessons.map((l) => l.id));

afterEach(() => {
  cleanup();
  useSession.setState({ lessonId: null, completed: [] });
});

describe('the multi-track dojo', () => {
  it('lists the Basics, Strategy and Yaku Codex tracks in teaching order', () => {
    expect(TRACKS.map((t) => t.id)).toEqual(['basics', 'strategy', 'yaku']);
    goDojo();
    const basics = screen.getByText('Basics').closest('section')!;
    const strategy = screen.getByText('Strategy').closest('section')!;
    const codex = screen.getByText('Yaku Codex').closest('section')!;
    // Document order: basics, then strategy, then the reference codex.
    expect(basics.compareDocumentPosition(strategy) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(strategy.compareDocumentPosition(codex) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    // The strategy track still points at the Riichi Book I chapters.
    expect(within(strategy).getByText(/Book ch\.3/i)).toBeTruthy();
    // The basics and codex tracks show no book tags — they are not book chapters.
    expect(within(basics).queryByText(/Book ch\./i)).toBeNull();
    expect(within(codex).queryByText(/Book ch\./i)).toBeNull();
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
    const codexRows = document.querySelectorAll('.track-yaku .lesson-row');
    expect(basicsRows[0].classList.contains('next')).toBe(true);
    strategyRows.forEach((row) => expect(row.classList.contains('next')).toBe(false));
    codexRows.forEach((row) => expect(row.classList.contains('next')).toBe(false));
    expect(basicsRows.length).toBe(11);
  });

  it('advances the up-next pointer into strategy once all basics are done', () => {
    useSession.setState({ screen: 'menu', lessonId: null, completed: lessonIdsOf('basics') });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
    const strategyRows = document.querySelectorAll('.track-strategy .lesson-row');
    expect(strategyRows[0].classList.contains('next')).toBe(true);
    expect(screen.getByRole('button', { name: /Continue the strategy course/i })).toBeTruthy();
    // The basics track header reads as complete.
    const basics = screen.getByText('Basics').closest('section')!;
    expect(within(basics).getByText('complete')).toBeTruthy();
  });

  it('advances into the yaku codex once basics and strategy are done', () => {
    useSession.setState({
      screen: 'menu', lessonId: null,
      completed: [...lessonIdsOf('basics'), ...lessonIdsOf('strategy')],
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /The Dojo/i }));
    const codexRows = document.querySelectorAll('.track-yaku .lesson-row');
    expect(codexRows.length).toBe(31);
    expect(codexRows[0].classList.contains('next')).toBe(true);
  });
});
