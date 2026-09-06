import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPPONENTS, PERSONALITIES } from '@ai/personalities';
import { DEFAULT_SETTINGS } from '@engine/types';
import { assignOpponent, completeOpponents, normalizeOpponents } from '../opponents';
import { useSession } from '../session';
import { useMatch } from '../gameLoop';

afterEach(() => {
  useMatch.getState().reset();
  useSession.getState().setOpponents(DEFAULT_OPPONENTS);
  vi.useRealTimers();
});

describe('fixed opponent seats', () => {
  it('replaces exactly the chosen seat, with no rotation', () => {
    const original = ['kiryu', 'majima', 'date'];
    expect(assignOpponent(original, 2, 'saeko')).toEqual(['kiryu', 'saeko', 'date']);
    expect(original).toEqual(['kiryu', 'majima', 'date']);
  });

  it('swaps an already-seated character rather than duplicating or evicting one', () => {
    expect(assignOpponent(['kiryu', 'majima', 'date'], 3, 'kiryu')).toEqual(['date', 'majima', 'kiryu']);
    expect(assignOpponent(['kiryu', 'majima', 'date'], 1, 'kiryu')).toEqual(['kiryu', 'majima', 'date']);
  });

  it('moves into an empty seat without shifting the remaining opponent', () => {
    expect(assignOpponent([null, 'majima', 'date'], 1, 'date')).toEqual(['date', 'majima', null]);
  });

  it('normalizes holes, invalid ids and duplicates in place', () => {
    expect(normalizeOpponents(['kiryu', 'unknown', 'majima'])).toEqual(['kiryu', null, 'majima']);
    expect(normalizeOpponents(['kiryu', 'kiryu', 'date', 'majima'])).toEqual(['kiryu', null, 'date']);
    expect(normalizeOpponents([])).toEqual([null, null, null]);
    expect(assignOpponent(DEFAULT_OPPONENTS, 1, 'invalid')).toEqual(DEFAULT_OPPONENTS);
  });

  it('clears only the targeted store slot and does not mutate the default table', () => {
    useSession.getState().clearOpponent(2);
    expect(useSession.getState().opponents).toEqual(['ichiban', null, 'date']);
    expect(DEFAULT_OPPONENTS).toEqual(['ichiban', 'kiryu', 'date']);
    useSession.getState().seatOpponent(2, 'majima');
    expect(useSession.getState().opponents).toEqual(['ichiban', 'majima', 'date']);
  });

  it('fills invalid match-start slots without displacing good assignments', () => {
    const completed = completeOpponents(['saejima', 'bad-id', 'majima']);
    expect(completed[0]).toBe('saejima');
    expect(completed[2]).toBe('majima');
    expect(new Set(completed).size).toBe(3);
    expect(completed.every((id) => PERSONALITIES.some((p) => p.id === id))).toBe(true);
  });
});

describe('seat and level wiring into a match', () => {
  it('uses native levels and exact physical seats by default', () => {
    vi.useFakeTimers();
    useMatch.getState().start(DEFAULT_SETTINGS, 42, ['date', 'akiyama', 'majima']);
    const { seatPersonalities, state } = useMatch.getState();
    expect(seatPersonalities.map((p) => [p.seat, p.id, p.difficulty])).toEqual([
      [1, 'date', 'easy'], [2, 'akiyama', 'normal'], [3, 'majima', 'hard'],
    ]);
    expect(state!.players.slice(1).map((p) => p.aiPersonalityId)).toEqual(['date', 'akiyama', 'majima']);
    expect(state!.players[0].aiPersonalityId).toBeNull();
  });

  it('applies an explicit uniform practice level without changing seats', () => {
    vi.useFakeTimers();
    useMatch.getState().start({ ...DEFAULT_SETTINGS, opponentDifficulty: 'uniform', difficulty: 'easy' }, 42, ['date', 'akiyama', 'majima']);
    expect(useMatch.getState().seatPersonalities.map((p) => p.difficulty)).toEqual(['easy', 'easy', 'easy']);
    expect(useMatch.getState().seatPersonalities.map((p) => p.id)).toEqual(['date', 'akiyama', 'majima']);
  });

  it('never compacts a bad middle slot into the left seat', () => {
    vi.useFakeTimers();
    useMatch.getState().start(DEFAULT_SETTINGS, 42, ['saejima', 'unknown', 'majima']);
    const seated = useMatch.getState().seatPersonalities;
    expect(seated[0].id).toBe('saejima');
    expect(seated[2].id).toBe('majima');
    expect(new Set(seated.map((p) => p.id)).size).toBe(3);
  });
});
