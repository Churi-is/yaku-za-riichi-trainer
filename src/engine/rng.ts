/**
 * engine/rng — deterministic, dependency-free PRNG.
 *
 * Every random decision in the engine happens at deal time (`wall.ts`), so
 * `applyAction` never touches the RNG and stays pure. A whole match is
 * reproducible from `(settings, seed)`.
 */

import { mulberry32 } from '../shared/random';

type Rng = () => number;

/** Normalize any integer-ish seed into a well-spread 32-bit state. */
function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0x9e3779b9;
  let s = Math.trunc(seed) | 0;
  // Splitmix-style finalizer: avoids correlated streams for adjacent seeds.
  s ^= s >>> 16;
  s = Math.imul(s, 0x21f0aaad);
  s ^= s >>> 15;
  s = Math.imul(s, 0x735a2d97);
  s ^= s >>> 15;
  return s >>> 0;
}

/** Seed-mixed stream for dealing; preserves the engine's existing seed mapping. */
export function createRng(seed: number): Rng {
  return mulberry32(normalizeSeed(seed));
}

/** Integer in [0, n). */
function nextInt(rng: Rng, n: number): number {
  if (n <= 0) return 0;
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Fisher-Yates. Pure: returns a new array, never mutates `input`. */
export function shuffle<T>(input: readonly T[], rng: Rng): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Seed for hand `n` of a match. Deterministic, and adjacent hands land in
 * unrelated parts of the stream thanks to `normalizeSeed`.
 */
export function seedForHand(rootSeed: number, handNumber: number): number {
  return normalizeSeed((normalizeSeed(rootSeed) + Math.imul(handNumber | 0, 0x9e3779b1)) >>> 0);
}
