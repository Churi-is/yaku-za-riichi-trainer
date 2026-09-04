/**
 * Engine adapter (Worker D). The game loop talks to THIS, never to @engine
 * directly, so we can degrade gracefully while Worker A is still building.
 *
 * Policy: call the real @engine function. If it throws the scaffold's
 * "not implemented" error, transparently use the self-contained fallback
 * engine in this folder. Once Worker A lands, every call routes to the real
 * engine and the fallback is never touched. This satisfies the brief's
 * "guard the loop against a throwing engine stub" requirement.
 */
import * as engine from '@engine/index';
import type {
  Action, GameState, LegalAction, PublicView, ScoreResult, SeatIndex,
  TableSettings, Meld, TileId,
} from '@engine/types';
import type { ScoreInput } from '@engine/index';
import * as fallback from './fallbackEngine';

let useFallback = false;
let announced = false;

function isNotImplemented(err: unknown): boolean {
  return err instanceof Error && /not implemented yet/i.test(err.message);
}

/** True once we've detected the real engine isn't ready and switched to fallback. */
export function usingFallback(): boolean {
  return useFallback;
}

function run<T>(real: () => T, fb: () => T): T {
  if (useFallback) return fb();
  try {
    return real();
  } catch (err) {
    if (isNotImplemented(err)) {
      useFallback = true;
      if (!announced) {
        announced = true;
        // eslint-disable-next-line no-console
        console.info('[engineAdapter] Real engine not implemented yet — using Worker D fallback engine.');
      }
      return fb();
    }
    throw err;
  }
}

export function createMatch(settings: TableSettings, seed?: number): GameState {
  return run(() => engine.createMatch(settings, seed), () => fallback.createMatch(settings, seed));
}
export function applyAction(state: GameState, action: Action): GameState {
  return run(() => engine.applyAction(state, action), () => fallback.applyAction(state, action));
}
export function getLegalActions(state: GameState, seat: SeatIndex): LegalAction[] {
  return run(() => engine.getLegalActions(state, seat), () => fallback.getLegalActions(state, seat));
}
export function pendingSeats(state: GameState): SeatIndex[] {
  return run(() => engine.pendingSeats(state), () => fallback.pendingSeats(state));
}
export function toPublicView(state: GameState, seat: SeatIndex): PublicView {
  return run(() => engine.toPublicView(state, seat), () => fallback.toPublicView(state, seat));
}
export function nextHand(state: GameState): GameState {
  return run(() => engine.nextHand(state), () => fallback.nextHand(state));
}
export function shanten(hand: TileId[], melds: Meld[]): number {
  return run(() => engine.shanten(hand, melds), () => fallback.shanten(hand, melds));
}
export function ukeire(hand: TileId[], melds: Meld[], visibleCounts: number[]): { kind: number; count: number }[] {
  return run(() => engine.ukeire(hand, melds, visibleCounts), () => fallback.ukeire(hand, melds, visibleCounts));
}
export function waits(hand: TileId[], melds: Meld[]): number[] {
  return run(() => engine.waits(hand, melds), () => fallback.waits(hand, melds));
}
export function scoreHand(input: ScoreInput): ScoreResult {
  return run(() => engine.scoreHand(input), () => fallback.scoreHand(input));
}
