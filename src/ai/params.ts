/**
 * Tune a character at the normal baseline, THEN scale execution. A personality
 * override must never accidentally turn an Easy bot into a Hard one (or vice
 * versa). Yaku preferences survive a uniform practice-level override.
 */
import type { Difficulty } from '@engine/types';
import type { AIParams, Archetype, Personality } from './types';

const PROFILES: Record<Archetype, {
  callGreed: number; defenseThreshold: number; riichiPatience: number;
}> = {
  aggressive: { callGreed: 0.82, defenseThreshold: 0.85, riichiPatience: 0.08 },
  balanced: { callGreed: 0.45, defenseThreshold: 0.45, riichiPatience: 0.5 },
  defensive: { callGreed: 0.18, defenseThreshold: 0.22, riichiPatience: 0.78 },
};

const EXECUTION = {
  easy: { noise: 2.8, call: 1.18, rigor: 0.55, patience: 0.7, awareness: 0.25 },
  normal: { noise: 1, call: 1, rigor: 1, patience: 1, awareness: 0.7 },
  hard: { noise: 0.2, call: 0.92, rigor: 1.5, patience: 1.25, awareness: 1 },
} as const;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function paramsFor(
  archetype: Archetype, difficulty: Difficulty, tune: Personality['tune'] = {},
): AIParams {
  const p = { ...PROFILES[archetype], ...tune };
  const e = EXECUTION[difficulty];
  const archetypeNoise = archetype === 'aggressive' ? 1.25 : archetype === 'defensive' ? 0.8 : 1;
  return {
    archetype,
    efficiencyNoise: clamp01((tune.efficiencyNoise ?? 0.1) * e.noise * archetypeNoise),
    callGreed: clamp01(p.callGreed * e.call),
    defenseThreshold: clamp01(p.defenseThreshold / e.rigor),
    riichiPatience: clamp01(p.riichiPatience * e.patience + (difficulty === 'easy' ? 0.05 : 0)),
    deviation: difficulty === 'hard' ? clamp01(tune.deviation ?? 0.08) : 0,
    valueGreed: clamp01(tune.valueGreed ?? 0.5),
    flushBias: clamp01(tune.flushBias ?? 0),
    pairBias: clamp01(tune.pairBias ?? 0),
    kanGreed: clamp01(tune.kanGreed ?? 0.25),
    safetyAwareness: e.awareness,
    placementAwareness: clamp01((tune.placementAwareness ?? 0.6) * e.awareness),
  };
}
