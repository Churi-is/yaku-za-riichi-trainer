/**
 * Seeded RNG for deterministic AI decisions.
 * Decision paths MUST use this — never Math.random() — so that the same seed
 * plus the same PublicView always produces the same decision.
 */
import { mulberry32 } from '../shared/random';

export class Rng {
  private readonly nextFloat: () => number;

  constructor(seed: number) {
    // Preserve the AI's unsigned-seed / zero-to-one convention, not the
    // engine's seed mixer. Both consumers share only the generator itself.
    this.nextFloat = mulberry32((seed >>> 0) || 1);
  }

  /** Uniform float in [0, 1). Mulberry32. */
  next(): number {
    return this.nextFloat();
  }

  /** True with probability p (clamped to [0,1]). */
  chance(p: number): boolean {
    return p <= 0 ? false : p >= 1 ? true : this.next() < p;
  }

  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Deterministic 32-bit hash from seed parts, so personality id + seed → stream. */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = Math.imul(h ^ (h >>> 13), 3266489917);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
