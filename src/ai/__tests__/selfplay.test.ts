import { describe, expect, it, vi } from 'vitest';
import { applyAction, createMatch, DEFAULT_SETTINGS } from '@engine/index';
import { setupGame } from '@engine/__tests__/loop';
import { ARCHETYPE_SAMPLE, createAI, type AIPlayer } from '../index';
import { playHand, playHands, playMatch } from './selfplay';

const SETTINGS = { ...DEFAULT_SETTINGS, gameLength: 'east' as const };

const policy: AIPlayer['decide'] = (view, legal) => ({
  action: (legal.find((l) => l.action.type === 'tsumo' || l.action.type === 'ron')
    ?? legal.find((l) => l.action.type === 'pass')
    ?? legal.find((l) => l.action.type === 'discard' && !l.action.riichi && l.action.tile === view.drawnTile)
    ?? legal[0]).action,
});
const table = (decide: AIPlayer['decide'] = policy) => Array.from({ length: 4 }, () => ({ decide }));

describe('strict real-engine self-play driver', () => {
  it('supplies only public views and skips automatic draws when asking AIs', () => {
    const decide = vi.fn(policy);
    const initial = createMatch(SETTINGS, 7);
    const snapshot = structuredClone(initial);
    const played = playHand(table(decide), initial);
    expect(initial).toEqual(snapshot);
    expect(played.state.phase).toBe('handOver');
    expect(played.result).toBe(played.state.handOver);
    expect(decide).toHaveBeenCalledTimes(played.actions.filter((a) => a.type !== 'draw').length);
    for (const [view, legal] of decide.mock.calls) {
      expect(view).not.toHaveProperty('players');
      expect(view).not.toHaveProperty('wall');
      expect(view).not.toHaveProperty('deadWall');
      expect(view).not.toHaveProperty('uraIndicators');
      expect(view.phase).not.toBe('awaitingDraw');
      expect(legal.every((l) => l.action.seat === view.viewer)).toBe(true);
      for (const seat of Object.values(view.seats)) {
        expect(seat).not.toHaveProperty('hand');
        expect(seat).not.toHaveProperty('drawnTile');
      }
    }
    // The trace is complete: replaying only engine actions reproduces the result.
    const replayed = played.actions.reduce((state, action) => applyAction(state, action), initial);
    expect(replayed).toEqual(played.state);
  });

  it('uses real scoring and honba, not flat simulated win payments', () => {
    const initial = setupGame({
      hands: [
        '234m567m89m123p99p', '234m567m234p55p57s',
        '345m678m234p567p9s', '234m678m234p66s79p',
      ],
      dealer: 0, turn: 1, turnNumber: 8, phase: 'awaitingDiscard',
      drawn: '6s', dora: 'E', honba: 2,
    });
    const played = playHand(table(), initial);
    expect(played.actions).toEqual([{ type: 'tsumo', seat: 1 }]);
    expect(played.result.score!.points).toBe(2000);
    expect(played.result.deltas).toEqual({ 0: -1200, 1: 2600, 2: -700, 3: -700 });
    expect(played.state.players.map((p, i) => p.points - initial.players[i].points)).toEqual([-1200, 2600, -700, -700]);
  });

  it.each(['tile', 'seat'] as const)('rejects an invalid action %s without recovering', (invalid) => {
    const decide = vi.fn<AIPlayer['decide']>((view, legal) => ({
      action: invalid === 'tile'
        ? { type: 'discard', seat: view.viewer, tile: 999 }
        : { ...legal[0].action, seat: 1 },
    }));
    expect(() => playHand(table(decide), createMatch(SETTINGS, 1))).toThrow(/Illegal AI action/);
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it('propagates AI exceptions instead of substituting a legal move', () => {
    const error = new Error('deliberate AI failure');
    const decide = vi.fn(() => { throw error; });
    expect(() => playHand(table(decide), createMatch(SETTINGS, 1))).toThrow(error);
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it('rejects stalls and action-budget exhaustion instead of counting unfinished hands', () => {
    const initial = createMatch(SETTINGS, 1);
    expect(() => playHand(table(), { ...initial, phase: 'dealing' })).toThrow(/Self-play stalled/);
    expect(() => playHand(table(), initial, 1)).toThrow(/did not finish within 1 actions/);
  });

  it('requires an active hand and exactly four players', () => {
    const initial = createMatch(SETTINGS, 1);
    expect(() => playHand(table().slice(1), initial)).toThrow(/exactly four/);
    const ended = playHand(table(), initial).state;
    expect(() => playHand(table(), ended)).toThrow(/active hand/);
  });

  it('tallies actual moves, wins, deposits, and score changes', () => {
    const bots = () => [0, 1, 2, 3].map((s) => createAI(ARCHETYPE_SAMPLE[1], 'normal', 100 + s));
    const initial = createMatch(SETTINGS, 800);
    const { state, result, actions } = playHand(bots(), initial);
    const sample = playHands(bots(), 800, 1);
    expect(sample.handsPlayed).toBe(1);
    expect(sample.perSeat.reduce((n, s) => n + s.calls, 0)).toBeGreaterThan(0);
    expect(sample.perSeat.reduce((n, s) => n + s.riichi, 0)).toBeGreaterThan(0);
    expect(result.reason).toBe('ron');
    for (const [seat, stats] of sample.perSeat.entries()) {
      const moves = actions.filter((a) => a.seat === seat);
      expect(stats.decisions).toBe(moves.filter((a) => a.type !== 'draw').length);
      expect(stats.calls).toBe(moves.filter((a) => ['chi', 'pon', 'minkan'].includes(a.type)).length);
      expect(stats.riichi).toBe(moves.filter((a) => a.type === 'discard' && a.riichi).length);
      expect(stats.ronWins).toBe(Number(result.reason === 'ron' && result.winner === seat));
      expect(stats.tsumoWins).toBe(Number(result.reason === 'tsumo' && result.winner === seat));
      expect(stats.dealIn).toBe(Number(result.loser === seat));
      expect(stats.pointsDelta).toBe(state.players[seat].points - initial.players[seat].points);
    }
  });

  it('only returns a match result after the engine reaches matchOver', () => {
    const a = playMatch(table(), 19);
    const b = playMatch(table(), 19);
    expect(a).toEqual(b);
    expect(a.handsPlayed).toBeGreaterThanOrEqual(4);
    expect([...a.ranking].sort()).toEqual([0, 1, 2, 3]);
    expect(Object.keys(a.finalPoints)).toHaveLength(4);
    expect(() => playMatch(table(), 19, SETTINGS, 1)).toThrow(/match did not finish within 1 hands/);
  });

  it('rejects invalid sample sizes and treats zero hands as an empty sample', () => {
    for (const count of [-1, 0.5, Infinity, NaN]) {
      expect(() => playHands(table(), 1, count)).toThrow(/Invalid self-play hand count/);
    }
    const empty = playHands(table(), 1, 0);
    expect(empty.handsPlayed).toBe(0);
    expect(empty.perSeat.every((s) => Object.values(s).every((n) => n === 0))).toBe(true);
  });
});
