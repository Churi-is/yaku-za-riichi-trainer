/**
 * Mulberry32 from a raw 32-bit state, yielding floats in [0, 1).
 * Callers own seed normalization: dealing and AI decisions deliberately use
 * different initial states for the same seed. Do not mix or reseed here.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
