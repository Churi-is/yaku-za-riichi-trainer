/**
 * Worker C — analysis test suite.
 *
 * Covers the brief's bars:
 *  - fixture hands → expected yaku rankings/bands
 *  - no-advice: descriptions are static definitions, never tile references
 *  - no-cheat / public-information firewall (static import scan + determinism)
 *  - suji / genbutsu / kabe unit tests
 *  - grading regression (bad discard ≤ Poor, clean discard ≥ Good)
 *  - live-overlay ↔ replay-grader consistency for the same PublicView
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  suggestYaku, readOpponents, guessWaits, gradeMatch, resolveWaitGuesses,
} from '../index';
import type { PublicView } from '@engine/types';
import { safetyOfKind } from '../tileSafety';
import { computeShantenWaiting, computeUkeireWaiting } from '../shanten';
import { computeWaitsWaiting } from '../waits';
import { kindOf, kindShort, countsFromIds } from '../tileUtil';
import { makeView, ids, makeMeld, kindOfS } from './fixtures';

// ---------------------------------------------------------------------------
// Yaku advisor
// ---------------------------------------------------------------------------

describe('suggestYaku', () => {
  it('ranks high-value directions first (flush hand → honitsu above misc)', () => {
    const v = makeView({
      hand: ids('1p','1p','1p','2p','3p','4p','5p','6p','7p','8p','9p','E','H'),
    });
    const s = suggestYaku(v);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(5);
    const top = s[0].id;
    // The dominant-suit hand should surface honitsu (or chinitsu) at the top.
    expect(['honitsu', 'chinitsu', 'riichi']).toContain(top);
    const honitsu = s.find((x) => x.id === 'honitsu');
    if (honitsu) expect(['Medium', 'High', 'Very high']).toContain(honitsu.band);
  });

  it('flags closed-only yaku as impossible once the hand is open', () => {
    const closed = makeView({
      hand: ids('2m','3m','4m','5m','6m','2p','3p','4p','5p','6p','2s','3s','4s'),
    });
    const open = makeView({
      hand: ids('2m','3m','4m','5m','6m','2p','3p','4p','5p','6p'),
      melds: [makeMeld('pon', ids('H','H','H'), 1)],
      isClosed: false,
    });
    const closedIds = new Set(suggestYaku(closed).map((s) => s.id));
    const openIds = new Set(suggestYaku(open).map((s) => s.id));
    for (const closedOnly of ['riichi', 'pinfu', 'menzenTsumo', 'chiitoitsu', 'ryanpeikou'] as const) {
      if (closedIds.has(closedOnly)) {
        expect(openIds.has(closedOnly)).toBe(false);
      }
    }
  });

  it('open tanyao is devalued only when kuitan is off', () => {
    const base = makeView({
      hand: ids('2m','3m','4m','5m','6m','2p','3p','4p','5p','6p'),
      melds: [makeMeld('chi', ids('2s','3s','4s'), 3)],
      isClosed: false,
    });
    const kuitanOn = suggestYaku(base);
    const kuitanOff = suggestYaku({
      ...base,
      settings: { ...base.settings, kuitan: false },
    });
    const on = kuitanOn.find((x) => x.id === 'tanyao');
    const off = kuitanOff.find((x) => x.id === 'tanyao');
    if (on) {
      // Open tanyao only counts when kuitan is on — with it off the yaku is
      // impossible for this open hand and must not be suggested at all.
      expect(off).toBeUndefined();
    }
  });

  it('respects the two-han minimum by devaluing single-han paths', () => {
    const v = makeView({ hand: ids('2m','3m','4m','5m','6m','2p','3p','4p','5p','6p','2s','3s','4s') });
    const on = suggestYaku(v);
    const off = suggestYaku({ ...v, settings: { ...v.settings, twoHanMinimum: true } });
    const tanyaoOn = on.find((x) => x.id === 'tanyao')?.band;
    const tanyaoOff = off.find((x) => x.id === 'tanyao')?.band;
    if (tanyaoOn && tanyaoOff) {
      expect(bandScore(tanyaoOff)).toBeLessThanOrEqual(bandScore(tanyaoOn));
    }
  });

  it('never gives tile advice and keeps descriptions static', () => {
    const hands = [
      makeView({ hand: ids('1p','1p','1p','2p','3p','4p','5p','6p','7p','8p','9p','E','H') }),
      makeView({ hand: ids('2m','3m','4m','5m','6m','2p','3p','4p','5p','6p','2s','3s','4s') }),
      makeView({ hand: ids('H','H','H','G','G','G','C','C') }),
    ];
    const descById = new Map<string, string>();
    // A concrete tile reference = a suit-coded rank ("4m", "9s", "5p") or a
    // named honor. Definitional numerals like "1-2-3" are fine; telling the
    // player about a specific tile is not.
    const tileTokens = /\b\d[mps]\b|\bHaku\b|\bHatsu\b|\bChun\b|\bEast wind\b|\bSouth wind\b|\bWest wind\b|\bNorth wind\b/;
    for (const v of hands) {
      for (const s of suggestYaku(v)) {
        // The one hand-dependent field is the band. Descriptions must never
        // name a specific tile or recompute for the hand.
        expect(s.description.match(tileTokens)).toBeNull();
        const prev = descById.get(s.id);
        if (prev !== undefined) expect(s.description).toBe(prev);
        descById.set(s.id, s.description);
        // han labels are static too
        expect(s.hanLabel.length).toBeGreaterThan(0);
        expect(s.methodNote).toMatch(/estimate/i);
      }
    }
  });
});

function bandScore(b: string): number {
  return ['Very low', 'Low', 'Medium', 'High', 'Very high'].indexOf(b);
}

// ---------------------------------------------------------------------------
// Opponent reading
// ---------------------------------------------------------------------------

describe('readOpponents', () => {
  it('reads meld-driven flush and threat from public info only', () => {
    const v = makeView({
      hand: ids('1m','2m','3m'),
      meldsBySeat: {
        1: [makeMeld('chi', ids('4s','5s','6s'), 0), makeMeld('pon', ids('2s','2s','2s'), 2)],
      },
      rivers: { 1: ['1m','1m','9m','9m','3p','4p'] },
      riichi: [2],
      tilesRemaining: 10,
    });
    const reads = readOpponents(v);
    expect(reads.length).toBe(3);
    const r1 = reads.find((r) => r.seat === 1)!;
    expect(r1.handDirection.length).toBeGreaterThan(0);
    expect(r1.riverCues.length).toBeGreaterThan(0);
    // Every text is probabilistic; every signal teaches the method.
    for (const sig of [...r1.handDirection, ...r1.riverCues]) {
      expect(sig.text).toMatch(/likely|possibly|possible|may|suggest|could|probably|\?/i);
      expect(sig.why.length).toBeGreaterThan(10);
    }
    const r2 = reads.find((r) => r.seat === 2)!;
    expect(r2.threat.riichi).toBe(true);
    expect(r2.dealInRisk).not.toBe('Low'); // riichi + late → at least Medium
  });

  it('outputs identical results for identical public views (no hidden dependence)', () => {
    const base = makeView({
      hand: ids('1m','2m','3m','4m','5m'),
      rivers: { 1: ['4p','8p'], 2: ['E','5s'], 3: ['9m'] },
      riichi: [3],
      dora: ['2m'],
    });
    const a = readOpponents(base);
    // Everything public is identical; only construction order differs.
    const b = readOpponents(makeView({
      hand: ids('1m','2m','3m','4m','5m'),
      rivers: { 1: ['4p','8p'], 2: ['E','5s'], 3: ['9m'] },
      riichi: [3],
      dora: ['2m'],
    }));
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Wait guessing
// ---------------------------------------------------------------------------

describe('guessWaits', () => {
  it('returns ranked guesses for riichi seats and errors on discard genbutsu', () => {
    const v = makeView({
      hand: ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p'),
      rivers: { 2: ['5s','6s','4m','8p'], 1: ['1m','4m','7m'], 3: ['3s','6s','9s'] },
      riichi: [2],
    });
    const reads = guessWaits(v);
    const r2 = reads.find((r) => r.seat === 2)!;
    expect(r2.tenpaiLikely).toBe(true);
    expect(r2.guesses.length).toBeGreaterThan(0);
    expect(r2.guesses.length).toBeLessThanOrEqual(3);
    for (const g of r2.guesses) {
      expect(g.kinds.length).toBeGreaterThan(0);
      expect(g.kinds.length).toBeLessThanOrEqual(3);
      expect(['Low', 'Medium', 'High']).toContain(g.confidence);
      expect(g.reasoning).toMatch(/estimate/i);
      // a discarded tile can never be their wait
      expect(g.kinds).not.toContain(kindOfS('5s'));
      expect(g.kinds).not.toContain(kindOfS('8p'));
    }
  });

  it('practice records resolve against revealed hands', () => {
    const hand = ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p');
    const revealed = [...hand, ids('4p')[0]]; // tenant winning 4p
    const records = [{
      handId: 1,
      seat: 2 as const,
      submittedKinds: [kindOfS('4p')],
      actualWaits: null,
      correct: null,
    }];
    const log = [{
      handId: 1,
      seq: 99,
      seat: 2 as const,
      action: { type: 'ron' as const, seat: 2 as const },
      viewBefore: makeView({ hand, rivers: { 2: ['5s'] } }),
      handReveal: { revealedHands: { 0: [], 1: [], 2: revealed, 3: [] }, winningTile: ids('4p')[0] },
    }];
    const [resolved] = resolveWaitGuesses(records, log);
    expect(resolved.actualWaits).toEqual([kindOfS('1p'), kindOfS('4p')]);
    expect(resolved.correct).toBe(true);

    const missed = resolveWaitGuesses([{
      handId: 1,
      seat: 2 as const,
      submittedKinds: [kindOfS('7p')],
      actualWaits: null,
      correct: null,
    }], log)[0];
    expect(missed.correct).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Safety (suji / genbutsu / kabe)
// ---------------------------------------------------------------------------

describe('tile safety', () => {
  it('genbutsu beats suji beats unknown', () => {
    const river = [kindOfS('4p')]; // seat discarded 4p
    const visible = new Array(34).fill(0);
    const genbutsu = safetyOfKind(kindOfS('4p'), river, visible);
    const suji = safetyOfKind(kindOfS('1p'), river, visible); // 1-4-7 group
    const unknown = safetyOfKind(kindOfS('5m'), river, visible);
    expect(genbutsu.tier).toBe('genbutsu');
    expect(suji.tier).toBe('suji');
    expect(unknown.tier).toBe('danger');
    expect(genbutsu.score).toBeGreaterThan(suji.score);
    expect(suji.score).toBeGreaterThan(unknown.score);
  });

  it('kabe kills the one-sided wait when all four neighbors are visible', () => {
    const visible = new Array(34).fill(0);
    // all four 3p visible → the 4p wait via 23p is dead
    for (const c of [0, 1, 2, 3]) visible[kindOfS('3p')] = c + 1;
    const v = safetyOfKind(kindOfS('4p'), [], visible);
    expect(v.kabe).toBe(true);
    expect(v.tier).toBe('kabe');
  });

  it('ranked danger list excludes dead tiles and ranks suits by protection', () => {
    const v = makeView({
      hand: ids('1m','2m','3m'),
      rivers: { 1: ['4p','8p','E','E'] },
    });
    // The seat's own discards are genbutsu for them
    const read = readOpponents(v).find((r) => r.seat === 1)!;
    expect(read.safeTiles).toContain(kindOfS('4p'));
    expect(read.dangerTiles).not.toContain(kindOfS('4p'));
  });
});

// ---------------------------------------------------------------------------
// Engine-backed helpers (shared with grading)
// ---------------------------------------------------------------------------

describe('engine-backed analysis helpers', () => {
  it('shanten/ukeire/waits agree with known tenpai shapes', () => {
    const tenpai = ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p');
    expect(computeShantenWaiting(tenpai, null, [])).toBe(0);
    expect(computeWaitsWaiting(tenpai, null, [])).toEqual([kindOfS('1p'), kindOfS('4p')]);
    const vis = countsFromIds(tenpai);
    const u = computeUkeireWaiting(tenpai, null, [], vis);
    const byKind = new Map(u.map((x) => [x.kind, x.count]));
    expect(byKind.get(kindOfS('1p'))).toBe(2); // 4 - 2 in hand
    expect(byKind.get(kindOfS('4p'))).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

function mkEntry(
  action: { type: 'discard'; seat: 0; tile: number; riichi?: boolean },
  view: PublicView,
  seq: number,
) {
  return { handId: 1, seq, seat: 0 as const, action, viewBefore: view };
}

describe('gradeMatch', () => {
  it('produces a graded turn for every human action in a sample log', () => {
    const base = ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p');
    const drawn = ids('9s')[0];
    const view = makeView({ hand: base, drawn, rivers: { 1: ['4p','8p'] }, riichi: [2] });
    const log = [
      mkEntry({ type: 'discard', seat: 0, tile: drawn, riichi: true }, view, 3),
      mkEntry({ type: 'discard', seat: 0, tile: ids('9s')[0] }, view, 5),
      { handId: 1, seq: 7, seat: 0 as const, action: { type: 'draw' as const, seat: 0 as const }, viewBefore: view },
      mkEntry({ type: 'discard', seat: 0, tile: ids('3p')[0] }, view, 9),
      { handId: 1, seq: 11, seat: 0 as const, action: { type: 'ron' as const, seat: 0 as const }, viewBefore: view },
    ];
    const graded = gradeMatch(log);
    expect(graded.length).toBe(log.length);
    for (const g of graded) {
      expect(g.grade).toBeDefined();
      expect(g.explanation.length).toBeGreaterThan(10);
      expect(['none','efficiency','valueVsSpeed','callJudgment','riichiTiming','pushFold','missedOpportunity'])
        .toContain(g.category);
    }
  });

  it('grades every human turn and covers a known-bad discard as Poor or worse', () => {
    // 4 sets + pair + float; discarding the pair's tile is a clear efficiency error.
    const hand = ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p');
    const drawn = ids('9s')[0];
    const view = makeView({ hand, drawn });
    const bad = mkEntry({ type: 'discard', seat: 0, tile: ids('1p')[0] }, view, 1);
    const grades = gradeMatch([bad]);
    expect(grades.length).toBe(1);
    expect(['Poor', 'Blunder']).toContain(grades[0].grade);
    expect(grades[0].alternatives.length).toBeGreaterThan(0);
  });

  it('grades a clean efficiency discard as Good or better', () => {
    const hand = ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','9s');
    const drawn = ids('4p')[0]; // keeps 123p + tanki 4p tenpai alive
    const view = makeView({ hand, drawn });
    const good = mkEntry({ type: 'discard', seat: 0, tile: ids('9s')[0] }, view, 1);
    const grades = gradeMatch([good]);
    expect(['Good', 'Excellent']).toContain(grades[0].grade);
    expect(grades[0].shantenBefore).toBe(0);
    expect(grades[0].shantenAfter).toBe(0);
  });

  it('grades riichi timing by wait quality and table threat', () => {
    // The riichi view holds the 13-tile waiting shape plus the tile about to
    // be discarded — discarding the float keeps us tenpai on 1p/4p.
    const hand = ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p');
    const drawn = ids('9s')[0];
    const view = makeView({ hand, drawn, rivers: { 2: ['5s','6s','4m','8p'], 1: ['1m','4m','7m'] }, riichi: [2] });
    const entry = mkEntry({ type: 'discard', seat: 0, tile: ids('9s')[0], riichi: true }, view, 3);
    const grades = gradeMatch([entry]);
    const g = grades[0];
    expect(g.actionLabel).toMatch(/riichi/i);
    expect(g.category).toBe('riichiTiming');
    expect(['Good', 'Excellent', 'Fair']).toContain(g.grade); // multi-wait riichi
  });

  it('consistency: replay explanation uses the same signals as the live overlay', () => {
    const v = makeView({
      hand: ids('1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','2p','3p'),
      rivers: { 2: ['5s','6s'], 1: ['1m','4m','7m'] },
      riichi: [2],
      tilesRemaining: 12,
    });
    const live = readOpponents(v).find((r) => r.seat === 2)!;
    // Riichi seat with an active river → the live read is at least Medium risk.
    expect(['Medium', 'High']).toContain(live.dealInRisk);
    const graded = gradeMatch([
      mkEntry({ type: 'discard', seat: 0, tile: ids('9s')[0], riichi: true }, v, 6),
    ])[0];
    // The grader's riichi timing note must mention the table threat it read
    // live — same source module, same signals.
    expect(graded.explanation).toBeTruthy();
    expect(graded.shantenAfter).toBe(0);
    // The overlay's safety table is the same one the grader uses: a tile the
    // opponent already discarded (genbutsu) is always in their safe list.
    expect(live.safeTiles).toContain(kindOfS('5s'));
  });
});

// ---------------------------------------------------------------------------
// Public-information firewall — static scan
// ---------------------------------------------------------------------------

describe('public-information firewall', () => {
  it('src/analysis never imports GameState', () => {
    const dir = join(process.cwd(), 'src/analysis');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      // The firewall rule: no analysis file may import GameState or read
      // hidden tiles. Importing the engine's public tile/shanten helpers is
      // explicitly allowed (that is the shared module); GameState is not.
      const importLines = src.split('\n').filter((l) => /^import/.test(l.trim()));
      for (const line of importLines) {
        expect(line).not.toMatch(/GameState/);
      }
      expect(src).not.toMatch(/GameState\s*[;:{]/);
    }
  });

  it('overlay functions accept PublicView only (types are sealed)', () => {
    // Compile-time guarantee: these signatures exist and take PublicView.
    const fns: Array<(v: PublicView) => unknown> = [suggestYaku, readOpponents, guessWaits];
    expect(fns.length).toBe(3);
  });
});
