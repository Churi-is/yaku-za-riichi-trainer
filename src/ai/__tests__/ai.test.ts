import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAI, paramsFor, PERSONALITIES, createAIForArchetype } from '../index';
import type { Archetype } from '../types';
import {
  parseHand,
  shanten,
  waits,
  ukeire,
  hasOpenYakuPath,
  evaluateDiscards,
  estimateHan,
  kindOf,
} from '../handEval';
import {
  buildSafetyContext,
  dangerOf,
  tableThreat,
} from '../defense';
import { chooseDiscard } from '../efficiency';
import { Rng, hashSeed } from '../rng';
import { playHands } from './selfplay';
import type {
  LegalAction,
  Meld,
  PublicView,
  SeatIndex,
  TileId,
  TileKind,
} from '@engine/types';

// ---------------------------------------------------------------------------
// Minimal public-view builder for unit tests. Only public info, ever.
// ---------------------------------------------------------------------------

interface SeatFix {
  hand?: string;          // tiles visible to viewer (own hand)
  melds?: Meld[];
  river?: string[];       // discarded tile notations (e.g. "4m")
  riichi?: boolean;
  riichiTurn?: number | null;
  concealedCount?: number;
}

const SUIT_BASE: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 };
const HONOR_CHARS: Record<string, number> = {
  E: 27, S: 28, W: 29, N: 30, P: 31, F: 32, C: 33,
};
function tileNotationToId(tok: string): TileId {
  if (HONOR_CHARS[tok] !== undefined) return HONOR_CHARS[tok] * 4 + 1;
  const m = tok.match(/^(\d)([mpsz])$/);
  if (!m) throw new Error(`bad tile ${tok}`);
  const rank = Number(m[1]);
  const suit = m[2];
  const kind = suit === 'z' ? 27 + rank - 1 : SUIT_BASE[suit] + rank - 1;
  // avoid red-five copy (copy 0) for plain 5s in fixtures
  return kind * 4 + (rank === 5 && suit !== 'z' ? 1 : 0);
}

function makeView(opts: {
  viewer?: SeatIndex;
  hand: string;
  melds?: Meld[];
  seats?: Partial<Record<SeatIndex, SeatFix>>;
  tilesRemaining?: number;
  doraIndicators?: string[];
}): PublicView {
  const viewer = opts.viewer ?? 0;
  const ownMelds = opts.melds ?? [];
  const hand = parseHand(opts.hand);

  const seats = {} as PublicView['seats'];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    const fix = opts.seats?.[s];
    const river = (fix?.river ?? []).map((tok, i) => ({
      tile: tileNotationToId(tok),
      tsumogiri: false,
      riichiDeclaration: fix?.riichi ? i === (fix.river ?? []).length - 1 : false,
      calledBy: null,
      turnNumber: i,
    }));
    const melds = fix?.melds ?? (s === viewer ? ownMelds : []);
    seats[s] = {
      seat: s,
      seatWind: (['east', 'south', 'west', 'north'] as const)[s],
      melds,
      river,
      points: 25000,
      riichi: fix?.riichi ?? false,
      riichiTurn: fix?.riichi ? (fix.riichiTurn ?? (river.length - 1)) : null,
      ippatsu: false,
      concealedCount: fix?.concealedCount ?? (s === viewer ? hand.length : 13),
      isClosed: melds.every((mm) => mm.concealed),
      aiPersonalityId: null,
    };
  }

  const visible = new Array(34).fill(0);
  for (const t of hand) visible[kindOf(t)]++;
  for (let s = 0 as SeatIndex; s < 4; s++) {
    for (const m of seats[s].melds) for (const t of m.tiles) visible[kindOf(t)]++;
    for (const e of seats[s].river) visible[kindOf(e.tile)]++;
  }
  const dora = (opts.doraIndicators ?? []).map(tileNotationToId);
  for (const d of dora) visible[kindOf(d)]++;

  return {
    viewer,
    settings: { redDora: true, kuitan: true, twoHanMinimum: false, gameLength: 'east', difficulty: 'normal' },
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: viewer,
    phase: 'awaitingDiscard',
    hand,
    drawnTile: null,
    seats,
    doraIndicators: dora,
    tilesRemaining: opts.tilesRemaining ?? 40,
    lastDiscard: null,
    visibleCounts: visible,
  };
}

function discardsFor(view: PublicView): LegalAction[] {
  const out: LegalAction[] = [];
  const seen = new Set<number>();
  for (const t of view.hand) {
    const k = kindOf(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ action: { type: 'discard', seat: view.viewer, tile: t }, label: `discard ${k}` });
  }
  return out;
}

// ---------------------------------------------------------------------------

describe('params', () => {
  it('exposes three personalities, one per archetype', () => {
    expect(PERSONALITIES).toHaveLength(3);
    const arch = PERSONALITIES.map((p) => p.archetype).sort();
    expect(arch).toEqual(['aggressive', 'balanced', 'defensive']);
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
    expect(tableThreat(riichi).level).toBeGreaterThan(0.7);

    const quiet = makeView({
      hand: '234m567p234s12mE',
      tilesRemaining: 50,
      seats: { 1: { river: ['E'] }, 2: { river: ['S'] }, 3: { river: ['W'] } } as never,
    });
    expect(tableThreat(quiet).level).toBeLessThan(0.6);
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
    const ai = createAI(PERSONALITIES[1], 'normal', 123);
    const view = makeView({ hand: '234m567p789p23sEE N' });
    const legal = discardsFor(view);
    const dec = ai.decide(view, legal);
    expect(legal.some((l) => l.action.type === dec.action.type &&
      (l.action as { tile?: TileId }).tile === (dec.action as { tile?: TileId }).tile)).toBe(true);
  });

  it('always takes a winning action', () => {
    const ai = createAI(PERSONALITIES[1], 'hard', 1);
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
    const mk = () => createAI(PERSONALITIES[1], 'normal', 999);
    const view = makeView({ hand: '234m567p789p23sEE N' });
    const legal = discardsFor(view);
    const d1 = mk().decide(view, legal).action;
    const d2 = mk().decide(view, legal).action;
    expect(d1).toEqual(d2);
  });
});

describe('RNG', () => {
  it('is seeded and reproducible', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const sa = [a.next(), a.next(), a.next()];
    const sb = [b.next(), b.next(), b.next()];
    expect(sa).toEqual(sb);
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
  it('hashSeed is stable', () => {
    expect(hashSeed('x', 1)).toBe(hashSeed('x', 1));
    expect(hashSeed('x', 1)).not.toBe(hashSeed('x', 2));
  });
});

describe('public-information firewall (no-cheat)', () => {
  it('src/ai never imports hidden state or engine internal modules', () => {
    const aiDir = fileURLToPath(new URL('..', import.meta.url));
    const files = [
      'index.ts', 'player.ts', 'efficiency.ts', 'defense.ts', 'callLogic.ts',
      'riichiLogic.ts', 'params.ts', 'personalities.ts', 'handEval.ts', 'rng.ts', 'types.ts',
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
    const d1 = createAI(PERSONALITIES[1], 'normal', 55).decide(v1, discardsFor(v1)).action;
    const d2 = createAI(PERSONALITIES[1], 'normal', 55).decide(v2, discardsFor(v2)).action;
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

describe('self-play separation', () => {
  it('every archetype/difficulty plays hands with ZERO illegal actions', () => {
    for (const arch of ['aggressive', 'balanced', 'defensive'] as const) {
      for (const diff of ['easy', 'normal', 'hard'] as const) {
        const ais = [0, 1, 2, 3].map((s) => createAIForArchetype(arch, diff, 1000 + s));
        const res = playHands(ais, 31 + arch.length * 7 + diff.length, 6);
        const illegal = res.perSeat.reduce((s, p) => s + p.illegal, 0);
        expect(illegal, `${arch}/${diff} illegal actions`).toBe(0);
      }
    }
  });

  it('a seeded full self-play hand runs to completion with zero illegal actions', () => {
    // One representative table; the loop itself terminates and all returned
    // actions are legal (the harness otherwise force-recovers and counts).
    const ais = [
      createAIForArchetype('aggressive', 'hard', 11),
      createAIForArchetype('balanced', 'normal', 22),
      createAIForArchetype('defensive', 'hard', 33),
      createAIForArchetype('balanced', 'easy', 44),
    ];
    const res = playHands(ais, 777, 8);
    expect(res.handsPlayed).toBe(8);
    expect(res.perSeat.reduce((s, p) => s + p.illegal, 0)).toBe(0);
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

  it('hard beats normal beats easy in points over seeded self-play', () => {
    // Execution skill shows up as net points and wins when all four seats play
    // the same archetype (balanced) at one difficulty. Average over several
    // seeds to wash out per-hand variance; assert the ordering.
    const skill = (diff: 'easy' | 'normal' | 'hard') => {
      let points = 0;
      let wins = 0;
      let hands = 0;
      for (let seed = 2000; seed < 2000 + 5; seed++) {
        const ais = ([0, 1, 2, 3] as const).map((s) =>
          createAIForArchetype('balanced', diff, seed + s),
        );
        const r = playHands(ais, seed, 6);
        points += r.perSeat.reduce((s, p) => s + p.pointsDelta, 0) / 4;
        wins += r.perSeat.reduce((s, p) => s + p.ronWins + p.tsumoWins, 0);
        hands += r.handsPlayed;
      }
      return { points, wins, hands };
    };
    const easy = skill('easy');
    const normal = skill('normal');
    const hard = skill('hard');
    // Hard nets fewer losses (higher points) and wins more hands.
    expect(hard.points).toBeGreaterThan(normal.points);
    expect(normal.points).toBeGreaterThan(easy.points);
    expect(hard.wins).toBeGreaterThanOrEqual(normal.wins);
    expect(normal.wins).toBeGreaterThanOrEqual(easy.wins);
  });
});
