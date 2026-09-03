/**
 * Seeded RNG for deterministic AI decisions.
 * Decision paths MUST use this — never Math.random() — so that the same seed
 * plus the same PublicView always produces the same decision.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  /** Uniform float in [0, 1). Mulberry32. */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** True with probability p (clamped to [0,1]). */
  chance(p: number): boolean {
    const c = p <= 0 ? false : p >= 1 ? true : this.next() < p;
    return c;
  }

  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Weighted pick. Returns the selected index; weights need not be normalized.
   * Falls back to uniform when the total weight is non-positive.
   */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return Math.floor(this.next() * weights.length);
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= Math.max(0, weights[i]);
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }

  /** Fisher–Yates shuffle on a copy; original is untouched. */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
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
