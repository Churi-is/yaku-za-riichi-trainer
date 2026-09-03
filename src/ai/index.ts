/**
 * SHARED CONTRACT — AI entry point. Owned by Worker B.
 * The game loop (Worker D) only needs `PERSONALITIES` and `createAI().decide()`.
 *
 * One parameterized decision engine: archetype × difficulty resolve into
 * AIParams (see params.ts). The engine consumes ONLY a PublicView.
 */
import type {
  Difficulty,
  LegalAction,
  PublicView,
} from '@engine/types';
import type { AIDecision, AIPlayer, Archetype, Personality } from './types';
import { paramsFor } from './params';
import { PERSONALITIES } from './personalities';
import { Rng, hashSeed } from './rng';
import { decideAction } from './player';

export * from './types';
export { PERSONALITIES, personalityById } from './personalities';
export { paramsFor } from './params';

/**
 * Create an AI player. `seed` makes the RNG stream deterministic; the same
 * seed + the same PublicView always yields the same decision.
 */
export function createAI(
  personality: Personality,
  difficulty: Difficulty,
  seed = 0,
): AIPlayer {
  const params = paramsFor(personality.archetype, difficulty);
  // Each seat gets an independent, reproducible RNG stream.
  const rng = new Rng(hashSeed('ai', personality.id, difficulty, seed));

  const player: AIPlayer = {
    personality,
    params,
    decide(view: PublicView, legal: LegalAction[]): AIDecision {
      const { action, rationale } = decideAction(view, legal, {
        params,
        archetype: personality.archetype,
        rng,
      });
      return { action, rationale };
    },
  };
  return player;
}

/** Convenience: build an AI by archetype (rotates through personalities). */
export function createAIForArchetype(
  archetype: Archetype,
  difficulty: Difficulty,
  seed = 0,
): AIPlayer {
  const personality = PERSONALITIES.find((p) => p.archetype === archetype)!;
  return createAI(personality, difficulty, seed);
}
