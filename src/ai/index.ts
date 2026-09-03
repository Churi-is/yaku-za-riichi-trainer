/**
 * SHARED CONTRACT — AI entry point. Owned by Worker B.
 * The game loop (Worker D) only needs `PERSONALITIES` and `createAI().decide()`.
 *
 * STUB: picks the first legal action so the loop can run before B lands.
 */
import type { Difficulty, LegalAction, PublicView } from '@engine/types';
import type { AIDecision, AIParams, AIPlayer, Archetype, Personality } from './types';

export * from './types';

/** Three personalities, one per archetype, seated at every table. */
export const PERSONALITIES: Personality[] = [
  {
    id: 'kiryu',
    name: 'Kazuma',
    archetype: 'aggressive',
    tagline: 'Calls early and often — builds fast, cheap hands and never backs down.',
  },
  {
    id: 'majima',
    name: 'Goro',
    archetype: 'balanced',
    tagline: 'Reads the table, calls only when it pays, and folds when the math says so.',
  },
  {
    id: 'nishiki',
    name: 'Akira',
    archetype: 'defensive',
    tagline: 'Plays closed, waits for value, and is very hard to deal into.',
  },
];

export function paramsFor(archetype: Archetype, difficulty: Difficulty): AIParams {
  return {
    efficiencyNoise: 0.2,
    callGreed: 0.5,
    defenseThreshold: 0.5,
    riichiPatience: 0.5,
    tellSubtlety: 0.5,
    deviation: 0,
  };
}

export function createAI(
  personality: Personality, difficulty: Difficulty, seed = 0,
): AIPlayer {
  const params = paramsFor(personality.archetype, difficulty);
  return {
    personality,
    params,
    decide(view: PublicView, legal: LegalAction[]): AIDecision {
      const pass = legal.find((l) => l.action.type === 'pass');
      return { action: (pass ?? legal[0]).action, rationale: 'stub' };
    },
  };
}
