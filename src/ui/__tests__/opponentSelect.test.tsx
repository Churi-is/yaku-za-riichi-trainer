import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPPONENTS, SPECIAL_PERSONALITIES, personalityById } from '@ai/personalities';
import { DEFAULT_SETTINGS } from '@engine/types';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import App from '../App';
import { OPPONENT_DRAG_TYPE } from '../components/OpponentTable';

beforeEach(() => useSession.setState({
  screen: 'opponents', opponents: [...DEFAULT_OPPONENTS], settings: { ...DEFAULT_SETTINGS },
}));
afterEach(() => {
  cleanup();
  useMatch.getState().reset();
  useSession.setState({ screen: 'menu', opponents: [...DEFAULT_OPPONENTS], settings: { ...DEFAULT_SETTINGS } });
  vi.useRealTimers();
});

const tableSeat = (label: string) => within(screen.getByRole('group', { name: 'Table seats' }))
  .getByRole('button', { name: new RegExp(`Edit ${label} seat`) });
const roster = () => screen.getByRole('region', { name: 'Character roster' });
const card = (name: string) => within(roster()).getByRole('button', { name: new RegExp(`^${name} —`) });

describe('opponent table editor', () => {
  it('shows 22 Yakuza characters and the fixed human seat', () => {
    render(<App />);
    expect(document.querySelectorAll('.roster-card')).toHaveLength(22);
    expect(screen.getByText('Fixed seat')).toBeTruthy();
    expect(card('Kazuma Kiryu')).toBeTruthy();
    expect(card('Goro Majima')).toBeTruthy();
    expect(tableSeat('Right').getAttribute('aria-pressed')).toBe('true');
  });

  it('replaces only the selected seat and does not automatically advance', () => {
    render(<App />);
    fireEvent.click(tableSeat('Left'));
    fireEvent.click(card('Goro Majima'));
    expect(useSession.getState().opponents).toEqual(['ichiban', 'kiryu', 'majima']);
    fireEvent.click(card('Taiga Saejima'));
    expect(useSession.getState().opponents).toEqual(['ichiban', 'kiryu', 'saejima']);
    expect(tableSeat('Left').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Placed Taiga Saejima at Left');
  });

  it('swaps occupied seats, with both names still present', () => {
    render(<App />);
    fireEvent.click(tableSeat('Across'));
    fireEvent.click(card('Ichiban Kasuga'));
    expect(useSession.getState().opponents).toEqual(['kiryu', 'ichiban', 'date']);
    expect(screen.getByRole('status').textContent).toContain('Swapped');
    // Clicking the character already in this seat is not a hidden remove action.
    fireEvent.click(card('Ichiban Kasuga'));
    expect(useSession.getState().opponents).toEqual(['kiryu', 'ichiban', 'date']);
  });

  it('leaves a cleared hole in place and disables continuing until filled', () => {
    render(<App />);
    fireEvent.click(tableSeat('Across'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Across seat' }));
    expect(useSession.getState().opponents).toEqual(['ichiban', null, 'date']);
    expect((screen.getByRole('button', { name: /Fill all three seats/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(card('Osamu Kashiwagi'));
    expect(useSession.getState().opponents).toEqual(['ichiban', 'kashiwagi', 'date']);
    expect((screen.getByRole('button', { name: /Table settings/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('supports direct drag-to-seat with the same swap semantics', () => {
    render(<App />);
    const data = new Map<string, string>();
    const dataTransfer = {
      types: [OPPONENT_DRAG_TYPE],
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key) ?? '',
      effectAllowed: '', dropEffect: '',
    };
    fireEvent.dragStart(card('Kazuma Kiryu'), { dataTransfer });
    fireEvent.dragOver(tableSeat('Left'), { dataTransfer });
    fireEvent.drop(tableSeat('Left'), { dataTransfer });
    expect(useSession.getState().opponents).toEqual(['ichiban', 'date', 'kiryu']);
    data.set(OPPONENT_DRAG_TYPE, 'invalid');
    fireEvent.drop(tableSeat('Across'), { dataTransfer });
    expect(useSession.getState().opponents).toEqual(['ichiban', 'date', 'kiryu']);
  });

  it('filters and searches without changing anyone already seated', () => {
    render(<App />);
    const filters = screen.getByRole('group', { name: 'Difficulty filter' });
    fireEvent.click(within(filters).getByRole('button', { name: /Hard/ }));
    expect(document.querySelectorAll('.roster-card')).toHaveLength(6);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a character' }), { target: { value: 'majima' } });
    expect(document.querySelectorAll('.roster-card')).toHaveLength(1);
    expect(card('Goro Majima')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not a character' } });
    expect(screen.getByText('No characters found')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show everyone' }));
    expect(document.querySelectorAll('.roster-card')).toHaveLength(22);
    expect(useSession.getState().opponents).toEqual(DEFAULT_OPPONENTS);
  });

  it('makes mixed/easy/hard quick tables and can restore the default layout', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Quick tables & seating tips'));
    for (const [preset, level] of [['Easy-going', 'Easy'], ['Boss table', 'Hard']] as const) {
      fireEvent.click(screen.getByRole('button', { name: preset }));
      const table = screen.getByRole('group', { name: 'Table seats' });
      expect(within(table).getAllByText(level)).toHaveLength(3);
      expect(new Set(useSession.getState().opponents).size).toBe(3);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Mixed table' }));
    const table = screen.getByRole('group', { name: 'Table seats' });
    for (const level of ['Easy', 'Medium', 'Hard']) expect(within(table).getByText(level)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore default table' }));
    expect(useSession.getState().opponents).toEqual(DEFAULT_OPPONENTS);
  });

  it('labels all four Specials separately and puts their estimated strength in the descriptions', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Difficulty filter' })).getByRole('button', { name: /Special/ }));
    expect(document.querySelectorAll('.roster-card')).toHaveLength(4);
    expect(screen.getByText('Different rules. Not a harder tier.')).toBeTruthy();
    for (const p of SPECIAL_PERSONALITIES) {
      expect(within(card(p.name)).getByText('Special')).toBeTruthy();
      expect(within(card(p.name)).getByText(`Estimated difficulty: ${p.special!.estimatedDifficulty}`)).toBeTruthy();
    }
    fireEvent.click(card('Nugget'));
    expect(tableSeat('Right').textContent).toContain('Special');
    expect(tableSeat('Right').textContent).not.toContain('Easy');
    fireEvent.click(within(screen.getByRole('group', { name: 'Difficulty filter' })).getByRole('button', { name: /Easy/ }));
    expect(document.querySelectorAll('.roster-card')).toHaveLength(6);
    expect(within(roster()).queryByRole('button', { name: /^Nugget —/ })).toBeNull();
    expect(useSession.getState().opponents[0]).toBe('nugget');
  });

  it('only seats Special opponents through explicit selection or the Special preset', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Quick tables & seating tips'));
    for (const name of ['Easy-going', 'Mixed table', 'Boss table']) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(useSession.getState().opponents.every((id) => !personalityById(id!).special)).toBe(true);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Special table' }));
    expect(new Set(useSession.getState().opponents).size).toBe(3);
    expect(useSession.getState().opponents.every((id) => personalityById(id!).special)).toBe(true);
  });

  it('keeps the Special category and estimate in settings and match introductions', () => {
    vi.useFakeTimers();
    useSession.setState({ opponents: ['nugget', 'komaki', 'pocket-fighter'] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Table settings/ }));
    expect(screen.getAllByText('Special')).toHaveLength(3);
    expect(screen.getByText(/Estimated difficulty: Very easy/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Same for all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(screen.getAllByText('Special')).toHaveLength(3);
    act(() => fireEvent.click(screen.getByRole('button', { name: /Start Match/ })));
    expect(document.querySelectorAll('.intro-seat .level-special')).toHaveLength(3);
    expect(screen.getByText(/Estimated difficulty: Very easy/)).toBeTruthy();
    expect(useMatch.getState().seatPersonalities.map((p) => p.special?.style)).toEqual(['selfSabotage', 'ronOnly', 'gearShift']);
  });

  it('preserves placement through settings/back and starts at the chosen levels', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(tableSeat('Left'));
    fireEvent.click(card('Goro Majima'));
    fireEvent.click(screen.getByRole('button', { name: /Table settings/ }));
    expect(screen.getByText('Levels: By character')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Same for all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(screen.getByText('Levels: All Easy')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /← Opponents/ }));
    expect(useSession.getState().opponents).toEqual(['ichiban', 'kiryu', 'majima']);
    expect(tableSeat('Left').textContent).toContain('Majima');
    fireEvent.click(screen.getByRole('button', { name: /Table settings/ }));
    act(() => fireEvent.click(screen.getByRole('button', { name: /Start Match/ })));
    expect(useMatch.getState().seatPersonalities.map((p) => [p.id, p.difficulty])).toEqual([
      ['ichiban', 'easy'], ['kiryu', 'easy'], ['majima', 'easy'],
    ]);
  });
});
