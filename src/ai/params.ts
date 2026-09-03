/**
 * Parameter resolution for the single AI decision engine.
 *
 * One engine, two axes: ARCHETYPE sets the *tendencies* (and stays legible at
 * every tier), DIFFICIENCY scales *execution* (noise, defense rigor, riichi
 * timing, tell subtlety). Hard adds a small `deviation` chance so it is not a
 * fixed exploitable pattern — but the tendencies still read through.
 */
import type { Difficulty } from '@engine/types';
import type { AIParams, Archetype } from './types';

interface ArchetypeProfile {
  callGreed: number;
  defenseThreshold: number;
  riichiPatience: number;
}

/**
 * Base archetype tendencies at "Normal" execution. These are the identity the
 * player learns to read; difficulty multipliers perturb execution around them.
 */
const PROFILES: Record<Archetype, ArchetypeProfile> = {
  // Koikoi caller: pon/chi happy, nearly never folds, riichi instantly.
  aggressive: { callGreed: 0.82, defenseThreshold: 0.85, riichiPatience: 0.08 },
  // Solid all-rounder.
  balanced: { callGreed: 0.45, defenseThreshold: 0.45, riichiPatience: 0.5 },
  // Closed, patient, folds early.
  defensive: { callGreed: 0.18, defenseThreshold: 0.22, riichiPatience: 0.78 },
};

/**
 * Difficulty scales execution. Multipliers are applied to the archetype's
 * base tendencies so identity survives at every tier.
 */
const DIFFICULTY_EXECUTION: Record<
  Difficulty,
  {
    noise: number;
    /** Multiplies call greed tendency (easy overcalls, hard undercalls slightly). */
    call: number;
    /** Folding rigor: higher at hard. Folds when threat >= defenseThreshold. */
    defenseRigor: number;
    /** Dama/riichi discipline. */
    patience: number;
    /** tellSubtlety: low = legible/exaggerated (easy), high = subtle (hard). */
    subtlety: number;
    deviation: number;
  }
> = {
  // Real mistakes, greedy hurting calls, ignores riichi, tells cartoonish.
  easy: {
    noise: 0.28, call: 1.18, defenseRigor: 0.55, patience: 0.7, subtlety: 0.08, deviation: 0,
  },
  // Competent with small errors; readable but not a caricature.
  normal: {
    noise: 0.1, call: 1.0, defenseRigor: 1.0, patience: 1.0, subtlety: 0.55, deviation: 0,
  },
  // Near-optimal, correct suji defense, good timing, subtle; rarely deviates.
  hard: {
    noise: 0.02, call: 0.92, defenseRigor: 1.5, patience: 1.25, subtlety: 0.9, deviation: 0.12,
  },
};

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export function paramsFor(archetype: Archetype, difficulty: Difficulty): AIParams {
  const p = PROFILES[archetype];
  const e = DIFFICULTY_EXECUTION[difficulty];

  // Efficiency noise: base execution noise, nudged by archetype (aggressive
  // plays fast and loose; defensive is careful even when weak).
  const archetypeNoise = archetype === 'aggressive' ? 1.25 : archetype === 'defensive' ? 0.8 : 1.0;
  const efficiencyNoise = clamp01(e.noise * archetypeNoise);

  const callGreed = clamp01(p.callGreed * e.call);

  // defenseThreshold is the threat level at which the bot starts folding.
  // defenseRigor lowers the effective threshold for harder bots (they fold to
  // smaller threats); easy bots need a bigger threat before they notice.
  const defenseThreshold = clamp01(p.defenseThreshold / e.defenseRigor);

  // riichiPatience: higher = more dama / later riichi. Easy flips it around a
  // bit (mistakes), hard is more disciplined around the archetype tendency.
  const riichiPatience = clamp01(p.riichiPatience * e.patience + (difficulty === 'easy' ? 0.05 : 0));

  return {
    efficiencyNoise,
    callGreed,
    defenseThreshold,
    riichiPatience,
    tellSubtlety: e.subtlety,
    deviation: e.deviation,
  };
}
