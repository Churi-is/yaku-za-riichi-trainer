/**
 * Regression coverage for the UI/UX audit fixes: furiten indication, rematch,
 * quit confirmation, and the pause menu actually freezing the table.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, cleanup, fireEvent, screen } from '@testing-library/react';
import App from '@ui/App';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import { createMatch, toPublicView } from '@state/engineAdapter';
import { DEFAULT_SETTINGS } from '@engine/types';
import type { GameState } from '@engine/types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useMatch.getState().reset();
  useSession.setState({ screen: 'menu' });
});

/** Drive the app to a live, dealt-in match with the human about to discard. */
async function startMatch() {
  vi.useFakeTimers();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /Play a Match/i }));
  fireEvent.click(screen.getByRole('button', { name: /Table settings/i }));
  act(() => { fireEvent.click(screen.getByRole('button', { name: /Start Match/i })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: /Deal/i })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
}

/** Flush the async pump (its delays are awaited promises). */
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('pause really pauses', () => {
  it('stops AI turns while the pause menu is open', async () => {
    await startMatch();
    // Make the human's first discard to get the AI moving.
    const st0 = useMatch.getState();
    const discard = st0.humanLegal.find((l) => l.action.type === 'discard')!;
    act(() => { useMatch.getState().humanAct(discard.action); });
    await tick(1500);

    const before = useMatch.getState();
    const rivers = () => ([0, 1, 2, 3] as const)
      .reduce((n: number, s) => n + useMatch.getState().view!.seats[s].river.length, 0);
    const frozen = rivers();
    expect(frozen).toBeGreaterThan(0);

    // Open pause mid-AI-turn.
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Pause menu/i })); });
    expect(screen.getByText('Paused')).toBeTruthy();
    await tick(15000);
    expect(rivers()).toBe(frozen);

    // Resume → play moves again.
    act(() => { fireEvent.click(screen.getAllByRole('button', { name: /Resume/i })[0]); });
    for (let i = 0; i < 30; i++) {
      await tick(1500);
      const st = useMatch.getState();
      if (st.handEnd) break;
      const d = st.humanLegal.find((l) => l.action.type === 'discard');
      if (d) act(() => { st.humanAct(d.action); });
    }
    expect(rivers() > frozen || useMatch.getState().handEnd !== null).toBe(true);
    void before;
  });

  it('asks before abandoning a match', async () => {
    await startMatch();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Pause menu/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Quit to menu/i })); });
    // Confirmation step, not immediate exit.
    expect(screen.getByText(/Abandon this match/i)).toBeTruthy();
    expect(useSession.getState().screen).toBe('match');
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Keep playing/i })); });
    expect(screen.queryByText(/Abandon this match/i)).toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Pause menu/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Quit to menu/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Abandon match/i })); });
    expect(useSession.getState().screen).toBe('menu');
  });
});

describe('furiten indication', () => {
  it('surfaces the viewer furiten flag in the public view', () => {
    const state0 = createMatch(DEFAULT_SETTINGS, 7) as GameState;
    expect(state0).toBeTruthy();
    // Engine-agnostic: the view carries the flag even when false.
    const view = toPublicView(state0, 0);
    expect(typeof view.furiten).toBe('boolean');
    expect(view.furiten).toBe(false);
    // Forge furiten on the human and re-read (the flag flows from the seat's
    // own furiten state — permanent, temporary, or riichi).
    const furitenState: GameState = JSON.parse(JSON.stringify(state0));
    furitenState.players[0].temporaryFuriten = true;
    expect(toPublicView(furitenState, 0).furiten).toBe(true);
  });

  it('shows the furiten chip in the call bar when the human is furiten', async () => {
    await startMatch();
    expect(screen.queryByText(/Furiten — ron blocked/i)).toBeNull();
    act(() => {
      useMatch.setState({ view: { ...useMatch.getState().view!, furiten: true } });
    });
    // Chip appears only once there are legal actions and furiten is set.
    expect(screen.queryByText(/Furiten/i)).not.toBeNull();
  });
});

describe('match complete', () => {
  it('offers a rematch that restarts the same table', async () => {
    await startMatch();
    const { ranking, finalPoints } = {
      ranking: [2, 0, 1, 3] as const,
      finalPoints: { 0: 31000, 1: 24000, 2: 41000, 3: 4000 },
    };
    act(() => {
      useMatch.setState({
        handEnd: null,
        matchResult: {
          ranking: [...ranking],
          finalPoints,
          handsPlayed: 8,
        },
      });
    });
    expect(screen.getAllByText('Match complete').length).toBeGreaterThanOrEqual(1);
    // Full standings are shown (all four seats), winner named.
    expect(screen.getAllByText(/You finished 2nd/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText(/Final standings/i)).toHaveLength(1);
    expect(screen.getByText(/takes the win/i)).toBeTruthy();
    expect(screen.getByText(/8 hands played/)).toBeTruthy();

    // Rematch restarts a fresh match straight away.
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Rematch/i })); });
    const st = useMatch.getState();
    expect(st.state).not.toBeNull();
    expect(st.matchResult).toBeNull();
    expect(st.introDismissed).toBe(false);
    expect(screen.getByRole('button', { name: /Deal/i })).toBeTruthy();
  });
});
