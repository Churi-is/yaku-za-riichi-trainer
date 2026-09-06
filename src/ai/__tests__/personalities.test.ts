import { describe, expect, it } from 'vitest';
import { createAI, PERSONALITIES, REGULAR_PERSONALITIES, SPECIAL_PERSONALITIES, paramsFor, personalityById } from '../index';
import { buildSafetyContext, dangerOf, seatThreat } from '../defense';
import { chooseDiscard } from '../efficiency';
import { chooseCall, chooseSelfKan } from '../callLogic';
import { damaValue, shouldRiichi } from '../riichiLogic';
import { shouldFold } from '../player';
import { directionReluctance, flushDirection, placementPressure } from '../strategy';
import { doraCount, evaluateDiscards, kindOf, meldCounts, ownTiles, parseHand, waits } from '../handEval';
import { Rng } from '../rng';
import { makeView, discardsFor, tileNotationToId } from './fixtures';
import type { AIParams } from '../types';
import type { LegalAction, Meld } from '@engine/types';

const precise = (patch: Partial<AIParams> = {}): AIParams => ({
  ...paramsFor('balanced', 'hard'), efficiencyNoise: 0, deviation: 0, ...patch,
});

const pon = (hand: string): Meld => ({
  type: 'pon', tiles: parseHand(hand), concealed: false, calledFrom: 3, calledTile: parseHand(hand)[0],
});

describe('Yakuza character roster', () => {
  it('has 22 unique characters: 18 regulars, six per level, plus four Specials', () => {
    expect(PERSONALITIES).toHaveLength(22);
    expect(REGULAR_PERSONALITIES).toHaveLength(18);
    expect(SPECIAL_PERSONALITIES).toHaveLength(4);
    expect(new Set(PERSONALITIES.map((p) => p.id)).size).toBe(22);
    expect(new Set(PERSONALITIES.map((p) => p.name)).size).toBe(22);
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const group = REGULAR_PERSONALITIES.filter((p) => p.difficulty === level);
      expect(group).toHaveLength(6);
      expect(new Set(group.map((p) => p.archetype)).size).toBe(3);
    }
    for (const p of PERSONALITIES) {
      expect(p.tagline.length).toBeGreaterThan(50);
      expect(p.tell.length).toBeGreaterThan(20);
      expect(p.title).toBeTruthy();
    }
  });

  it('defaults to native execution and scales every tuned character correctly', () => {
    for (const p of PERSONALITIES) {
      expect(createAI(p).params).toEqual(paramsFor(p.archetype, p.difficulty, p.tune));
      const easy = createAI(p, 'easy').params;
      const medium = createAI(p, 'normal').params;
      const hard = createAI(p, 'hard').params;
      expect(easy.efficiencyNoise, p.id).toBeGreaterThan(medium.efficiencyNoise);
      expect(medium.efficiencyNoise, p.id).toBeGreaterThan(hard.efficiencyNoise);
      expect(hard.flushBias).toBe(easy.flushBias); // practice override keeps identity
      for (const [key, value] of Object.entries(hard)) {
        if (key !== 'archetype') { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
      }
    }
    const noise = (level: string) => REGULAR_PERSONALITIES.filter((p) => p.difficulty === level).map((p) => createAI(p).params.efficiencyNoise);
    expect(Math.min(...noise('easy'))).toBeGreaterThan(Math.max(...noise('normal')));
    expect(Math.min(...noise('normal'))).toBeGreaterThan(Math.max(...noise('hard')));
  });

  it('keeps all native personalities deterministic, legal and public-view-only', () => {
    const view = makeView({ hand: '234m567p789p23sEEN' });
    const before = JSON.stringify(view);
    const legal = discardsFor(view);
    for (const p of PERSONALITIES) {
      const a = createAI(p, undefined, 81).decide(view, legal);
      const b = createAI(p, undefined, 81).decide(structuredClone(view), legal);
      expect(a, p.id).toEqual(b);
      expect(legal.some((l) => JSON.stringify(l.action) === JSON.stringify(a.action)), p.id).toBe(true);
      const win: LegalAction = { action: { type: 'tsumo', seat: 0 }, label: 'Win' };
      if (!p.special || p.special.style === 'gearShift') {
        expect(createAI(p).decide(view, [...legal, win]).action).toEqual(win.action);
      } // Other Specials deliberately decline some wins; covered in specials.test.ts.
    }
    expect(JSON.stringify(view)).toBe(before);
  });
});

describe('risk belongs to a seat, not the whole river', () => {
  it('does not treat a quiet player’s old discard as safe against a riichi player', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: {
      1: { riichi: true, riichiTurn: 10, river: ['1p'] },
      2: { river: ['4m'] },
    } });
    const ctx = buildSafetyContext(view);
    expect(dangerOf(3, ctx)).toBeGreaterThan(0.7);
    expect(ctx.genbutsu.has(3)).toBe(false);
  });

  it('requires safety against both riichi players', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: {
      1: { riichi: true, riichiTurn: 10, river: ['4m', 'N'] },
      2: { riichi: true, riichiTurn: 12, river: ['5p', 'N'] },
    } });
    const ctx = buildSafetyContext(view);
    expect(dangerOf(3, ctx)).toBeGreaterThan(0);
    expect(dangerOf(30, ctx)).toBe(0);
    expect(ctx.genbutsu.has(3)).toBe(false);
    expect(ctx.genbutsu.has(30)).toBe(true);
  });

  it('only adds post-riichi discards once their reaction window has resolved', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: {
      1: { riichi: true, riichiTurn: 10, river: ['1p'] },
      3: { river: ['5p'] },
    } });
    view.seats[3].river[0].turnNumber = 11;
    view.lastDiscard = { tile: tileNotationToId('5p'), from: 3 };
    view.phase = 'awaitingCalls';
    expect(dangerOf(13, buildSafetyContext(view))).toBeGreaterThan(0);
    view.phase = 'awaitingDiscard';
    expect(dangerOf(13, buildSafetyContext(view))).toBe(0);
    view.seats[3].river[0].turnNumber = 9;
    expect(dangerOf(13, buildSafetyContext(view))).toBeGreaterThan(0);
  });

  it('does not invent post-declaration safety if the declaration time is unknown', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: {
      1: { riichi: true, river: ['1p'] }, 2: { river: ['4m'] },
    } });
    view.seats[1].riichiTurn = null;
    expect(dangerOf(3, buildSafetyContext(view))).toBeGreaterThan(0);
  });

  it('knows four visible suited copies do not rule out a sequence wait', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: {
      1: { riichi: true, riichiTurn: 10, river: ['1p'] },
    } });
    view.visibleCounts[4] = 4;
    view.visibleCounts[31] = 4;
    const ctx = buildSafetyContext(view);
    expect(dangerOf(4, ctx)).toBeGreaterThan(0.5); // 5m can still complete 34m
    expect(dangerOf(31, ctx)).toBe(0); // honors cannot complete runs
  });

  it('needs both anchors for middle-tile suji and never calls suji guaranteed safe', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: {
      1: { riichi: true, riichiTurn: 10, river: ['1m'] },
    } });
    expect(dangerOf(3, buildSafetyContext(view))).toBeGreaterThan(0.7);
    view.seats[1].river.push({ ...view.seats[1].river[0], tile: tileNotationToId('7m') });
    const risk = dangerOf(3, buildSafetyContext(view));
    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(0.4);
  });

  it('reads exposed dora as extra open-hand threat', () => {
    const view = makeView({ hand: '123m789m234sEEN', seats: { 1: { melds: [pon('555p')] } } });
    const withoutDora = seatThreat(view, 1);
    view.doraIndicators = parseHand('4p');
    expect(seatThreat(view, 1)).toBeGreaterThan(withoutDora);
  });
});

describe('personality changes decisions, not the rules', () => {
  it('only favors a flush supported by the deal and compatible with open melds', () => {
    const pool = parseHand('112345667m45pSSN');
    expect(flushDirection(pool, [])).toBe(0);
    const plain = precise();
    const flush = precise({ flushBias: 1 });
    expect(directionReluctance(3, pool, [], flush)).toBeGreaterThan(directionReluctance(3, pool, [], plain));
    expect(directionReluctance(10, pool, [], flush)).toBe(0);
    expect(flushDirection(pool, [pon('333p')])).toBeNull();
    expect(flushDirection(parseHand('12345m34567p23sEE'), [])).toBeNull();
  });

  it('retains pairs only with enough pair/triplet blocks to support the plan', () => {
    const pairs = parseHand('1122m3344p567sEEN');
    expect(directionReluctance(0, pairs, [], precise({ pairBias: 1 }))).toBeGreaterThan(0);
    expect(directionReluctance(0, pairs, [], precise({ pairBias: 0 }))).toBe(0);
    expect(directionReluctance(0, parseHand('11m234p567s123mEEN'), [], precise({ pairBias: 1 }))).toBe(0);
    const chi: Meld = { ...pon('123p'), type: 'chi' };
    expect(directionReluctance(0, pairs, [chi], precise({ pairBias: 1 }))).toBe(0);
  });

  it('never sacrifices shanten for a flush or pair preference without an execution mistake', () => {
    const view = makeView({ hand: '112345667m45pSSN' });
    const best = evaluateDiscards(ownTiles(view), []).reduce((n, e) => Math.min(n, e.shanten), 99);
    for (const bias of [{ flushBias: 1 }, { pairBias: 1 }, { valueGreed: 1 }]) {
      const choice = chooseDiscard(view, precise(bias), new Rng(42), false);
      const selected = evaluateDiscards(ownTiles(view), []).find((e) => e.kind === choice.kind)!;
      expect(selected.shanten).toBe(best);
    }
  });

  it('counts meld tile ids correctly for dora and value', () => {
    const meld = pon('055p');
    expect(meldCounts([meld])[13]).toBe(3);
    expect(doraCount([], [meld], parseHand('4p'), false)).toBe(3);
    expect(doraCount([], [meld], parseHand('4p'), true)).toBe(4);
  });

  it('preserves the non-red physical discard even when red is offered first', () => {
    const view = makeView({ hand: '05m123p456p789sEEN' });
    const legal: LegalAction[] = [16, 17].map((tile) => ({ action: { type: 'discard', seat: 0, tile }, label: 'Discard' }));
    const ai = createAI(personalityById('kiryu'));
    expect(ai.decide(view, legal).action).toEqual(legal[1].action);
  });

  it('ranks only kuikae-allowed discards instead of falling back to the first offer', () => {
    const view = makeView({ hand: '234m567p789p23sEEN' });
    const allowed = ownTiles(view).filter((t) => kindOf(t) !== 30); // orphan North is forbidden
    const choice = chooseDiscard(view, precise(), new Rng(42), false, allowed);
    expect(allowed).toContain(choice.tile);
    const evaluations = evaluateDiscards(ownTiles(view), []).filter((e) => e.kind !== 30);
    expect(evaluations.find((e) => e.kind === choice.kind)!.shanten).toBe(Math.min(...evaluations.map((e) => e.shanten)));
  });

  it('keeps Majima’s variation reproducible and inside the best shanten tier', () => {
    const view = makeView({ hand: '112233m445566pWN' });
    const params = precise({ deviation: 1 });
    const a = new Rng(22);
    const b = new Rng(22);
    const best = evaluateDiscards(ownTiles(view), [])[0].shanten;
    const kinds = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const x = chooseDiscard(view, params, a, false);
      kinds.add(x.kind);
      expect(x).toEqual(chooseDiscard(view, params, b, false));
      expect(evaluateDiscards(ownTiles(view), []).find((e) => e.kind === x.kind)!.shanten).toBe(best);
    }
    expect(kinds.size).toBe(2);
  });
});

describe('kan judgment and call follow-ups', () => {
  it('makes a kan-loving personality measurably more willing to take a sound kan', () => {
    const view = makeView({ hand: 'EEEE123m456p23sSS' });
    const legal: LegalAction[] = [{ action: { type: 'ankan', seat: 0, kind: 27 }, label: 'Kan' }];
    const rate = (kanGreed: number) => Array.from({ length: 100 }, (_, seed) =>
      chooseSelfKan(view, legal, precise({ kanGreed, riichiPatience: 0 }), new Rng(seed + 1), false).action).filter(Boolean).length;
    expect(rate(1)).toBeGreaterThan(rate(0) * 3);
  });

  it('declines kans while folding, near exhaustion, or feeding a riichi threat', () => {
    const view = makeView({ hand: 'EEEE123m456p23sSS' });
    const legal: LegalAction[] = [{ action: { type: 'ankan', seat: 0, kind: 27 }, label: 'Kan' }];
    expect(chooseSelfKan(view, legal, precise(), new Rng(1), true).action).toBeNull();
    view.tilesRemaining = 8;
    expect(chooseSelfKan(view, legal, precise({ kanGreed: 1 }), new Rng(1), false).action).toBeNull();
    view.tilesRemaining = 40;
    view.seats[1].riichi = true;
    expect(chooseSelfKan(view, legal, precise(), new Rng(1), false).action).toBeNull();
  });

  it('models kakan as upgrading a pon rather than adding another meld', () => {
    const view = makeView({ hand: '123m456p23sSS', melds: [pon('EEE')] });
    view.drawnTile = 27 * 4 + 3;
    view.visibleCounts[27]++;
    const legal: LegalAction[] = [{ action: { type: 'kakan', seat: 0, tile: view.drawnTile }, label: 'Added kan' }];
    const before = JSON.stringify(view);
    const choice = chooseSelfKan(view, legal, precise({ kanGreed: 1, riichiPatience: 0 }), new Rng(1), false);
    expect(choice.action).toEqual(legal[0]);
    expect(JSON.stringify(view)).toBe(before);
  });

  it('passes rather than throwing if every follow-up is forbidden', () => {
    const view = makeView({ hand: '123m456p23sSSPEE' });
    view.lastDiscard = { tile: 27 * 4 + 3, from: 3 };
    const legal: LegalAction[] = [
      { action: { type: 'pon', seat: 0, tiles: [108, 109] }, label: 'Pon', forbiddenDiscards: Array.from({ length: 34 }, (_, k) => k) },
      { action: { type: 'pass', seat: 0 }, label: 'Pass' },
    ];
    expect(chooseCall(view, legal, precise(), new Rng(1)).action).toEqual(legal[1]);
  });
});

describe('placement and legal dama value', () => {
  it('protects a final-round lead but pushes for a needed comeback', () => {
    const view = makeView({ hand: '234m567p234s12mEEN', seats: { 1: { riichi: true, river: ['1p'] } } });
    const params = precise({ placementAwareness: 1, defenseThreshold: 0.56 });
    view.roundNumber = 4;
    for (const seat of Object.values(view.seats)) seat.points = seat.seat === 0 ? 49000 : 17000;
    expect(placementPressure(view, params)).toBeLessThan(0);
    expect(shouldFold(view, params, 1)).toBe(true);
    for (const seat of Object.values(view.seats)) seat.points = seat.seat === 0 ? 10000 : 30000;
    expect(placementPressure(view, params)).toBeGreaterThan(0);
    expect(shouldFold(view, params, 1)).toBe(false);
    view.settings.gameLength = 'hanchan'; // East 4 is not all-last in a hanchan
    expect(placementPressure(view, params)).toBe(0);
    view.roundWind = 'south';
    expect(placementPressure(view, params)).toBeGreaterThan(0);
  });

  it('does not mistake three dora for a legal dama hand', () => {
    const view = makeView({ hand: '123m444p789sEE45mN', doraIndicators: ['3p'] });
    const discard = view.hand.find((t) => kindOf(t) === 30)!;
    const waiting = view.hand.filter((t) => t !== discard);
    expect(doraCount(waiting, [], view.doraIndicators, true)).toBe(3);
    expect(damaValue(view, waiting, waits(waiting), discard)).toBe(0);
    expect(shouldRiichi(view, precise({ riichiPatience: 0.9 }), new Rng(1), discard).riichi).toBe(true);
  });

  it('keeps a genuinely valuable legal hand in dama for patient characters', () => {
    const view = makeView({ hand: '123mEEE789sPP45mN', doraIndicators: ['N'] });
    const discard = view.hand.find((t) => kindOf(t) === 30)!;
    const waiting = view.hand.filter((t) => t !== discard);
    expect(damaValue(view, waiting, waits(waiting), discard)).toBeGreaterThan(0);
    expect(shouldRiichi(view, precise({ riichiPatience: 0.9 }), new Rng(1), discard).riichi).toBe(false);
  });

  it('respects the two-han minimum even when a one-yaku hand carries dora', () => {
    const view = makeView({ hand: '123mPPP789sEE45mN', doraIndicators: ['C'] });
    const discard = view.hand.find((t) => kindOf(t) === 30)!;
    const waiting = view.hand.filter((t) => t !== discard);
    expect(damaValue(view, waiting, waits(waiting), discard)).toBeGreaterThan(0);
    view.settings.twoHanMinimum = true;
    expect(damaValue(view, waiting, waits(waiting), discard)).toBe(0);
  });
});
