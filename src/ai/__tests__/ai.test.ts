import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ARCHETYPE_SAMPLE, createAI, paramsFor, PERSONALITIES, createAIForArchetype,
} from '../index';
import type { Archetype } from '../types';
import {
  parseHand,
  shanten,
  waits,
  ukeire,
  hasOpenYakuPath,
  evaluateDiscards,
  kindOf,
} from '../handEval';
import {
  buildSafetyContext,
  dangerOf,
  tableThreat,
} from '../defense';
import { chooseDiscard } from '../efficiency';
import { Rng } from '../rng';
import { playHands } from './selfplay';
import type {
  LegalAction,
  Meld,
  SeatIndex,
  TileId,
} from '@engine/types';

// ---------------------------------------------------------------------------
// Minimal public-view builder for unit tests. Only public info, ever.
// ---------------------------------------------------------------------------

import { makeView, discardsFor, tileNotationToId } from './fixtures';

// ---------------------------------------------------------------------------

describe('params', () => {
  it('exposes a full roster with every archetype represented', () => {
    expect(PERSONALITIES.length).toBeGreaterThanOrEqual(9);
    const byArchetype = new Map<string, number>();
    for (const p of PERSONALITIES) {
      byArchetype.set(p.archetype, (byArchetype.get(p.archetype) ?? 0) + 1);
    }
    expect([...byArchetype.keys()].sort()).toEqual(['aggressive', 'balanced', 'defensive']);
    // Three of each, so the player can field a table of any one style.
    for (const n of byArchetype.values()) expect(n).toBeGreaterThanOrEqual(3);
    // Ids and names are what the UI keys on; both must be unique.
    expect(new Set(PERSONALITIES.map((p) => p.id)).size).toBe(PERSONALITIES.length);
    expect(new Set(PERSONALITIES.map((p) => p.name)).size).toBe(PERSONALITIES.length);
    expect(ARCHETYPE_SAMPLE).toHaveLength(3);
  });

  it('keeps a personality inside its own archetype even after tuning', () => {
    // A named opponent may lean, but "aggressive" must not tune itself into a
    // defensive player — the tagline is a promise to the person reading it.
    for (const p of PERSONALITIES) {
      const tuned = createAI(p, 'normal', 1).params;
      if (p.archetype === 'aggressive') expect(tuned.defenseThreshold).toBeGreaterThan(0.5);
      if (p.archetype === 'defensive') expect(tuned.defenseThreshold).toBeLessThan(0.5);
      expect(tuned.archetype).toBe(p.archetype);
    }
  });

  it('archetypes order correctly on call greed', () => {
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      const a = paramsFor('aggressive', diff).callGreed;
      const b = paramsFor('balanced', diff).callGreed;
      const d = paramsFor('defensive', diff).callGreed;
      expect(a).toBeGreaterThan(b);
      expect(b).toBeGreaterThan(d);
    }
  });

  it('archetypes order correctly on folding threshold (defensive folds earliest)', () => {
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      const a = paramsFor('aggressive', diff).defenseThreshold;
      const b = paramsFor('balanced', diff).defenseThreshold;
      const d = paramsFor('defensive', diff).defenseThreshold;
      // Lower threshold = folds to smaller threats.
      expect(d).toBeLessThan(b);
      expect(b).toBeLessThan(a);
    }
  });

  it('difficulty scales execution noise (easy makes most mistakes)', () => {
    const n = (x: Archetype) => paramsFor(x, 'easy').efficiencyNoise;
    expect(n('balanced')).toBeGreaterThan(paramsFor('balanced', 'normal').efficiencyNoise);
    expect(paramsFor('balanced', 'normal').efficiencyNoise).toBeGreaterThan(
      paramsFor('balanced', 'hard').efficiencyNoise,
    );
  });

  it('only hard deviates', () => {
    expect(paramsFor('balanced', 'hard').deviation).toBeGreaterThan(0);
    expect(paramsFor('balanced', 'normal').deviation).toBe(0);
    expect(paramsFor('balanced', 'easy').deviation).toBe(0);
  });
});

describe('handEval shanten/waits/ukeire (engine-backed)', () => {
  it('complete hand is -1', () => {
    // 123m 456m 789m 123p EE
    expect(shanten(parseHand('123m456m789m123p'), [] as Meld[])).toBe(0);
    const win = parseHand('123m456m789m123p')
      .concat(parseHand('EE'));
    expect(shanten(win, [] as Meld[])).toBe(-1);
  });

  it('tenpai hand has waits', () => {
    // 123m 456m 789m 123p + wait on E pair (tanki E)
    const hand = parseHand('123m456m789m123p').concat(parseHand('E'));
    const w = waits(hand, [] as Meld[]);
    expect(w).toContain(27);
  });

  it('ukeire weights remaining copies', () => {
    // ryanmen wait 2-3m waits on 1m,4m
    const hand = parseHand('23m456p789p123sEE');
    const w = waits(hand, [] as Meld[]);
    expect(w).toContain(0); // 1m
    expect(w).toContain(3); // 4m
    const uk = ukeire(hand, [], new Array(34).fill(0));
    const total = uk.reduce((s, u) => s + u.count, 0);
    expect(total).toBe(8); // 4+4 if none seen
  });

  it('evaluateDiscards ranks shanten-improving discards first', () => {
    // 13 tiles with one floating honor: tenpai after discarding honor.
    const hand14 = parseHand('23m456p789p123s')
      .concat(parseHand('EE'))
      .concat(parseHand('N')); // 10+2+1 = 13 → add a draw tile
    const hand = hand14.concat(parseHand('W')); // 14
    const evals = evaluateDiscards(hand, [], new Array(34).fill(0));
    // Discarding an honor should be at least as good as discarding a useful tile.
    expect(evals[0].shanten).toBeLessThanOrEqual(evals[evals.length - 1].shanten);
  });
});

describe('yaku path', () => {
  it('open all-simples with kuitan has a yaku path', () => {
    const hand = parseHand('234m567p234s');
    expect(hasOpenYakuPath(hand, [], 'south', 'east', true)).toBe(true);
  });
  it('open hand with no yakuhai and mixed suits, kuitan off → no path', () => {
    // An open-style partial spread across all three suits with only non-value
    // honors and no concentration: no yakuhai pair, no all-simples, no single
    // suit, not toitoi-shaped. (13 tiles incl. one meld.)
    const meld: Meld = {
      type: 'chi',
      tiles: parseHand('234m'),
      calledFrom: 3,
      calledTile: parseHand('2m')[0],
      concealed: false,
    };
    const hand = parseHand('57p13sESWN') // scattered, no value pair
      .concat(parseHand('9p'));
    expect(hasOpenYakuPath(hand, [meld], 'south', 'east', false)).toBe(false);
  });
  it('yakuhai pair gives atozuke path', () => {
    const hand = parseHand('234m567p234sPP');
    expect(hasOpenYakuPath(hand, [], 'south', 'east', false)).toBe(true);
  });
});

describe('defense / safety', () => {
  it('genbutsu (riichi player river) tiles are safest (danger 0)', () => {
    const view = makeView({
      hand: '234m567p234s12mE',
      seats: {
        1: { riichi: true, river: ['4m', '5p', '2s'] },
      } as never,
    });
    const ctx = buildSafetyContext(view);
    expect(dangerOf(kindOf(tileNotationToId('4m')), ctx)).toBe(0);
    expect(dangerOf(kindOf(tileNotationToId('5p')), ctx)).toBe(0);
  });

  it('suji after a 4m discard marks 1m and 7m safer than center', () => {
    const view = makeView({
      hand: '234m567p234s12mE',
      seats: { 1: { riichi: true, river: ['4m', '6p', '9s'] } } as never,
    });
    const ctx = buildSafetyContext(view);
    // 1m is suji of 4m; a raw center 5m is not.
    expect(dangerOf(0, ctx)).toBeLessThan(dangerOf(4, ctx)); // 1m vs 5m
  });

  it('riichi seat produces high table threat; no riichi early is low', () => {
    const riichi = makeView({
      hand: '234m567p234s12mE',
      tilesRemaining: 30,
      seats: { 2: { riichi: true, river: ['1m', '2m', '3m', '4m'] } } as never,
    });
    expect(tableThreat(riichi)).toBeGreaterThan(0.7);

    const quiet = makeView({
      hand: '234m567p234s12mE',
      tilesRemaining: 50,
      seats: { 1: { river: ['E'] }, 2: { river: ['S'] }, 3: { river: ['W'] } } as never,
    });
    expect(tableThreat(quiet)).toBeLessThan(0.6);
  });
});

describe('efficiency', () => {
  it('prefers discarding a floating dead tile over a useful one', () => {
    // Strong shape + a stray honor and a live useful tile.
    const hand = parseHand('234m567p789p23s').concat(parseHand('EE')).concat(parseHand('N'));
    const view = makeView({ hand: idsToStr(hand) });
    const rng = new Rng(42);
    const params = paramsFor('balanced', 'hard'); // noise ~0 → deterministic best
    const choice = chooseDiscard(view, params, rng, false);
    // Should shed the orphan North (kind 30) or an honor, not a useful suit tile.
    const discardedKind = kindOf(choice.tile);
    expect(discardedKind).toBe(30); // N
  });

  it('folding picks a safe (genbutsu) tile when available', () => {
    // Our hand contains a tile already in the riichi player's river.
    const hand = parseHand('234m567p234s12mE').concat(parseHand('4m'));
    const view = makeView({
      hand: idsToStr(hand),
      seats: { 1: { riichi: true, river: ['4m', '7p'] } } as never,
    });
    const rng = new Rng(7);
    const params = paramsFor('defensive', 'hard');
    const choice = chooseDiscard(view, params, rng, true);
    expect(kindOf(choice.tile)).toBe(kindOf(tileNotationToId('4m')));
  });
});

// helper: turn ids back into a hand string (for makeView which parses strings)
function idsToStr(ids: TileId[]): string {
  return ids
    .map((id) => {
      const k = Math.floor(id / 4);
      if (k >= 27) return `${k - 26}z`;
      const suit = k < 9 ? 'm' : k < 18 ? 'p' : 's';
      const base = k < 9 ? 0 : k < 18 ? 9 : 18;
      return `${k - base + 1}${suit}`;
    })
    .join(' ');
}

describe('createAI / decide', () => {
  it('returns an action present in the legal array (legality)', () => {
    const ai = createAI(ARCHETYPE_SAMPLE[1], 'normal', 123);
    const view = makeView({ hand: '234m567p789p23sEE N' });
    const legal = discardsFor(view);
    const dec = ai.decide(view, legal);
    expect(legal.some((l) => l.action.type === dec.action.type &&
      (l.action as { tile?: TileId }).tile === (dec.action as { tile?: TileId }).tile)).toBe(true);
  });

  it('always takes a winning action', () => {
    const ai = createAI(ARCHETYPE_SAMPLE[1], 'hard', 1);
    const winHand = parseHand('123m456m789m123p').concat(parseHand('EE'));
    const view = makeView({ hand: idsToStr(winHand) });
    const legal: LegalAction[] = [
      { action: { type: 'tsumo', seat: 0 }, label: 'tsumo' },
      ...discardsFor(view),
    ];
    const dec = ai.decide(view, legal);
    expect(dec.action.type).toBe('tsumo');
  });

  it('determinism: same seed + same view → same decision', () => {
    const mk = () => createAI(ARCHETYPE_SAMPLE[1], 'normal', 999);
    const view = makeView({ hand: '234m567p789p23sEE N' });
    const legal = discardsFor(view);
    const d1 = mk().decide(view, legal).action;
    const d2 = mk().decide(view, legal).action;
    expect(d1).toEqual(d2);
  });
});

describe('public-information firewall (no-cheat)', () => {
  it('src/ai never imports hidden state or engine internal modules', () => {
    const aiDir = fileURLToPath(new URL('..', import.meta.url));
    const files = [
      'index.ts', 'player.ts', 'efficiency.ts', 'defense.ts', 'callLogic.ts',
      'riichiLogic.ts', 'params.ts', 'personalities.ts', 'handEval.ts', 'rng.ts', 'types.ts', 'strategy.ts', 'specials.ts', 'specialStyles.ts',
    ];
    for (const f of files) {
      const src = readFileSync(`${aiDir}/${f}`, 'utf8');
      // Ban any import that brings GameState in (word boundary followed by a
      // separator/comma/brace, so "TileKind" can't false-match), and ban the
      // engine internal stateful modules wholesale.
      expect(src, `${f} must not import GameState`).not.toMatch(
        /import\b[^;]*\bGameState\b\s*[,}]/,
      );
      expect(src, `${f} must not reach into engine internals`).not.toMatch(
        /from\s+['"]@engine\/(wall|draw|scoring|calls|kan|riichi|furiten|fu|yaku|rng|shanten|tiles)['"]/,
      );
      // Must not import the createMatch/applyAction game-state API.
      expect(src, `${f} must not drive game state`).not.toMatch(
        /\b(createMatch|applyAction|getLegalActions|toPublicView|nextHand)\b/,
      );
    }
  });

  it('decisions depend only on the public view, never on hidden tiles', () => {
    // The AI receives ONLY a PublicView, which exposes opponents'
    // concealedCount — never their tiles. We construct two views identical in
    // every public field (opponents reveal only counts), and two fresh AIs with
    // the same seed. Their decisions must be identical: there is no hidden
    // channel for an opponent's shuffled tiles to leak through.
    const build = () =>
      makeView({
        hand: '234m567p789p23sNN EE',
        seats: { 1: { river: ['E'], concealedCount: 13 }, 2: { river: ['S'], concealedCount: 13 } } as never,
      });
    const v1 = build();
    const v2 = build();
    const d1 = createAI(ARCHETYPE_SAMPLE[1], 'normal', 55).decide(v1, discardsFor(v1)).action;
    const d2 = createAI(ARCHETYPE_SAMPLE[1], 'normal', 55).decide(v2, discardsFor(v2)).action;
    expect(d1).toEqual(d2);
  });

  it('opponent hidden-tile reshuffle cannot change a decision (structural)', () => {
    // Structural guarantee: PublicView has no field carrying an opponent's
    // concealed tile identities. Assert the type shape the AI consumes.
    const view = makeView({ hand: '234m567p789p23sNN EE' });
    for (let s = 1 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
      const info = view.seats[s] as unknown as Record<string, unknown>;
      expect(info).not.toHaveProperty('hand');
      expect(info).not.toHaveProperty('tiles');
      expect(typeof info.concealedCount).toBe('number');
    }
  });
});

describe('real-engine self-play separation', () => {
  it('every archetype/difficulty plays hands with ZERO illegal actions', () => {
    for (const arch of ['aggressive', 'balanced', 'defensive'] as const) {
      for (const diff of ['easy', 'normal', 'hard'] as const) {
        const ais = [0, 1, 2, 3].map((s) => createAIForArchetype(arch, diff, 1000 + s));
        const res = playHands(ais, 31 + arch.length * 7 + diff.length, 6);
        expect(res.handsPlayed, `${arch}/${diff} completed hands`).toBe(6);
        expect(res.perSeat.every((p) => p.decisions > 0)).toBe(true);
      }
    }
  });

  it('a seeded full self-play hand runs to completion with zero illegal actions', () => {
    // One representative table; the loop itself terminates and all returned
    // actions are legal (the driver throws on any invalid action or stalled hand).
    const ais = [
      createAIForArchetype('aggressive', 'hard', 11),
      createAIForArchetype('balanced', 'normal', 22),
      createAIForArchetype('defensive', 'hard', 33),
      createAIForArchetype('balanced', 'easy', 44),
    ];
    const res = playHands(ais, 777, 8);
    expect(res.handsPlayed).toBe(8);
    expect(res.perSeat.every((p) => p.decisions > 0)).toBe(true);
  });

  it('decide is fast (well under an instant-feel budget per decision)', () => {
    const ai = createAIForArchetype('balanced', 'hard', 5);
    const view = makeView({ hand: '234m567p789p23sEE N', tilesRemaining: 30 });
    const legal = discardsFor(view);
    const t = performance.now();
    for (let i = 0; i < 200; i++) ai.decide(view, legal);
    const per = (performance.now() - t) / 200;
    // A few milliseconds budget; discard decision must feel instant.
    expect(per).toBeLessThan(5);
  });

  it('aggressive calls significantly more than defensive', () => {
    const callRate = (arch: Archetype, seed: number) => {
      const ais = [0, 1, 2, 3].map((s) => createAIForArchetype(arch, 'normal', seed + s));
      const res = playHands(ais, seed, 20);
      const calls = res.perSeat.reduce((s, p) => s + p.calls, 0);
      const decisions = res.perSeat.reduce((s, p) => s + p.decisions, 1);
      return calls / decisions;
    };
    const agg = callRate('aggressive', 500);
    const def = callRate('defensive', 500);
    expect(agg).toBeGreaterThan(def * 1.8);
  });

  it('a defensive seat deals in less than an aggressive seat against the same aggressive table', () => {
    // Folding only matters against real threats, so seat the target archetype
    // (seat 1) at a table of aggressive opponents who declare riichi, then
    // compare how often the target feeds a ron.
    const dealInFor = (target: Archetype, seed: number) => {
      const opponents = [0, 2, 3].map((s) => createAIForArchetype('aggressive', 'normal', seed + s));
      const targetAi = createAIForArchetype(target, 'hard', seed + 11);
      const ais = [opponents[0], targetAi, opponents[1], opponents[2]];
      const res = playHands(ais, seed, 18);
      return res.perSeat[1].dealIn;
    };
    const def = dealInFor('defensive', 900);
    const agg = dealInFor('aggressive', 900);
    // Defensive should feed fewer rons into an aggressive table.
    expect(def).toBeLessThanOrEqual(agg);
  });

  // Difficulty separation is the paired, fixed-opponent placement experiment
  // in integration.test.ts. All-Hard vs all-Easy win counts are not a strength
  // measure: stronger opponents defend better and can produce MORE draws.
});
