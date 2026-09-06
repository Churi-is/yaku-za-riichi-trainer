import { describe, expect, it } from 'vitest';
import { applyAction, nextHand } from '../index';
import type { GameState, SeatIndex } from '../types';
import { setupGame } from './loop';

const SEATS = [0, 1, 2, 3] as const;
const TENPAI = [
  '111m234m678m999mE', '111p234p678p999pS',
  '111s234s678s999sW', 'EEESSSWWWNNNP',
];
const NOTEN = [
  '111m234m678m99mEF', '111p234p678p99pSC',
  '111s234s678s99sWP', 'EEESSSWWWNNPF',
];

/** Last draw cannot complete any of the waiting hands; no live tiles remain. */
function drawPosition(tenpai: readonly number[], dealer: SeatIndex = 0, honba = 2): GameState {
  const state = setupGame({
    hands: SEATS.map((s) => tenpai.includes(s) ? TENPAI[s] : NOTEN[s]),
    dealer, honba, turn: 0, turnNumber: 8, phase: 'awaitingDiscard', drawn: '5m',
    riichiSticks: 2, points: [24000, 24000, 25000, 25000],
  });
  state.wall = [];
  return state;
}

function endDraw(state: GameState): GameState {
  return applyAction(state, { type: 'discard', seat: 0, tile: state.players[0].drawnTile! });
}

const pointsOnTable = (state: GameState) =>
  state.players.reduce((sum, p) => sum + p.points, state.riichiSticks * 1000);

describe('exhaustive-draw payments', () => {
  it.each([
    { tenpai: [], deltas: [0, 0, 0, 0] },
    { tenpai: [0], deltas: [3000, -1000, -1000, -1000] },
    { tenpai: [0, 1], deltas: [1500, 1500, -1500, -1500] },
    { tenpai: [0, 1, 2], deltas: [1000, 1000, 1000, -3000] },
    { tenpai: [0, 1, 2, 3], deltas: [0, 0, 0, 0] },
  ])('keeps the noten pool fixed with tenpai seats $tenpai', ({ tenpai, deltas }) => {
    for (const honba of [0, 2, 5]) {
      const before = drawPosition(tenpai, 0, honba);
      const ended = endDraw(before);
      expect(ended.handOver!.reason).toBe('exhaustiveDraw');
      expect(ended.handOver!.tenpaiSeats).toEqual(tenpai);
      expect(SEATS.map((s) => ended.handOver!.deltas[s])).toEqual(deltas);
      expect(ended.players.map((p, i) => p.points - before.players[i].points)).toEqual(deltas);
      expect(ended.riichiSticks).toBe(2);
      expect(pointsOnTable(ended)).toBe(100000);
      expect(before.handOver).toBeNull();
      expect(before.honba).toBe(honba);
    }
  });
});

describe('honba and dealer progression', () => {
  it.each([
    { tenpai: [0], dealer: 0 as const, nextDealer: 0 },
    { tenpai: [0], dealer: 1 as const, nextDealer: 2 },
    { tenpai: [], dealer: 1 as const, nextDealer: 2 },
    { tenpai: [0, 1, 2, 3], dealer: 1 as const, nextDealer: 1 },
  ])('increments after a draw: dealer $dealer, tenpai $tenpai', ({ tenpai, dealer, nextDealer }) => {
    const ended = endDraw(drawPosition(tenpai, dealer, 4));
    const next = nextHand(ended);
    expect(next.honba).toBe(5);
    expect(next.dealer).toBe(nextDealer);
    expect(next.roundNumber).toBe(ended.roundNumber + (dealer === nextDealer ? 0 : 1));
    expect(next.handNumber).toBe(ended.handNumber + 1);
    expect(next.riichiSticks).toBe(2);
    expect(pointsOnTable(next)).toBe(100000);
    expect(ended.honba).toBe(4); // advancing never mutates the previous state
    expect(nextHand(next)).toBe(next); // no double increment on an active hand
  });

  it('carries honba and riichi sticks across the East-to-South boundary', () => {
    const before = drawPosition([0], 3, 2);
    before.roundNumber = 4;
    const next = nextHand(endDraw(before));
    expect([next.roundWind, next.roundNumber, next.dealer, next.honba]).toEqual(['south', 1, 0, 3]);
    expect(next.riichiSticks).toBe(2);
    expect(next.matchOver).toBeNull();
  });

  it('continues the final hand when the dealer is tenpai', () => {
    const before = drawPosition([3], 3, 2);
    before.roundWind = 'south';
    before.roundNumber = 4;
    const next = nextHand(endDraw(before));
    expect([next.roundWind, next.roundNumber, next.dealer, next.honba]).toEqual(['south', 4, 3, 3]);
    expect(next.matchOver).toBeNull();
  });

  it('still ends the match after a final-hand draw with a noten dealer', () => {
    const before = drawPosition([0], 3, 2);
    before.roundWind = 'south';
    before.roundNumber = 4;
    const ended = endDraw(before);
    const next = nextHand(ended);
    expect(next.phase).toBe('matchOver');
    expect(next.matchOver!.finalPoints).toEqual(Object.fromEntries(ended.players.map((p) => [p.seat, p.points])));
    expect(next.matchOver!.handsPlayed).toBe(ended.handNumber);
    expect(pointsOnTable(next)).toBe(100000);
  });

  it.each(['tsumo', 'ron'] as const)('retains win payments and resets only after a non-dealer %s', (type) => {
    for (const dealer of [0, 1] as const) {
      const before = setupGame({
        hands: [
          '234m567m89m123p99p', '234m567m234p55p57s',
          '345m678m234p567p9s', '234m678m234p66s79p',
        ],
        dealer, turn: type === 'tsumo' ? 1 : 2, turnNumber: 8,
        phase: 'awaitingDiscard', drawn: '6s', dora: 'E', honba: 5,
        riichiSticks: 2, points: [24000, 24000, 25000, 25000],
      });
      const ready = type === 'ron'
        ? applyAction(before, { type: 'discard', seat: 2, tile: before.players[2].drawnTile! })
        : before;
      const ended = applyAction(ready, { type, seat: 1 });
      const result = ended.handOver!;
      expect(result.reason).toBe(type);
      for (const seat of SEATS) {
        const honbaDelta = seat === 1 ? 1500 : (type === 'tsumo' ? -500 : seat === 2 ? -1500 : 0);
        const sticks = seat === 1 ? 2000 : 0;
        expect(result.deltas[seat]).toBe(result.score!.payments[seat] + honbaDelta + sticks);
      }
      expect(ended.riichiSticks).toBe(0);
      expect(pointsOnTable(ended)).toBe(100000);
      const next = nextHand(ended);
      expect(next.honba).toBe(dealer === 1 ? 6 : 0);
      expect(next.dealer).toBe(1);
      expect(next.riichiSticks).toBe(0);
    }
  });
});
