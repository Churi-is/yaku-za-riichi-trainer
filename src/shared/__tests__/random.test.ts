import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../../ai/rng';
import { createRng, seedForHand, shuffle } from '../../engine/rng';
import { mulberry32 } from '../random';

/** Fingerprints captured before consolidating the two production generators. */
const STREAMS = [
  { label: 'zero', seed: 0,
    engine: 'e6d6c06fda1271e59266c498573ec5ca6bfef4fc530099aeab5d40915977a23f',
    ai: '7fa36a895af7e042035e2b129b82a31447ee57ccd59eea6878f53f99b794166a' },
  { label: 'one', seed: 1,
    engine: 'e636b0f1cf356aa4e14751385b4eeb34ecdd5b6b9be91577dd0eb2a751d7b1ad',
    ai: '7fa36a895af7e042035e2b129b82a31447ee57ccd59eea6878f53f99b794166a' },
  { label: 'positive', seed: 12345,
    engine: '80cb83bbc43f6d7003e2b5a564eda0479fa9994e5d8cf939e662f1da9d7c6919',
    ai: '8346dc7ec9eafdfeaf998c468134255a52ea0ba89434bcaa7982d91dbf66fad9' },
  { label: 'negative', seed: -1,
    engine: '3bee87173471634458a652ada3bd708f8f5e4e06d1c04113f83afb5cabfd7a74',
    ai: 'e11829cd1d8dbc2c37e7f194b943231b9748b36cec5c46a37f61d73940930d02' },
  { label: 'signed boundary', seed: 0x80000000,
    engine: 'd6400f52525b2089fb14b686585aac1df66d9dd3931a7d9cfca2671bbf1aef14',
    ai: '01967848b2e7c2a0173cdbab2e9023b6b0fbd0e9314b1752fe7da6c0bbb86363' },
  { label: 'uint32 max', seed: 0xffffffff,
    engine: '3bee87173471634458a652ada3bd708f8f5e4e06d1c04113f83afb5cabfd7a74',
    ai: 'e11829cd1d8dbc2c37e7f194b943231b9748b36cec5c46a37f61d73940930d02' },
  { label: 'uint32 wrap', seed: 0x100000000,
    engine: 'e6d6c06fda1271e59266c498573ec5ca6bfef4fc530099aeab5d40915977a23f',
    ai: '7fa36a895af7e042035e2b129b82a31447ee57ccd59eea6878f53f99b794166a' },
  { label: 'fraction', seed: -17.75,
    engine: '979f9627e1b45f0856e989814427481144e820ddce6f05d1a7d4724333a32f44',
    ai: '51e44a88a25c65ee86e329f8ca2342eda7dbe74d4af278df84686442c8614442' },
  { label: 'large', seed: Number.MAX_SAFE_INTEGER,
    engine: '3bee87173471634458a652ada3bd708f8f5e4e06d1c04113f83afb5cabfd7a74',
    ai: 'e11829cd1d8dbc2c37e7f194b943231b9748b36cec5c46a37f61d73940930d02' },
  { label: 'NaN', seed: NaN,
    engine: '51af03a04ff44486a48f0ff8fbcd6515fad64f3e4a353460ddb831cc51f99e3b',
    ai: '7fa36a895af7e042035e2b129b82a31447ee57ccd59eea6878f53f99b794166a' },
  { label: 'Infinity', seed: Infinity,
    engine: '51af03a04ff44486a48f0ff8fbcd6515fad64f3e4a353460ddb831cc51f99e3b',
    ai: '7fa36a895af7e042035e2b129b82a31447ee57ccd59eea6878f53f99b794166a' },
  { label: '-Infinity', seed: -Infinity,
    engine: '51af03a04ff44486a48f0ff8fbcd6515fad64f3e4a353460ddb831cc51f99e3b',
    ai: '7fa36a895af7e042035e2b129b82a31447ee57ccd59eea6878f53f99b794166a' },
];

function fingerprint(next: () => number): string {
  const bytes = Buffer.alloc(4096 * 4);
  for (let i = 0; i < 4096; i++) bytes.writeUInt32LE(next() * 2 ** 32, i * 4);
  return createHash('sha256').update(bytes).digest('hex');
}

describe('seeded random compatibility', () => {
  it.each(STREAMS)('preserves both streams for a $label seed', ({ seed, engine, ai }) => {
    expect(fingerprint(createRng(seed))).toBe(engine);
    const rng = new Rng(seed);
    expect(fingerprint(() => rng.next())).toBe(ai);
  });

  it('keeps raw state separate from consumer seed normalization', () => {
    expect(fingerprint(mulberry32(0))).toBe(STREAMS[0].engine);
    expect(fingerprint(mulberry32(1))).toBe(STREAMS[1].ai);
    expect(STREAMS[0].engine).not.toBe(STREAMS[0].ai);
  });

  it('preserves per-hand seed derivation', () => {
    expect([1, 2, 4, 8, 100].map((n) => seedForHand(0, n))).toEqual([580771925, 1443134380, 627619746, 1115208188, 4010883932]);
    expect([1, 2, 4, 8, 100].map((n) => seedForHand(1, n))).toEqual([2380315151, 233212778, 381524514, 217615184, 1679633351]);
    expect([1, 2, 4, 8, 100].map((n) => seedForHand(-1, n))).toEqual([1827479036, 2290608497, 4267918703, 2105069961, 1577095022]);
    expect([1, 2, 4, 8, 100].map((n) => seedForHand(12345, n))).toEqual([3715143008, 1579742523, 2448145377, 1914488875, 1051464144]);
  });

  it('does not consume AI randomness for certain or impossible chances', () => {
    const rng = new Rng(42);
    for (const p of [-1, 0]) expect(rng.chance(p)).toBe(false);
    for (const p of [1, 2]) expect(rng.chance(p)).toBe(true);
    expect(rng.next()).toBe(new Rng(42).next());
  });

  it('uses one draw for probabilistic chances and array picks', () => {
    const rng = new Rng(91);
    const reference = new Rng(91);
    expect(rng.chance(0.5)).toBe(reference.next() < 0.5);
    const options = ['a', 'b', 'c', 'd'];
    expect(rng.pick(options)).toBe(options[Math.floor(reference.next() * options.length)]);
    expect(rng.next()).toBe(reference.next());
  });

  it('keeps instances independent and all draws within [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const first = a();
    for (let i = 0; i < 1000; i++) {
      const value = a();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(b()).toBe(first);
  });

  it('shuffles reproducibly without changing or losing input values', () => {
    const input = Object.freeze(Array.from({ length: 136 }, (_, id) => id));
    const a = shuffle(input, createRng(19));
    expect(a).toEqual(shuffle(input, createRng(19)));
    expect([...a].sort((x, y) => x - y)).toEqual(input);
    expect(a).not.toEqual(input);
  });

  it('keeps character seed hashing reproducible and sensitive to its inputs', () => {
    expect(hashSeed('ai', 'kiryu', 'hard', 7)).toBe(hashSeed('ai', 'kiryu', 'hard', 7));
    expect(hashSeed('ai', 'kiryu', 'hard', 7)).not.toBe(hashSeed('ai', 'kiryu', 'easy', 7));
  });
});
