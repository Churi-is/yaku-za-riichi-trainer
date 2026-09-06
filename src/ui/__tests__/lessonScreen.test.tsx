import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import LessonScreen from '@ui/screens/LessonScreen';
import { lessonById } from '@dojo/course';
import { useSession } from '@state/session';

function viewport(width: number, height: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
  // Exercise the same aspect-ratio fallback as browsers without matchMedia.
  vi.stubGlobal('matchMedia', undefined);
  act(() => { window.dispatchEvent(new Event('resize')); });
}

beforeEach(() => { viewport(390, 844); });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useSession.setState({ screen: 'menu', lessonId: null, completed: [] });
});

function openLesson(id = 'blocks') {
  useSession.getState().openLesson(id);
  return render(<LessonScreen />);
}

function firstDrill(id = 'blocks') {
  const result = openLesson(id);
  const lesson = lessonById(id)!.lesson;
  const index = lesson.steps.findIndex((step) => step.kind === 'drill');
  for (let i = 0; i < index; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  return { ...result, lesson, index };
}

const expand = () => fireEvent.click(screen.getByRole('button', { name: 'Expand the coach card' }));
const collapse = () => fireEvent.click(screen.getByRole('button', { name: 'Collapse the coach card' }));
const tapTable = () => fireEvent.click(screen.getByRole('button', { name: 'Close coach card to use the table' }));
const playable = (container: HTMLElement) => container.querySelector<HTMLButtonElement>(
  '.board .hand-tile.tile-focus:not(:disabled)',
)!;

describe('mobile lesson coach', () => {
  it('keeps a complete game board, without points or content-sized board insets', () => {
    const { container } = openLesson();
    const host = container.querySelector<HTMLElement>('.lesson-board')!;
    const board = container.querySelector<HTMLElement>('.board')!;
    const boardStyle = board.getAttribute('style');
    expect(container.querySelector('.score-strip')).toBeNull();
    expect(board.querySelectorAll(':scope > .tile-back')).toHaveLength(39);
    expect(board.querySelectorAll('.hand-tile')).toHaveLength(14);

    const unchanged = () => {
      // The old screen wrote top/bottom percentages from the coach's band.
      // The board now has only a fixed CSS gutter, independent of the card.
      expect(host.style.top).toBe('');
      expect(host.style.bottom).toBe('');
      expect(board.getAttribute('style')).toBe(boardStyle);
    };
    unchanged();
    collapse();
    unchanged();
    expand();
    unchanged();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      unchanged();
    }
    tapTable();
    unchanged();
    fireEvent.click(playable(container));
    unchanged();
  });

  it('opens drills over a shaded table and consumes the first table tap without answering', () => {
    const { container, lesson, index } = firstDrill();
    const coach = container.querySelector<HTMLElement>('.coach')!;
    const body = container.querySelector<HTMLElement>('.coach-body')!;
    const stepCount = `${index + 1} / ${lesson.steps.length}`;
    expect(screen.getByRole('button', { name: 'Collapse the coach card' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(lesson.steps[index].prompt!)).toBeTruthy();
    expect(body.hidden).toBe(false);
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    expect(container.querySelectorAll('.hand-tile:not(:disabled)')).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Tap a tile' }) as HTMLButtonElement).disabled).toBe(true);

    tapTable();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expect(container.querySelector('.lesson-live')!.getAttribute('data-coach')).toBe('top');
    expect(container.querySelector('.coach-peek')!.textContent).toBe(lesson.steps[index].prompt);
    expect(screen.getByRole('button', { name: 'Expand the coach card' }).getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
    // The collapsed grip remains a fixed-height peek, not a percentage sliver.
    expect(coach.style.maxHeight).toBe('');
    expect(screen.getByText(stepCount)).toBeTruthy();
    expect(container.querySelector('.verdict-line')).toBeNull();
    expect(container.querySelector('.drill-why')).toBeNull();
    expect(playable(container)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tap a tile' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /North wind/ }));
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(container.querySelector('.drill-why')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' }).getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.hand-tile:not(:disabled)')).toHaveLength(0);

    // Every new drill starts expanded, even if the previous feedback was closed.
    collapse();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    expect(container.querySelector('.drill-why')).toBeNull();
    tapTable();
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    expect(container.querySelector('.verdict-line')).toBeNull();
  });

  it('can reopen the card normally without allowing answers through it', () => {
    const { container } = firstDrill();
    collapse();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expect(playable(container)).toBeTruthy();
    expand();
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    const tile = screen.getByRole('button', { name: /North wind/ }) as HTMLButtonElement;
    expect(tile.disabled).toBe(true); // also prevents keyboard activation under the shade
    fireEvent.click(tile);
    expect(container.querySelector('.verdict-line')).toBeNull();

    tapTable();
    expect(tile.disabled).toBe(false);
    expect(container.querySelector('.verdict-line')).toBeNull();
    fireEvent.click(tile);
    expect(screen.getByText('Correct')).toBeTruthy();

    // Feedback can be put away with a table tap and reopened without losing it.
    tapTable();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expand();
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(container.querySelector('.drill-why')).not.toBeNull();
  });

  it('also opens feedback for a wrong choice and a tile outside the choices', () => {
    const { container } = firstDrill();
    tapTable();
    fireEvent.click(playable(container)); // 2p is lit, but not the right discard.
    expect(screen.getByText('Not the best answer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    tapTable();
    const unlit = container.querySelector<HTMLButtonElement>('.hand-tile:not(.tile-focus):not(:disabled)')!;
    fireEvent.click(unlit);
    expect(screen.getByText('Not one of the choices')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
  });

  it('collapses even bottom-docked teaching and drills up to the top', () => {
    const { container } = openLesson('safe-tiles');
    const root = container.querySelector('.lesson-live')!;
    expect(root.getAttribute('data-coach')).toBe('bottom');
    collapse();
    expect(root.getAttribute('data-coach')).toBe('top');
    expand();
    expect(root.getAttribute('data-coach')).toBe('bottom');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(root.getAttribute('data-coach')).toBe('bottom');
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    tapTable();
    expect(root.getAttribute('data-coach')).toBe('top');
    expand();
    fireEvent.click(screen.getByRole('button', { name: 'The 3p — it is already in their pond' }));
    expect(root.getAttribute('data-coach')).toBe('bottom');
    expect(container.querySelector('.drill-why')).not.toBeNull();
  });

  it('shows judgement choices immediately and can reopen them without skipping the question', () => {
    const { container, lesson, index } = firstDrill('insta-riichi');
    const stepCount = `${index + 1} / ${lesson.steps.length}`;
    expect(container.querySelectorAll('.drill-opt')).toHaveLength(3);
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Choose an answer' }) as HTMLButtonElement).disabled).toBe(true);
    // Reading/tapping the card is not a table-dismiss gesture.
    fireEvent.click(screen.getByText(lesson.steps[index].prompt!));
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);

    tapTable();
    expect(screen.getByText(stepCount)).toBeTruthy();
    expect(container.querySelectorAll('.drill-opt')).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Choose an answer' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Choose an answer' }));
    expect(container.querySelectorAll('.drill-opt')).toHaveLength(3);
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();

    // The shade is behind the card: answer buttons still work on the first tap.
    fireEvent.click(screen.getByRole('button', { name: 'Riichi, discarding 1m' }));
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(screen.getByText(stepCount)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not shade teaching steps or close them on a table click', () => {
    const { container } = openLesson();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    fireEvent.click(container.querySelector('.lesson-felt')!);
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);
  });

  it('keeps the grip outside the scrolling text and resets scroll on reopening', () => {
    const { container } = firstDrill();
    const body = container.querySelector<HTMLElement>('.coach-body')!;
    const grip = screen.getByRole('button', { name: 'Collapse the coach card' });
    expect(body.contains(grip)).toBe(false);
    expect(grip.getAttribute('aria-controls')).toBe(body.id);
    expect(screen.getByRole('button', { name: 'Close coach card to use the table' }).getAttribute('aria-controls')).toBe(body.id);
    const scrollTo = vi.fn();
    body.scrollTo = scrollTo;
    tapTable();
    scrollTo.mockClear();
    expand();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('resets the coach when going back to teaching or opening the next lesson', () => {
    const { container } = firstDrill();
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    for (let i = 0; i < 3; i++) {
      tapTable();
      fireEvent.click(playable(container));
      fireEvent.click(screen.getByRole('button', { name: i < 2 ? 'Continue' : 'Next lesson' }));
    }
    expect(useSession.getState().completed).toContain('blocks');
    expect(useSession.getState().lessonId).toBe('complex');
    expect(screen.getByText('1 / 5')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
  });
});

describe('responsive lesson coach', () => {
  it.each([[760, 360], [844, 390], [1280, 800]])('keeps the side coach open and the table unshaded at %ix%i', (w, h) => {
    viewport(w, h);
    const { container } = firstDrill();
    const root = container.querySelector('.lesson-live')!;
    const coach = container.querySelector<HTMLElement>('.coach')!;
    expect(root.getAttribute('data-orient')).toBe('landscape');
    expect(root.getAttribute('data-coach')).toBe('rail');
    expect(coach.classList.contains('coach-rail')).toBe(true);
    expect(coach.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expect(container.querySelector('.coach-peek')).toBeNull();
    expect(container.querySelector('.lesson-bar-coach')).toBeNull();
    expect(container.querySelector('.lesson-bar-title strong')!.textContent).toBe('Blocks, partial sets and floaters');
    expect(screen.queryByRole('button', { name: /the coach card/ })).toBeNull();

    fireEvent.click(playable(container));
    expect(root.getAttribute('data-coach')).toBe('rail');
    expect(container.querySelector('.drill-why')).not.toBeNull();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(root.getAttribute('data-coach')).toBe('rail');
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);
    expect(container.querySelector('.coach-peek')).toBeNull();
  });

  it('preserves the existing band layout on landscape windows narrower than the rail breakpoint', () => {
    viewport(667, 375);
    const { container } = firstDrill('safe-tiles');
    const root = container.querySelector('.lesson-live')!;
    const host = container.querySelector<HTMLElement>('.lesson-board')!;
    expect(root.getAttribute('data-coach')).toBe('bottom');
    expect(host.style.bottom).toMatch(/^calc\(/);
    expect(container.querySelector('.coach-peek')).toBeNull();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' }).getAttribute('aria-expanded')).toBe('true');
    collapse();
    expect(root.getAttribute('data-coach')).toBe('bottom');
    expect(container.querySelector('.lesson-bar-title')).not.toBeNull();
  });

  it('still answers on the first tile click in narrow landscape', () => {
    viewport(667, 375);
    const { container } = firstDrill();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    fireEvent.click(playable(container));
    expect(container.querySelector('.verdict-line')).not.toBeNull();
  });

  it.each([[844, 390], [1280, 800]])('keeps the shade portrait-only when rotating through %ix%i', (w, h) => {
    const { container } = firstDrill();
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    viewport(w, h);
    expect(container.querySelector('.lesson-live')!.getAttribute('data-coach')).toBe('rail');
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expect(playable(container)).toBeTruthy();

    viewport(390, 844);
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    expect(container.querySelector('.lesson-table-shade')).not.toBeNull();
    tapTable();
    viewport(w, h);
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    viewport(390, 844);
    expect(screen.getByRole('button', { name: 'Expand the coach card' })).toBeTruthy();
    expect(container.querySelector('.lesson-table-shade')).toBeNull();
    expect(playable(container)).toBeTruthy();
  });
});
