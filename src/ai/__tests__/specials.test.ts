import { describe, expect, it } from 'vitest';
import type { Action, Difficulty, LegalAction, PublicView, SeatIndex } from '@engine/types';
import { createAI, personalityById, SPECIAL_PERSONALITIES, rosterDifficulty } from '../index';
import { doraCount, evaluateDiscards, kindOf, ownTiles, parseHand, shanten, waits } from '../handEval';
import { publicWinPoints } from '../specials';
import { racingGear, specialStatus } from '../specialStyles';
import { discardsFor, makeView, tileNotationToId } from './fixtures';

function ai(id: string, seed = 1, difficulty?: Difficulty) {
  const bot = createAI(personalityById(id), difficulty, seed);
  // Test the rule, not occasional execution noise or equivalent-choice variation.
  bot.params.efficiencyNoise = 0;
  bot.params.deviation = 0;
  return bot;
}

function winView(tsumo: boolean, rich = false, viewer: SeatIndex = 0): PublicView {
  const view = makeView({ viewer, hand: '123mPPP789p23sEE4s', doraIndicators: rich ? ['C'] : [] });
  const tile = view.hand.find((t) => kindOf(t) === kindOf(tileNotationToId('4s')))!;
  view.hand = view.hand.filter((t) => t !== tile);
  if (tsumo) view.drawnTile = tile;
  else {
    const from = ((viewer + 1) % 4) as SeatIndex;
    view.phase = 'awaitingCalls';
    view.turn = from;
    view.lastDiscard = { tile, from };
    view.seats[from].river.push({ tile, tsumogiri: true, riichiDeclaration: false, calledBy: null, turnNumber: 9 });
  }
  return view;
}

function winOffers(view: PublicView, tsumo: boolean): LegalAction[] {
  return [
    { action: { type: tsumo ? 'tsumo' : 'ron', seat: view.viewer }, label: 'Win' },
    ...(tsumo ? discardsFor(view) : [{ action: { type: 'pass', seat: view.viewer } as Action, label: 'Pass' }]),
  ];
}

const assertLegal = (choice: Action, legal: LegalAction[]) =>
  expect(legal.some((l) => JSON.stringify(l.action) === JSON.stringify(choice))).toBe(true);

describe('Special contracts', () => {
  it('has four different rules, each explicitly Special with a strength estimate', () => {
    expect(SPECIAL_PERSONALITIES).toHaveLength(4);
    expect(new Set(SPECIAL_PERSONALITIES.map((p) => p.special!.style)).size).toBe(4);
    for (const p of SPECIAL_PERSONALITIES) {
      expect(rosterDifficulty(p)).toBe('special');
      expect(p.special!.estimatedDifficulty).toBeTruthy();
      expect(p.special!.rule).toBeTruthy();
    }
  });

  it('never invents a pass when the engine offers only one forced action', () => {
    const view = winView(true);
    for (const p of SPECIAL_PERSONALITIES) {
      for (const action of [
        { type: 'draw', seat: 0 }, { type: 'discard', seat: 0, tile: view.drawnTile! },
        { type: 'pass', seat: 0 }, { type: 'tsumo', seat: 0 },
      ] as Action[]) {
        expect(createAI(p).decide(view, [{ action, label: 'Forced' }]).action).toEqual(action);
      }
      expect(() => createAI(p).decide(view, [])).toThrow('no legal actions');
    }
  });

  it('is deterministic, does not mutate the view, and stays legal at every practice level', () => {
    const view = makeView({ hand: '234m567p789p23sEEN' });
    const legal = discardsFor(view);
    const before = JSON.stringify(view);
    for (const p of SPECIAL_PERSONALITIES) for (const level of ['easy', 'normal', 'hard'] as const) {
      const first = createAI(p, level, 66).decide(view, legal);
      expect(first).toEqual(createAI(p, level, 66).decide(structuredClone(view), legal));
      assertLegal(first.action, legal);
    }
    expect(JSON.stringify(view)).toBe(before);
  });
});

describe('Nugget: actively playing against itself', () => {
  it('chooses the worst shanten, not merely a random or second-best discard', () => {
    const view = makeView({ hand: '234m567p789p23sEEN' });
    const legal = discardsFor(view);
    const evaluations = evaluateDiscards(ownTiles(view), [], view.visibleCounts);
    const best = Math.min(...evaluations.map((e) => e.shanten));
    const worst = Math.max(...evaluations.map((e) => e.shanten));
    expect(worst).toBeGreaterThan(best);
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const result = ai('nugget', 1, level).decide(view, legal);
      expect(result.action.type).toBe('discard');
      const tile = (result.action as Extract<Action, { type: 'discard' }>).tile;
      expect(evaluations.find((e) => e.kind === kindOf(tile))!.shanten).toBe(worst);
      expect(kindOf(tile)).not.toBe(30); // keeps the useless North instead of the good shape
      assertLegal(result.action, legal);
    }
  });

  it('throws the red copy away when equally damaging copies are offered', () => {
    const view = makeView({ hand: '05m123p456p789sEEN' });
    const legal: LegalAction[] = [17, 16].map((tile) => ({ action: { type: 'discard', seat: 0, tile }, label: 'Five' }));
    expect(ai('nugget').decide(view, legal).action).toEqual(legal[1].action);
  });

  it('refuses ron and tsumo, even a mangan, at every execution level', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) for (const tsumo of [false, true]) {
      const view = winView(tsumo, true);
      const legal = winOffers(view, tsumo);
      const result = ai('nugget', 5, level).decide(view, legal);
      expect(result.action.type).toBe(tsumo ? 'discard' : 'pass');
      assertLegal(result.action, legal);
    }
  });

  it('passes helpful calls and never selects a voluntary riichi', () => {
    const view = makeView({ hand: '123mPP456p23sEE9s' });
    view.lastDiscard = { tile: 126, from: 3 };
    const calls: LegalAction[] = [
      { action: { type: 'pon', seat: 0, tiles: [124, 125] }, label: 'Pon' },
      { action: { type: 'pass', seat: 0 }, label: 'Pass' },
    ];
    expect(ai('nugget').decide(view, calls).action.type).toBe('pass');
    const ready = makeView({ hand: '234m567p789p23sEEN' });
    const legal = discardsFor(ready);
    legal.unshift({ action: { type: 'discard', seat: 0, tile: 120, riichi: true }, label: 'Riichi' });
    const result = ai('nugget').decide(ready, legal);
    expect(result.action.type === 'discard' && result.action.riichi).not.toBe(true);
  });
});

describe('Mr. Shakedown: visible mangan or nothing', () => {
  it('rejects small ron and tsumo, but accepts visible mangan as dealer and non-dealer', () => {
    for (const viewer of [0, 1] as const) for (const tsumo of [false, true]) {
      const minimum = viewer === 0 ? 12000 : 8000;
      const cheap = winView(tsumo, false, viewer);
      const rich = winView(tsumo, true, viewer);
      const cheapOffers = winOffers(cheap, tsumo);
      const richOffers = winOffers(rich, tsumo);
      expect(publicWinPoints(cheap, cheapOffers[0].action)).toBeLessThan(minimum);
      expect(publicWinPoints(rich, richOffers[0].action)).toBeGreaterThanOrEqual(minimum);
      const declined = ai('shakedown').decide(cheap, cheapOffers);
      expect(declined.action.type).toBe(tsumo ? 'discard' : 'pass');
      expect(ai('shakedown').decide(rich, richOffers).action).toEqual(richOffers[0].action);
      assertLegal(declined.action, cheapOffers);
    }
  });

  it('does not let sticks, honba or an imagined ura bonus meet the floor', () => {
    const view = winView(false, false, 1);
    const legal = winOffers(view, false);
    const points = publicWinPoints(view, legal[0].action);
    view.honba = 30;
    view.riichiSticks = 30;
    // This extra field is deliberately NOT part of PublicView; it must be ignored.
    Object.assign(view, { uraIndicators: parseHand('CCCC') });
    expect(publicWinPoints(view, legal[0].action)).toBe(points);
    expect(ai('shakedown').decide(view, legal).action.type).toBe('pass');
  });

  it('does not mistake a first discard after a call for double riichi', () => {
    const view = winView(false, false, 1);
    view.seats[1].riichi = true;
    view.seats[1].river = [{ tile: 120, tsumogiri: false, riichiDeclaration: false, calledBy: null, turnNumber: 12 }];
    const ron = winOffers(view, false)[0].action;
    const ordinaryRiichi = publicWinPoints(view, ron);
    view.seats[1].river[0].riichiDeclaration = true;
    expect(publicWinPoints(view, ron)).toBe(ordinaryRiichi);
  });

  it('does not price a kan reaction using a stale last-discard tile', () => {
    const view = winView(false, true);
    const legal = winOffers(view, false);
    expect(publicWinPoints(view, legal[0].action)).toBeGreaterThanOrEqual(12000);
    view.turn = 2; // a different seat is now offering an added kan
    expect(publicWinPoints(view, legal[0].action)).toBe(0);
    expect(ai('shakedown').decide(view, legal).action.type).toBe('pass');
  });

  it('actually gives up a shanten tier to keep a two-dora stash', () => {
    const view = makeView({ hand: '234m567p789p23sEEN', doraIndicators: ['W', '3m'] });
    const legal = discardsFor(view);
    expect(evaluateDiscards(ownTiles(view), [], view.visibleCounts)[0].shanten).toBe(0);
    const result = ai('shakedown').decide(view, legal);
    const tile = (result.action as Extract<Action, { type: 'discard' }>).tile;
    const kept = ownTiles(view).filter((t) => t !== tile);
    expect(kindOf(tile)).not.toBe(30); // discarding the lone North would be the fast route
    expect(shanten(kept)).toBe(1);
    expect(doraCount(kept, [], view.doraIndicators, view.settings.redDora)).toBe(2);
    assertLegal(result.action, legal);
  });

  it('keeps the same payout floor under practice-level overrides', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const view = winView(false);
      expect(ai('shakedown', 1, level).decide(view, winOffers(view, false)).action.type).toBe('pass');
    }
  });
});

describe('Komaki: Tiger Drop counters', () => {
  it('takes even a cheap legal ron but declines tsumo at all practice levels', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const ron = winView(false);
      const tsumo = winView(true, true);
      expect(ai('komaki', 1, level).decide(ron, winOffers(ron, false)).action.type).toBe('ron');
      const result = ai('komaki', 1, level).decide(tsumo, winOffers(tsumo, true));
      expect(result.action.type).toBe('discard');
      assertLegal(result.action, winOffers(tsumo, true));
    }
  });

  it('never opens, declares a kan, or declares riichi', () => {
    const view = makeView({ hand: 'EEEE123m456p23sSS' });
    const calls: LegalAction[] = [
      { action: { type: 'pon', seat: 0, tiles: [108, 109] }, label: 'Pon' },
      { action: { type: 'pass', seat: 0 }, label: 'Pass' },
    ];
    expect(ai('komaki').decide(view, calls).action.type).toBe('pass');
    const legal = discardsFor(view);
    legal.unshift({ action: { type: 'ankan', seat: 0, kind: 27 }, label: 'Kan' });
    legal.unshift({ action: { type: 'discard', seat: 0, tile: 111, riichi: true }, label: 'Riichi' });
    const chosen = ai('komaki').decide(view, legal).action;
    expect(chosen.type).toBe('discard');
    expect(chosen.type === 'discard' && chosen.riichi).not.toBe(true);
  });

  it('keeps a natural-yaku ron wait when it is available', () => {
    const view = makeView({ hand: '123mPPP789p23sEEN' });
    const result = ai('komaki').decide(view, discardsFor(view));
    const tile = (result.action as Extract<Action, { type: 'discard' }>).tile;
    expect(kindOf(tile)).toBe(30); // North out, keep the yakuhai-backed 1s/4s wait
    expect(result.rationale).toContain('live ron tiles');
  });

  it('breaks a furiten ready hand to rebuild a usable counter on the next draw', () => {
    const view = makeView({ hand: '123mPPP789p23sEEN', seats: { 0: { river: ['4s'] } } });
    const legal = discardsFor(view);
    const result = ai('komaki').decide(view, legal);
    const tile = (result.action as Extract<Action, { type: 'discard' }>).tile;
    const waiting = ownTiles(view).filter((t) => t !== tile);
    expect(shanten(waiting)).toBe(1);
    expect(result.rationale).toContain('rebuild the ron wait');
    assertLegal(result.action, legal);
  });
});

describe('Pocket Circuit Fighter: a public, predictable gear cycle', () => {
  it('alternates three attacking discards and three pit stops, resetting each hand', () => {
    expect(Array.from({ length: 8 }, (_, i) => racingGear(i).attack)).toEqual([true, true, true, false, false, false, true, true]);
    expect(racingGear(0).label).toBe('Redline 1/3');
    expect(racingGear(3).label).toBe('Pit stop 1/3');
    expect(racingGear(5).label).toBe('Pit stop 3/3');
    expect(racingGear(6).label).toBe('Redline 1/3');
    const view = makeView({ hand: '234m567p789p23sEEN' });
    view.seats[0].riichi = true;
    expect(specialStatus('gearShift', view.seats[0])).toBe('Riichi locked');
  });

  it('attacks through danger in redline, but deliberately folds in the pit stop', () => {
    const attack = makeView({ hand: '234m567p789p23sEEN', seats: {
      1: { riichi: true, river: ['4m'], riichiTurn: 50 },
    } });
    const pit = makeView({ hand: '234m567p789p23sEEN', seats: {
      0: { river: ['1p', '9m', 'W'] }, 1: { riichi: true, river: ['4m'], riichiTurn: 50 },
    } });
    const redline = ai('pocket-fighter').decide(attack, discardsFor(attack));
    const cooling = ai('pocket-fighter').decide(pit, discardsFor(pit));
    expect(kindOf((redline.action as Extract<Action, { type: 'discard' }>).tile)).toBe(30);
    expect(kindOf((cooling.action as Extract<Action, { type: 'discard' }>).tile)).toBe(3);
    expect(redline.rationale).toContain('Redline');
    expect(cooling.rationale).toContain('Pit stop');
  });

  it('makes useful calls in redline and passes every call in a pit stop', () => {
    const make = (pit: boolean) => {
      const view = makeView({ hand: '123mPP456p23sEE9s', seats: pit ? { 0: { river: ['1p', '9m', 'W'] } } : {} });
      view.phase = 'awaitingCalls';
      view.lastDiscard = { tile: 126, from: 3 };
      view.visibleCounts[31]++;
      return view;
    };
    const legal: LegalAction[] = [
      { action: { type: 'pon', seat: 0, tiles: [124, 125] }, label: 'Pon' },
      { action: { type: 'pass', seat: 0 }, label: 'Pass' },
    ];
    let calls = 0;
    for (let seed = 1; seed <= 20; seed++) {
      if (ai('pocket-fighter', seed).decide(make(false), legal).action.type === 'pon') calls++;
      expect(ai('pocket-fighter', seed).decide(make(true), legal).action.type).toBe('pass');
    }
    expect(calls).toBeGreaterThan(10);
  });

  it('always takes wins even during a pit stop', () => {
    for (const tsumo of [true, false]) {
      const view = winView(tsumo);
      view.seats[view.viewer].river = Array.from({ length: 3 }, (_, i) => ({
        tile: 32 + i, tsumogiri: false, riichiDeclaration: false, calledBy: null, turnNumber: i,
      }));
      const legal = winOffers(view, tsumo);
      expect(ai('pocket-fighter').decide(view, legal).action).toEqual(legal[0].action);
    }
  });
});
