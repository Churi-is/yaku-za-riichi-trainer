import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type SeatIndex } from '@engine/types';
import * as eng from '../index';

describe('engine — match smoke tests', () => {
  it('creates a match with four 13-tile hands and a dora indicator', () => {
    const s = eng.createMatch({ ...DEFAULT_SETTINGS }, 12345);
    expect(s.players).toHaveLength(4);
    for (const p of s.players) expect(p.hand.length).toBe(13);
    expect(s.doraIndicators.length).toBeGreaterThan(0);
    expect(s.phase).toBe('awaitingDiscard');
  });

  it('public view never exposes another seat concealed tiles', () => {
    const s = eng.createMatch({ ...DEFAULT_SETTINGS }, 7);
    const pv = eng.toPublicView(s, 0);
    expect(pv.hand.length).toBe(13);
    for (let seat = 1 as SeatIndex; seat < 4; seat = (seat + 1) as SeatIndex) {
      const sv = pv.seats[seat];
      // concealedCount only, no tile ids
      expect(sv.concealedCount).toBe(13);
      expect((sv as unknown as { hand?: unknown }).hand).toBeUndefined();
    }
  });

  it('can play a whole match to matchOver without throwing', () => {
    let s = eng.createMatch({ ...DEFAULT_SETTINGS, gameLength: 'east' }, 999);
    let guard = 0;
    while (!s.matchOver && guard < 100000) {
      guard++;
      if (s.phase === 'handOver') { s = eng.nextHand(s); continue; }
      const pend = eng.pendingSeats(s);
      // Pending seats owe the call-window decision; otherwise it is the
      // current turn holder's move (draw or discard).
      const seat = pend.length > 0 ? pend[0] : s.turn;
      const legal = eng.getLegalActions(s, seat);
      expect(legal.length).toBeGreaterThan(0);
      // prefer a non-win, non-riichi discard/draw/pass to keep hands going,
      // but take wins when offered to exercise scoring
      const win = legal.find((l) => l.action.type === 'tsumo' || l.action.type === 'ron');
      const pass = legal.find((l) => l.action.type === 'pass');
      const draw = legal.find((l) => l.action.type === 'draw');
      const plainDiscard = legal.find((l) => l.action.type === 'discard' && !('riichi' in l.action && l.action.riichi));
      const choice = win ?? draw ?? pass ?? plainDiscard ?? legal[0];
      s = eng.applyAction(s, choice.action);
    }
    expect(s.matchOver).not.toBeNull();
    expect(s.matchOver!.ranking.length).toBe(4);
  });
});
