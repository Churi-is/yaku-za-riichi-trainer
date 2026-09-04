/**
 * Game loop regression: a match must actually flow. `pendingSeats` only reports
 * seats during call windows, so the pump has to hand draw/discard turns to
 * `state.turn` itself — otherwise the table stalls on the first discard.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@engine/types';
import { useMatch } from '@state/gameLoop';

afterEach(() => {
  vi.useRealTimers();
  useMatch.getState().reset();
});

/* async so the pump's awaited delays interleave with microtask flushes */
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('game loop flow', () => {
  it('hands the human their first discard instead of stalling on Waiting', async () => {
    vi.useFakeTimers();
    useMatch.getState().start(DEFAULT_SETTINGS, 42);
    await advance(10); // let the pump draw for the dealer

    const st = useMatch.getState();
    expect(st.view).not.toBeNull();
    expect(st.humanLegal.some((l) => l.action.type === 'discard')).toBe(true);
  });

  it('continues after the human discards: rivers grow and turns rotate', async () => {
    vi.useFakeTimers();
    useMatch.getState().start(DEFAULT_SETTINGS, 7);
    await advance(10);
    let st = useMatch.getState();
    const discard = st.humanLegal.find((l) => l.action.type === 'discard');
    expect(discard).toBeTruthy();

    useMatch.getState().humanAct(discard!.action);
    await advance(6000); // several AI turns

    st = useMatch.getState();
    expect(st.view!.seats[0].river.length).toBe(1);
    const aiDiscards = st.view!.seats[1].river.length
      + st.view!.seats[2].river.length
      + st.view!.seats[3].river.length;
    expect(aiDiscards).toBeGreaterThan(0);
    // either the human is asked again or play is still moving
    const stillFlowing = st.humanLegal.length > 0
      || st.handEnd !== null
      || st.view!.seats[0].river.length < st.view!.tilesRemaining;
    expect(stillFlowing).toBe(true);
  });

  it('survives a full hand without dead-ending (no exception, phase progresses)', async () => {
    vi.useFakeTimers();
    useMatch.getState().start(DEFAULT_SETTINGS, 1234);
    // play greedily: always take the first legal action offered to the human
    for (let i = 0; i < 400; i++) {
      await advance(900);
      const st = useMatch.getState();
      if (st.handEnd || st.matchResult) break;
      if (st.humanLegal.length > 0) {
        const pref = st.humanLegal.find((l) => l.action.type === 'discard')
          ?? st.humanLegal.find((l) => l.action.type === 'pass')
          ?? st.humanLegal[0];
        useMatch.getState().humanAct(pref.action);
      }
    }
    const st = useMatch.getState();
    // the hand ended (win/draw) or play reached a later turn — never stuck at turn 1
    const totalDiscards = ([0, 1, 2, 3] as const)
      .reduce((n: number, s) => n + (st.view?.seats[s].river.length ?? 0), 0);
    expect(st.handEnd !== null || totalDiscards > 4).toBe(true);
    if (st.handEnd) {
      useMatch.getState().advanceHand();
      expect(useMatch.getState().handEnd).toBeNull();
    }
  });
});
