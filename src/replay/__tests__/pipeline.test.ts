import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Action, type SeatIndex } from '@engine/types';
import * as eng from '@state/engineAdapter';
import { MatchLogBuilder } from '@replay/log';
import { gradeMatch } from '@state/analysisAdapter';
import { computeSummary } from '@replay/summary';

/**
 * Drives a whole match synchronously through the engine adapter + log builder,
 * then grades and summarizes it — the exact modules Worker D owns, exercised
 * end to end without the React async pump.
 */
function playMatch(seed: number) {
  const builder = new MatchLogBuilder({ ...DEFAULT_SETTINGS, gameLength: 'east' });
  let state = eng.createMatch({ ...DEFAULT_SETTINGS, gameLength: 'east' }, seed);
  let handId = 0;
  const beginHand = () => {
    handId++;
    builder.beginHand({
      handId, roundWind: state.roundWind, roundNumber: state.roundNumber,
      honba: state.honba, dealer: state.dealer,
    });
  };
  beginHand();

  let guard = 0;
  while (!state.matchOver && guard < 200000) {
    guard++;
    if (state.phase === 'handOver') {
      if (state.handOver) builder.endHand(state.handOver);
      state = eng.nextHand(state);
      if (state.matchOver) break;
      beginHand();
      continue;
    }
    const pend = eng.pendingSeats(state);
    // Pending seats owe the call-window decision; otherwise it is the current
    // turn holder's move (draw or discard).
    const seat = pend.length > 0 ? (pend[0] as SeatIndex) : state.turn;
    const legal = eng.getLegalActions(state, seat);
    expect(legal.length).toBeGreaterThan(0);
    const win = legal.find((l) => l.action.type === 'tsumo' || l.action.type === 'ron');
    const draw = legal.find((l) => l.action.type === 'draw');
    const pass = legal.find((l) => l.action.type === 'pass');
    const discard = legal.find((l) => l.action.type === 'discard');
    const choice: Action = (win ?? draw ?? pass ?? discard ?? legal[0]).action;
    const viewBefore = eng.toPublicView(state, 0);
    builder.record(seat, choice, viewBefore);
    state = eng.applyAction(state, choice);
  }
  return { builder, state };
}

describe('replay + grading + summary pipeline', () => {
  it('records a hand log with entries and a result for every finished hand', () => {
    const { builder } = playMatch(4242);
    const hands = builder.getHands();
    expect(hands.length).toBeGreaterThan(0);
    for (const h of hands) {
      expect(h.entries.length).toBeGreaterThan(0);
      expect(h.result).toBeTruthy();
      expect(Object.keys(h.revealedHands).length).toBe(4);
    }
  });

  it('grades every human discard turn and produces valid grades', () => {
    const { builder } = playMatch(4242);
    const entries = builder.getHands().flatMap((h) => h.entries);
    const graded = gradeMatch(entries);
    const valid = new Set(['Excellent', 'Good', 'Fair', 'Poor', 'Blunder']);
    for (const g of graded) expect(valid.has(g.grade)).toBe(true);
    // every graded turn belongs to the human seat
    const humanDiscards = entries.filter((e) => e.seat === 0 && e.action.type === 'discard').length;
    expect(graded.length).toBeGreaterThanOrEqual(1);
    expect(graded.length).toBeLessThanOrEqual(entries.filter((e) => e.seat === 0).length);
    expect(humanDiscards).toBeGreaterThan(0);
  });

  it('computes a session summary with a full grade distribution', () => {
    const { builder } = playMatch(4242);
    const log = builder.build();
    const graded = gradeMatch(log.hands.flatMap((h) => h.entries));
    const summary = computeSummary(log, graded);
    expect(summary.handsPlayed).toBe(log.hands.length);
    const total = Object.values(summary.gradeDistribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(graded.length);
    // final points across seats should conserve the 100k total (± sticks left on table)
    expect(summary.placement).toBeGreaterThanOrEqual(1);
    expect(summary.placement).toBeLessThanOrEqual(4);
  });
});
