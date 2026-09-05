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
    fireEvent.click(playable(container));
    unchanged();
  });

  it('starts tile drills as a top peek, then reopens feedback after a table tap', () => {
    const { container, lesson, index } = firstDrill();
    const coach = container.querySelector<HTMLElement>('.coach')!;
    const grip = screen.getByRole('button', { name: 'Expand the coach card' });
    expect(grip.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.lesson-live')!.getAttribute('data-coach')).toBe('top');
    expect(container.querySelector('.coach-peek')!.textContent).toBe(lesson.steps[index].prompt);
    // A percentage max-height used to clip the collapsed grip on short phones.
    expect(coach.style.maxHeight).toBe('');
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(true);
    expect((screen.getByRole('button', { name: 'Tap a tile' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /North wind/ }));
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(container.querySelector('.drill-why')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' }).getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.hand-tile:not(:disabled)')).toHaveLength(0);

    // Feedback can still be put away; the following drill starts compact again.
    collapse();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Expand the coach card' })).toBeTruthy();
    expect(container.querySelector('.drill-why')).toBeNull();
    expect(playable(container)).toBeTruthy();
  });

  it('also opens feedback for a wrong choice and a tile outside the choices', () => {
    const { container } = firstDrill();
    fireEvent.click(playable(container)); // 2p is lit, but not the right discard.
    expect(screen.getByText('Not the best answer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
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
    expect(root.getAttribute('data-coach')).toBe('top');
    expect(screen.getByRole('button', { name: 'Expand the coach card' })).toBeTruthy();
    expand();
    fireEvent.click(screen.getByRole('button', { name: 'The 3p — it is already in their pond' }));
    expect(root.getAttribute('data-coach')).toBe('bottom');
    expect(container.querySelector('.drill-why')).not.toBeNull();
  });

  it('lets judgement drills open their choices without skipping the question', () => {
    const { container, lesson, index } = firstDrill('insta-riichi');
    const stepCount = `${index + 1} / ${lesson.steps.length}`;
    const choose = screen.getByRole('button', { name: 'Choose an answer' }) as HTMLButtonElement;
    expect(choose.disabled).toBe(false);
    expect(container.querySelectorAll('.drill-opt')).toHaveLength(0);
    fireEvent.click(choose);
    expect(screen.getByText(stepCount)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Choose an answer' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelectorAll('.drill-opt')).toHaveLength(3);

    // A manually collapsed question can be opened from the same footer action.
    collapse();
    fireEvent.click(screen.getByRole('button', { name: 'Choose an answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Riichi, discarding 1m' }));
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(screen.getByText(stepCount)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the grip outside the scrolling text and resets scroll on reopening', () => {
    const { container } = openLesson();
    const body = container.querySelector<HTMLElement>('.coach-body')!;
    const grip = screen.getByRole('button', { name: 'Collapse the coach card' });
    expect(body.contains(grip)).toBe(false);
    expect(grip.getAttribute('aria-controls')).toBe(body.id);
    const scrollTo = vi.fn();
    body.scrollTo = scrollTo;
    collapse();
    scrollTo.mockClear();
    expand();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('resets the coach when going back to teaching or opening the next lesson', () => {
    const { container } = firstDrill();
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    for (let i = 0; i < 3; i++) {
      fireEvent.click(playable(container));
      fireEvent.click(screen.getByRole('button', { name: i < 2 ? 'Continue' : 'Next lesson' }));
    }
    expect(useSession.getState().completed).toContain('blocks');
    expect(useSession.getState().lessonId).toBe('complex');
    expect(screen.getByText('1 / 5')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse the coach card' })).toBeTruthy();
  });
});

describe('responsive lesson coach', () => {
  it.each([[760, 360], [844, 390], [1280, 800]])('keeps the side coach open at %ix%i, including during drills', (w, h) => {
    viewport(w, h);
    const { container } = firstDrill();
    const root = container.querySelector('.lesson-live')!;
    const coach = container.querySelector<HTMLElement>('.coach')!;
    expect(root.getAttribute('data-orient')).toBe('landscape');
    expect(root.getAttribute('data-coach')).toBe('rail');
    expect(coach.classList.contains('coach-rail')).toBe(true);
    expect(coach.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);
    expect(container.querySelector('.coach-peek')).toBeNull();
    expect(container.querySelector('.lesson-bar-coach')).toBeNull();
    expect(container.querySelector('.lesson-bar-title strong')!.textContent).toBe('Blocks, partial sets and floaters');
    expect(screen.queryByRole('button', { name: /the coach card/ })).toBeNull();

    fireEvent.click(playable(container));
    expect(root.getAttribute('data-coach')).toBe('rail');
    expect(container.querySelector('.drill-why')).not.toBeNull();
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
    expect(screen.getByRole('button', { name: 'Collapse the coach card' }).getAttribute('aria-expanded')).toBe('true');
    collapse();
    expect(root.getAttribute('data-coach')).toBe('bottom');
    expect(container.querySelector('.lesson-bar-title')).not.toBeNull();
  });

  it.each([[844, 390], [1280, 800]])('switches portrait drills to the side at %ix%i and restores the peek on return', (w, h) => {
    const { container } = firstDrill();
    viewport(w, h);
    expect(container.querySelector('.lesson-live')!.getAttribute('data-coach')).toBe('rail');
    expect(container.querySelector<HTMLElement>('.coach-body')!.hidden).toBe(false);
    expect(screen.queryByRole('button', { name: /the coach card/ })).toBeNull();

    viewport(390, 844);
    expect(container.querySelector('.lesson-live')!.getAttribute('data-coach')).toBe('top');
    expect(screen.getByRole('button', { name: 'Expand the coach card' })).toBeTruthy();
    expect(playable(container)).toBeTruthy();
  });
});
