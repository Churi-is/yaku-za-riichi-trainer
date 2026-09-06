/**
 * Test-only self-play driver. The production engine owns every rule, legal
 * action, public view, and payment; this module only advances play and tallies
 * results. Bad AI decisions, engine errors, and unfinished runs fail loudly.
 */
import { isDeepStrictEqual } from 'node:util';
import {
  applyAction, createMatch, DEFAULT_SETTINGS, getLegalActions, nextHand,
  pendingSeats, toPublicView,
} from '@engine/index';
import type { Action, GameState, SeatIndex, TableSettings } from '@engine/types';
import type { AIPlayer } from '../types';

type Players = readonly Pick<AIPlayer, 'decide'>[];
const SEATS = [0, 1, 2, 3] as const;
const SETTINGS: TableSettings = { ...DEFAULT_SETTINGS, gameLength: 'east' };

/** Complete one active hand. The trace includes forced draws, but only AIs choose moves. */
export function playHand(ais: Players, initial: GameState, maxActions = 600) {
  if (ais.length !== 4) throw new Error('Self-play needs exactly four players');
  if (initial.handOver || initial.matchOver) throw new Error('Self-play needs an active hand');
  let state = initial;
  const actions: Action[] = [];
  while (!state.handOver && actions.length < maxActions) {
    const seat = pendingSeats(state)[0] ?? state.turn;
    const legal = getLegalActions(state, seat);
    if (legal.length === 0) {
      throw new Error(`Self-play stalled: seed ${state.seed}, hand ${state.handNumber}, ${state.phase}, seat ${seat}`);
    }
    // Drawing is automatic, just as in the UI loop; it must not consume AI randomness.
    const action = state.phase === 'awaitingDraw'
      ? legal[0].action
      : ais[seat].decide(toPublicView(state, seat), legal).action;
    if (!legal.some((l) => isDeepStrictEqual(l.action, action))) {
      throw new Error(`Illegal AI action for seat ${seat}: ${JSON.stringify(action)}`);
    }
    state = applyAction(state, action);
    actions.push(action);
  }
  if (!state.handOver) {
    throw new Error(`Self-play did not finish within ${maxActions} actions (seed ${state.seed}, hand ${state.handNumber})`);
  }
  return { state, result: state.handOver, actions };
}

interface SeatStats {
  calls: number;
  dealIn: number;
  riichi: number;
  ronWins: number;
  tsumoWins: number;
  pointsDelta: number;
  decisions: number;
}

/**
 * Independent hands with paired wall seeds for policy comparisons. Each hand
 * starts from the same points/round conditions; the four AI streams carry on.
 */
export function playHands(ais: Players, seed: number, hands: number) {
  if (!Number.isSafeInteger(hands) || hands < 0) throw new Error('Invalid self-play hand count');
  const perSeat: SeatStats[] = SEATS.map(() => ({
    calls: 0, dealIn: 0, riichi: 0, ronWins: 0, tsumoWins: 0, pointsDelta: 0, decisions: 0,
  }));
  for (let h = 0; h < hands; h++) {
    const initial = createMatch(SETTINGS, seed + h * 7919);
    const { state, result, actions } = playHand(ais, initial);
    for (const action of actions) {
      const stats = perSeat[action.seat];
      if (action.type !== 'draw') stats.decisions++;
      if (action.type === 'chi' || action.type === 'pon' || action.type === 'minkan') stats.calls++;
      if (action.type === 'discard' && action.riichi) stats.riichi++;
    }
    if (result.winner !== null) {
      if (result.reason === 'tsumo') perSeat[result.winner].tsumoWins++;
      else perSeat[result.winner].ronWins++;
    }
    if (result.loser !== null) perSeat[result.loser].dealIn++;
    for (const seat of SEATS) perSeat[seat].pointsDelta += state.players[seat].points - initial.players[seat].points;
  }
  return { handsPlayed: hands, perSeat };
}

/** Complete a real match, including dealer repeats, honba, and final ranking. */
export function playMatch(ais: Players, seed: number, settings: TableSettings = SETTINGS, maxHands = 100) {
  let state = createMatch(settings, seed);
  const wins: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (let h = 0; h < maxHands; h++) {
    const played = playHand(ais, state);
    if (played.result.winner !== null) wins[played.result.winner]++;
    state = nextHand(played.state);
    if (state.matchOver) return { ...state.matchOver, wins };
  }
  throw new Error(`Self-play match did not finish within ${maxHands} hands (seed ${seed})`);
}
