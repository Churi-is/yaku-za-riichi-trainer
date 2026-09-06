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

/**
 * Start a match and dismiss the intro card: the pump is gated on intro
 * dismissal so "Deal" really starts play, and tests exercise the live game.
 */
async function startAndDeal(seed: number) {
  useMatch.getState().start(DEFAULT_SETTINGS, seed);
  useMatch.getState().dismissIntro();
  await advance(10);
}

describe('game loop flow', () => {
  it('hands the human their first discard instead of stalling on Waiting', async () => {
    vi.useFakeTimers();
    await startAndDeal(42); // let the pump draw for the dealer

    const st = useMatch.getState();
    expect(st.view).not.toBeNull();
    expect(st.humanLegal.some((l) => l.action.type === 'discard')).toBe(true);
  });

  it('continues after the human discards: rivers grow and turns rotate', async () => {
    vi.useFakeTimers();
    await startAndDeal(7);
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

  it('freezes the table while paused and resumes after unpausing', async () => {
    vi.useFakeTimers();
    await startAndDeal(99);
    // The human (dealer) discards first so the AI has turns to take.
    const first = useMatch.getState().humanLegal.find((l) => l.action.type === 'discard');
    useMatch.getState().humanAct(first!.action);
    await advance(2000); // at least one AI discard lands
    const discardsNow = () => ([0, 1, 2, 3] as const)
      .reduce((n: number, s) => n + useMatch.getState().view!.seats[s].river.length, 0);
    const beforePause = discardsNow();
    expect(beforePause).toBeGreaterThanOrEqual(2); // human + at least one AI

    // Open the pause menu mid-AI-turn.
    useMatch.getState().setPaused(true);
    const frozenAt = discardsNow();
    await advance(20000); // lots of AI time behind the modal: nothing may move
    expect(discardsNow()).toBe(frozenAt);
    expect(useMatch.getState().aiThinking).toBe(false);

    // Resume: play picks back up and the river grows again.
    useMatch.getState().setPaused(false);
    // If it is the human's turn, play through it so the AI gets to act.
    for (let i = 0; i < 30; i++) {
      await advance(2000);
      const st = useMatch.getState();
      if (st.handEnd || st.matchResult) break;
      const d = st.humanLegal.find((l) => l.action.type === 'discard');
      if (d) st.humanAct(d.action);
    }
    const after = useMatch.getState();
    const moved = discardsNow() > frozenAt || after.handEnd !== null;
    expect(moved).toBe(true);
    void beforePause;
  });

  it('holds the pump until the intro is dismissed', async () => {
    vi.useFakeTimers();
    useMatch.getState().start(DEFAULT_SETTINGS, 5);
    await advance(10000); // plenty of AI time, but no Deal yet
    const st = useMatch.getState();
    expect(st.introDismissed).toBe(false);
    // The dealer is the human on hand 1, so nothing discards behind the intro.
    expect(st.view!.seats[1].river.length).toBe(0);
    expect(st.view!.seats[2].river.length).toBe(0);
    expect(st.view!.seats[3].river.length).toBe(0);
    st.dismissIntro();
    await advance(10);
    expect(useMatch.getState().humanLegal.some((l) => l.action.type === 'discard')).toBe(true);
  });

  it('survives a full hand without dead-ending (no exception, phase progresses)', async () => {
    vi.useFakeTimers();
    await startAndDeal(1234);
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
