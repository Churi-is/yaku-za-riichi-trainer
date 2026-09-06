/**
 * Game-loop tests: deal, draw/discard, calls, kuikae, riichi, furiten, kan,
 * hand end and hand advance.
 */
import { describe, it, expect } from 'vitest';
import {
  applyAction, cloneState, createMatch, getLegalActions, nextHand, pendingSeats, toPublicView,
} from '../index';
import { kindOf, tileName } from '../tiles';
import { DEFAULT_SETTINGS } from '../types';
import type { Action, GameState, SeatIndex, TileId } from '../types';
import { allTileIds, setupGame } from './loop';
import { parse } from './helpers';

/**
 * Filler hands for seats a test does not care about. They lean on honors and
 * the 1-3 of each suit so the interesting suits stay free, and the three of
 * them together never take more than three copies of anything.
 */
const FILLER = [
  'ESWNPFC11m22m33m',
  '123s456s789s11p22p',
  '123m456m789m11s22s',
];

const K_1M = 0;
const K_2M = 1;
const K_3M = 2;
const K_4M = 3;
const K_5M = 4;
const K_4P = 12;
const K_5S = 22;
const K_7P = 15;
const K_6S = 23;
const K_7S = 24;
const K_9S = 26;

function kindsOf(ids: TileId[]): number[] {
  return ids.map(kindOf).sort((a, b) => a - b);
}

function options(state: GameState, seat: SeatIndex, type: Action['type']) {
  return getLegalActions(state, seat).filter((l) => l.action.type === type);
}

function hasRiichiOption(state: GameState, seat: SeatIndex): boolean {
  return getLegalActions(state, seat)
    .some((l) => (l.action as { riichi?: boolean }).riichi === true);
}

function discardKinds(state: GameState, seat: SeatIndex): number[] {
  return options(state, seat, 'discard')
    .map((l) => kindOf((l.action as { tile: TileId }).tile));
}

/** Walk every pending seat through a pass so the turn advances. */
function passAll(state: GameState): GameState {
  let s = state;
  while (s.phase === 'awaitingCalls') {
    const pending = pendingSeats(s);
    if (!pending.length) break;
    s = applyAction(s, { type: 'pass', seat: pending[0] });
  }
  return s;
}

describe('deal', () => {
  it('deals 13 tiles each plus a 70-tile wall and a 14-tile dead wall', () => {
    const s = createMatch(DEFAULT_SETTINGS, 12345);
    expect(s.phase).toBe('awaitingDiscard');
    expect(s.turn).toBe(s.dealer);
    expect(s.players.map((p) => p.hand.length)).toEqual([13, 13, 13, 13]);
    expect(s.players[0].drawnTile).not.toBeNull();
    expect(s.players[1].drawnTile).toBeNull();
    // The dealer's 14th tile already came off the wall.
    expect(s.wall.length).toBe(69);
    expect(s.deadWall.length).toBe(14);
    expect(s.doraIndicators).toHaveLength(1);
    const all = allTileIds(s);
    expect(all.length).toBe(136);
    expect(new Set(all).size).toBe(136);
  });

  it('is reproducible from the seed and differs across seeds', () => {
    const a = createMatch(DEFAULT_SETTINGS, 7);
    const b = createMatch(DEFAULT_SETTINGS, 7);
    const c = createMatch(DEFAULT_SETTINGS, 8);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('gives each seat a seat wind relative to the dealer', () => {
    expect(createMatch(DEFAULT_SETTINGS, 3).players.map((p) => p.seatWind))
      .toEqual(['east', 'south', 'west', 'north']);
    const s = setupGame({ hands: FILLER.concat(['123m456m789m123p5s']), dealer: 2 });
    expect(s.players.map((p) => p.seatWind)).toEqual(['west', 'north', 'east', 'south']);
  });
});

describe('applyAction purity', () => {
  it('returns a new state and leaves the input untouched', () => {
    const s = createMatch(DEFAULT_SETTINGS, 7);
    const before = JSON.stringify(s);
    const next = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(JSON.stringify(s)).toBe(before);
    expect(next).not.toBe(s);
    expect(next.players).not.toBe(s.players);
    expect(next.players[0]).not.toBe(s.players[0]);
    expect(next.players[0].river).not.toBe(s.players[0].river);
  });

  it('works on a deep-frozen input state', () => {
    const s = createMatch(DEFAULT_SETTINGS, 11);
    const freeze = (v: unknown): void => {
      if (v && typeof v === 'object') {
        Object.freeze(v);
        for (const x of Object.values(v as Record<string, unknown>)) freeze(x);
      }
    };
    freeze(s);
    const next = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(next.phase).not.toBe('dealing');
    expect(next.players[0].river).toHaveLength(1);
  });

  it('rejects an action that is not legal', () => {
    const s = createMatch(DEFAULT_SETTINGS, 5);
    // Not this seat's turn.
    expect(() => applyAction(s, { type: 'draw', seat: 1 })).toThrow();
    // A tile nobody is holding.
    expect(() => applyAction(s, { type: 'discard', seat: 0, tile: parse('1z')[0] })).toThrow();
    expect(() => applyAction(s, { type: 'ron', seat: 0 })).toThrow();
    expect(() => applyAction(s, { type: 'pass', seat: 0 })).toThrow();
  });
});

describe('draw and discard', () => {
  const SCENE = {
    hands: FILLER.concat(['123m456m789m123p5s']),
    wall: '7p',
    dealer: 0,
    turn: 1,
  };

  it('moves a tile from the wall into the drawn slot, then into the river', () => {
    const s = setupGame(SCENE);
    expect(s.phase).toBe('awaitingDraw');
    expect(getLegalActions(s, 1)).toHaveLength(1);
    expect(getLegalActions(s, 2)).toHaveLength(0);

    const drawn = applyAction(s, { type: 'draw', seat: 1 });
    expect(kindOf(drawn.players[1].drawnTile!)).toBe(K_7P);
    expect(drawn.wall.length).toBe(s.wall.length - 1);
    expect(drawn.phase).toBe('awaitingDiscard');

    const tile = drawn.players[1].drawnTile!;
    const after = applyAction(drawn, { type: 'discard', seat: 1, tile });
    expect(after.players[1].drawnTile).toBeNull();
    expect(after.players[1].hand).toHaveLength(13);
    expect(after.players[1].river).toHaveLength(1);
    expect(after.players[1].river[0].tsumogiri).toBe(true);
    expect(after.lastDiscard).toEqual({ tile, from: 1 });
    expect(after.turn).toBe(2);
    expect(allTileIds(after)).toHaveLength(136);
  });

  it('keeps every hand at 13 concealed tiles across a go-around', () => {
    let s = setupGame({ ...SCENE, turn: 0, phase: 'awaitingDiscard' });
    for (let i = 0; i < 4; i++) {
      const seat = s.turn;
      s = applyAction(s, { type: 'discard', seat, tile: s.players[seat].drawnTile! });
      s = passAll(s);
      if (i < 3) s = applyAction(s, { type: 'draw', seat: s.turn });
    }
    expect(s.players.map((p) => p.hand.length)).toEqual([13, 13, 13, 13]);
    expect(s.players.map((p) => p.river.length)).toEqual([1, 1, 1, 1]);
    expect(s.turnNumber).toBe(4);
    expect(allTileIds(s)).toHaveLength(136);
  });

  it('folds the draw back into the hand when a different tile is discarded', () => {
    const s = setupGame({ ...SCENE, turn: 0, phase: 'awaitingDiscard', drawn: '9s' });
    const drawn = s.players[0].drawnTile!;
    const fromHand = s.players[0].hand[0];
    const after = applyAction(s, { type: 'discard', seat: 0, tile: fromHand });
    expect(after.players[0].river[0].tsumogiri).toBe(false);
    expect(after.players[0].hand).toContain(drawn);
    expect(after.players[0].hand).not.toContain(fromHand);
    expect(after.players[0].hand).toHaveLength(13);
  });
});

describe('calls', () => {
  /** Seat 0 discards 1m; seat 1 holds a pair of 1m. */
  const PON = {
    hands: [
      '234p567p89p123s5m5s',
      '11m234p567p12s5s7s9s',
      '234m567m89m123p5s8s',
      '567m89m12p345p67s4s',
    ],
    wall: '1m',
    dealer: 0,
    phase: 'awaitingDiscard' as const,
    turn: 0,
  };

  /** Seat 0 discards 5m; seat 1 holds 34m and can chi 3-4-5. */
  const CHI = {
    hands: [
      '234p567p89p123s5m5s',
      '34m234p567p12s5s7s9s',
      '46m234p567p123s7s9s',
      '234m567m89m123p5s8s',
    ],
    wall: '5m',
    dealer: 0,
    phase: 'awaitingDiscard' as const,
    turn: 0,
  };

  it('lets a seat pon a discard and take the turn', () => {
    const s = setupGame(PON);
    const tile = s.players[0].drawnTile!;
    const after = applyAction(s, { type: 'discard', seat: 0, tile });
    expect(after.phase).toBe('awaitingCalls');
    expect(pendingSeats(after)).toContain(1);
    const pon = options(after, 1, 'pon');
    expect(pon).toHaveLength(1);
    expect(pon[0].label).toContain('Pon');

    const called = applyAction(after, pon[0].action);
    expect(called.players[1].melds).toHaveLength(1);
    expect(called.players[1].melds[0].type).toBe('pon');
    expect(kindsOf(called.players[1].melds[0].tiles)).toEqual([K_1M, K_1M, K_1M]);
    expect(called.players[1].melds[0].calledTile).toBe(tile);
    expect(called.players[1].melds[0].calledFrom).toBe(0);
    expect(called.players[1].melds[0].concealed).toBe(false);
    expect(called.players[1].hand).toHaveLength(11);
    expect(called.players[1].isClosed).toBe(false);
    expect(called.turn).toBe(1);
    expect(called.phase).toBe('awaitingDiscard');
    expect(called.players[0].river[0].calledBy).toBe(1);
    expect(called.players[0].hand).toHaveLength(13);
    expect(allTileIds(called)).toHaveLength(136);
  });

  it('drops a seat that passes out of the window', () => {
    const s = setupGame(PON);
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    const passed = applyAction(after, { type: 'pass', seat: 1 });
    expect(options(passed, 1, 'pon')).toHaveLength(0);
    expect(pendingSeats(passed)).not.toContain(1);
    // Everyone passed -> the turn simply moves on.
    const moved = passAll(passed);
    expect(moved.phase).toBe('awaitingDraw');
    expect(moved.turn).toBe(1);
  });

  it('allows chi only from the kamicha', () => {
    const s = setupGame(CHI);
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(options(after, 1, 'chi')).toHaveLength(1);
    // Seat 2 holds 46m and wants the same 5m, but seat 0 is not its kamicha.
    expect(options(after, 2, 'chi')).toHaveLength(0);

    const called = applyAction(after, options(after, 1, 'chi')[0].action);
    expect(called.players[1].melds[0].type).toBe('chi');
    expect(kindsOf(called.players[1].melds[0].tiles)).toEqual([K_3M, K_4M, K_5M]);
    expect(called.turn).toBe(1);
  });

  it('closes the window once the shimocha chis', () => {
    const s = setupGame(CHI);
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    const called = applyAction(after, options(after, 1, 'chi')[0].action);
    expect(called.phase).toBe('awaitingDiscard');
    expect(called.callWindow).toBeNull();
    expect(getLegalActions(called, 2)).toHaveLength(0);
  });

  it('enforces kuikae: the called kind and the chi mirror are forbidden', () => {
    const s = setupGame(CHI);
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    const chi = options(after, 1, 'chi')[0];
    // Chi 3-4 on the 5: may not immediately drop the 5m or the mirror 2m.
    expect([...(chi.forbiddenDiscards ?? [])].sort((a, b) => a - b)).toEqual([K_2M, K_5M]);

    const called = applyAction(after, chi.action);
    expect([...called.players[1].forbiddenDiscards].sort((a, b) => a - b)).toEqual([K_2M, K_5M]);
    const offered = discardKinds(called, 1);
    expect(offered).not.toContain(K_2M);
    expect(offered).not.toContain(K_5M);
    expect(offered.length).toBeGreaterThan(0);

    // One discard later the ban lifts.
    const kept = (options(called, 1, 'discard')[0].action as { tile: TileId }).tile;
    const next = applyAction(called, { type: 'discard', seat: 1, tile: kept });
    expect(next.players[1].forbiddenDiscards).toEqual([]);
  });

  it('forbids a pon seat from discarding the called kind right away', () => {
    const s = setupGame(PON);
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    const pon = options(after, 1, 'pon')[0];
    expect(pon.forbiddenDiscards).toEqual([K_1M]);
    const called = applyAction(after, pon.action);
    expect(called.players[1].forbiddenDiscards).toEqual([K_1M]);
    expect(discardKinds(called, 1)).not.toContain(K_1M);
  });

  it('offers both pon and chi to a seat that can do either', () => {
    const s = setupGame({
      hands: [
        '234p567p89p123s1m9s',
        '55m67m234p567p12s9s', // 55m pons the 5m, 67m chis it
        '234m678m89m123p5s8s',
        '678m89m12p345p67s4s',
      ],
      wall: '5m',
      dealer: 0,
      phase: 'awaitingDiscard',
      turn: 0,
    });
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(options(after, 1, 'pon')).toHaveLength(1);
    expect(options(after, 1, 'chi')).toHaveLength(1);
  });

  it('offers no calls at all when the wall is empty', () => {
    const s = setupGame(PON);
    s.wall = [];
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(after.phase).toBe('handOver');
  });
});

describe('open kan', () => {
  const KAN = {
    hands: [
      '234p567p89p123s5m5s',
      '111m234p567p12s7s9s',
      '234m567m89m123p5s8s',
      '567m89m12p345p67s4s',
    ],
    wall: '1m',
    dealer: 0,
    phase: 'awaitingDiscard' as const,
    turn: 0,
  };

  it('melds four tiles, flips a dora and draws a rinshan replacement', () => {
    const s = setupGame(KAN);
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    const kan = options(after, 1, 'minkan');
    expect(kan).toHaveLength(1);
    const wallBefore = after.wall.length;

    const called = applyAction(after, kan[0].action);
    expect(called.players[1].melds[0].type).toBe('minkan');
    expect(called.players[1].melds[0].tiles).toHaveLength(4);
    expect(called.players[1].melds[0].concealed).toBe(false);
    expect(called.players[1].hand).toHaveLength(10);
    expect(called.players[1].drawnTile).not.toBeNull();
    expect(called.players[1].isClosed).toBe(false);
    expect(called.kanCount).toBe(1);
    expect(called.turn).toBe(1);
    expect(called.doraIndicators).toHaveLength(2);
    expect(allTileIds(called)).toHaveLength(136);

    const discarded = applyAction(called, { type: 'discard', seat: 1, tile: called.players[1].drawnTile! });
    expect(discarded.players[1].hand).toHaveLength(14 - 4);
    expect(discarded.wall.length).toBe(wallBefore - 1);
    expect(allTileIds(discarded)).toHaveLength(136);
  });
});

describe('concealed and added kan', () => {
  it('offers ankan for all four copies, keeps menzen and draws a replacement', () => {
    const s = setupGame({
      hands: [
        '222m345m678m123p5s',
        '139m456m789m123p5s',
        'ESWNPFC11s22s33s',
        '123s456s789s11p22p',
      ],
      wall: '2m',
      dealer: 0,
      phase: 'awaitingDiscard',
      turn: 0,
    });
    expect(kindOf(s.players[0].drawnTile!)).toBe(K_2M);
    const ankan = options(s, 0, 'ankan');
    expect(ankan).toHaveLength(1);

    const called = applyAction(s, ankan[0].action);
    expect(called.players[0].melds[0].type).toBe('ankan');
    expect(called.players[0].melds[0].concealed).toBe(true);
    expect(called.players[0].melds[0].tiles).toHaveLength(4);
    expect(called.players[0].isClosed).toBe(true);
    expect(called.players[0].hand).toHaveLength(10);
    expect(called.players[0].drawnTile).not.toBeNull();
    expect(called.kanCount).toBe(1);
    expect(called.doraIndicators).toHaveLength(2);
    expect(allTileIds(called)).toHaveLength(136);
  });

  it('does not offer ankan for only three copies', () => {
    const s = setupGame({
      hands: [
        '22m345m678m123p77s',
        '123m456m789m123p5s',
        'ESWNPFC11s22s33s',
        '123s456s789s11p22p',
      ],
      wall: '9s',
      dealer: 0,
      phase: 'awaitingDiscard',
      turn: 0,
    });
    expect(options(s, 0, 'ankan')).toHaveLength(0);
  });

  it('turns a pon into an added kan', () => {
    const s = setupGame({
      hands: [
        '234p567p89p123s5m5s',
        '234p567p12s7s9s',
        '234m567m89m123p5s8s',
        '567m89m12p345p67s4s',
      ],
      melds: [[], [{ type: 'pon', text: '111m', calledFrom: 0 }], [], []],
      drawn: '1m',
      dealer: 0,
      phase: 'awaitingDiscard',
      turn: 1,
    });
    expect(s.players[1].melds[0].type).toBe('pon');
    expect(s.players[1].hand).toHaveLength(10);
    const kakan = options(s, 1, 'kakan');
    expect(kakan).toHaveLength(1);

    const called = applyAction(s, kakan[0].action);
    expect(called.players[1].melds[0].type).toBe('kakan');
    expect(called.players[1].melds[0].concealed).toBe(false);
    expect(called.players[1].melds[0].tiles).toHaveLength(4);
    expect(called.players[1].hand).toHaveLength(10);
    expect(called.players[1].drawnTile).not.toBeNull();
    expect(called.kanCount).toBe(1);
    expect(allTileIds(called)).toHaveLength(136);
  });
});

describe('winning', () => {
  /** Seat 1 kanchan 6s, seat 3 shanpon 6s/7p; both all-simples hands. */
  const WIN = {
    hands: [
      '234m567m89m123p99p',
      '234m567m234p55p57s',
      '345m678m234p567p9s',
      '234m678m234p66s77p',
    ],
    wall: '6s',
    dora: 'E',
    dealer: 0,
    phase: 'awaitingDiscard' as const,
    turn: 0,
  };

  const zeroSum = (state: GameState) => {
    const deltas = [0, 1, 2, 3].map((i) => state.handOver!.deltas[i as SeatIndex]);
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
    expect(state.players.reduce((a, p) => a + p.points, 0)).toBe(100000);
  };

  it('awards ron to the earliest waiting seat only (head bump)', () => {
    const s = setupGame(WIN);
    const tile = s.players[0].drawnTile!;
    const after = applyAction(s, { type: 'discard', seat: 0, tile });
    expect([...pendingSeats(after)].sort()).toEqual([1, 3]);
    expect(options(after, 1, 'ron')).toHaveLength(1);
    expect(options(after, 3, 'ron')).toHaveLength(0);

    const won = applyAction(after, { type: 'ron', seat: 1 });
    expect(won.phase).toBe('handOver');
    const r = won.handOver!;
    expect(r.reason).toBe('ron');
    expect(r.winner).toBe(1);
    expect(r.loser).toBe(0);
    expect(r.winningTile).toBe(tile);
    const ids = r.score!.yaku.map((y) => y.id);
    expect(ids).toContain('tanyao');
    expect(ids).toContain('renhou'); // ron off the dealer's very first discard
    expect(r.score!.han).toBe(6); // 1 + 5 => haneman
    expect(r.score!.points).toBe(12000);
    expect(r.revealedHands[3]).toHaveLength(13);
    expect(r.renchan).toBe(false);
    zeroSum(won);
  });

  it('passes ron on to a later seat once the earlier seat declines', () => {
    const s = setupGame(WIN);
    let after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    after = applyAction(after, { type: 'pass', seat: 1 });
    expect(after.players[1].temporaryFuriten).toBe(true);
    expect(options(after, 3, 'ron')).toHaveLength(1);
    const won = applyAction(after, { type: 'ron', seat: 3 });
    expect(won.handOver!.winner).toBe(3);
    expect(won.handOver!.loser).toBe(0);
  });

  it('blocks ron for a seat in permanent furiten', () => {
    const s = setupGame({ ...WIN, rivers: ['', '6s', '', ''] });
    expect(s.players[1].furiten).toBe(true); // seat 1 waits on the 6s it threw
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    // Seat 1 waits on 5s but threw one away earlier.
    expect(after.players[1].furiten).toBe(true);
    expect(options(after, 1, 'ron')).toHaveLength(0);
    expect(options(after, 1, 'pass')).toHaveLength(1);
    expect(options(after, 3, 'ron')).toHaveLength(1);
  });

  it('scores tsumo with the dealer paying double', () => {
    const s = setupGame({ ...WIN, turn: 1, phase: 'awaitingDraw' });
    const drawn = applyAction(s, { type: 'draw', seat: 1 });
    expect(kindOf(drawn.players[1].drawnTile!)).toBe(K_6S);
    const tsumo = options(drawn, 1, 'tsumo');
    expect(tsumo).toHaveLength(1);

    const won = applyAction(drawn, tsumo[0].action);
    const r = won.handOver!;
    expect(r.reason).toBe('tsumo');
    expect(r.winner).toBe(1);
    expect(r.loser).toBeNull();
    expect(r.score!.han).toBe(2);
    expect(r.score!.fu).toBe(30); // 20 + 2 tsumo + 2 kanchan
    expect(r.score!.points).toBe(2000);
    expect(r.score!.payments[0]).toBe(-1000); // the dealer pays double
    expect(r.score!.payments[2]).toBe(-500);
    expect(r.deltas[1]).toBe(2000);
    zeroSum(won);
  });

  it('refuses a yakuless win', () => {
    // 123m 234p 456p 567p tanki 5s: has a terminal, no ittsu, no pinfu => no yaku.
    const s = setupGame({
      hands: [
        '234m567m89m123p99p',
        '123m234p456p567p5s',
        '345m678m234p567p9s',
        '234m678m234p66s77p',
      ],
      wall: '5s',
      dealer: 0,
      phase: 'awaitingDiscard',
      turn: 0,
      turnNumber: 4, // past the first go-around, so renhou cannot rescue it
    });
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(options(after, 1, 'ron')).toHaveLength(0);
    expect(after.phase).toBe('awaitingDraw');
  });

  it('refuses a win below the two-han minimum', () => {
    // turnNumber 4 puts us past the first go-around, so renhou cannot rescue it.
    const s = setupGame({ ...WIN, settings: { twoHanMinimum: true }, turnNumber: 4 });
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    // Tanyao alone is one han, so neither waiting seat may ron it.
    expect(options(after, 1, 'ron')).toHaveLength(0);
    expect(options(after, 3, 'ron')).toHaveLength(0);
  });
});

describe('riichi', () => {
  const RIICHI = {
    hands: [
      '234m567m234p56p5s9s', // 1-shanten; drawing 4p and dropping 9s is tenpai
      '123m456m789m123p5s',
      'ESWNPFC11m22m33m',
      '123s456s789s11p22p',
    ],
    wall: '4p',
    dealer: 0,
    phase: 'awaitingDiscard' as const,
    turn: 0,
  };

  it('is offered only for a discard that leaves the hand tenpai', () => {
    const s = setupGame(RIICHI);
    const riichi = getLegalActions(s, 0)
      .filter((l) => (l.action as { riichi?: boolean }).riichi === true)
      .map((l) => kindOf((l.action as { tile: TileId }).tile))
      .sort((a, b) => a - b);
    // Dropping the 5s or the 9s each leaves a tanki tenpai.
    expect(riichi).toEqual([K_5S, K_9S]);
    // The drawn 4p completes 456p, so throwing it away is not tenpai.
    expect(riichi).not.toContain(K_4P);
    expect(discardKinds(s, 0)).toContain(K_4P);
    expect(hasRiichiOption(s, 0)).toBe(true);
  });

  it('charges the stick, flags the player and locks the discard', () => {
    const s = setupGame(RIICHI);
    const nine = s.players[0].hand.find((t) => kindOf(t) === K_9S)!;
    const declared = applyAction(s, { type: 'discard', seat: 0, tile: nine, riichi: true });
    expect(declared.players[0].riichi).toBe(true);
    expect(declared.players[0].points).toBe(24000);
    expect(declared.riichiSticks).toBe(1);
    expect(declared.players[0].river[0].riichiDeclaration).toBe(true);
    expect(declared.players[0].ippatsu).toBe(true);
    expect(declared.players[0].isClosed).toBe(true);

    // Bring the turn back round to seat 0.
    let s2 = declared;
    for (const seat of [1, 2, 3] as SeatIndex[]) {
      s2 = applyAction(s2, { type: 'draw', seat });
      s2 = applyAction(s2, { type: 'discard', seat, tile: s2.players[seat].drawnTile! });
      s2 = passAll(s2);
    }
    const turn = applyAction(s2, { type: 'draw', seat: 0 });
    const discards = options(turn, 0, 'discard');
    expect(discards).toHaveLength(1);
    expect((discards[0].action as { tile: TileId }).tile).toBe(turn.players[0].drawnTile);
    expect(hasRiichiOption(turn, 0)).toBe(false);
  });

  it('is refused when fewer than four wall tiles remain', () => {
    const s = setupGame(RIICHI);
    s.wall = s.wall.slice(0, 3);
    expect(hasRiichiOption(s, 0)).toBe(false);
  });

  it('is refused for a seat that has already called', () => {
    const s = setupGame({
      ...RIICHI,
      hands: [
        '234m567m234p5s', // 10 tiles behind an open chi
        '123m456m789m123p5s',
        'ESWNPFC11m22m33m',
        '123s456s789s11p22p',
      ],
      melds: [[{ type: 'chi', text: '123s', calledFrom: 3 }], [], [], []],
      wall: '4p',
    });
    expect(s.players[0].hand).toHaveLength(10);
    expect(s.players[0].isClosed).toBe(false);
    expect(hasRiichiOption(s, 0)).toBe(false);
  });

  it('is refused for a seat already in riichi', () => {
    const s = setupGame({ ...RIICHI, riichi: [0] });
    expect(hasRiichiOption(s, 0)).toBe(false);
    expect(options(s, 0, 'discard').length).toBe(1);
  });

  it('costs ippatsu when another player calls', () => {
    const s = setupGame({
      hands: [
        '234m567m234p56p5s9s',
        '99s123m456m789m12p', // pair of 9s to pon the declaration tile
        'ESWNPFC11m22m33m',
        '123s456s789s11p22p',
      ],
      wall: '4p',
      dealer: 0,
      phase: 'awaitingDiscard',
      turn: 0,
    });
    const nine = s.players[0].hand.find((t) => kindOf(t) === K_9S)!;
    const declared = applyAction(s, { type: 'discard', seat: 0, tile: nine, riichi: true });
    expect(declared.players[0].ippatsu).toBe(true);
    const pon = options(declared, 1, 'pon');
    expect(pon).toHaveLength(1);
    const called = applyAction(declared, pon[0].action);
    expect(called.players[0].ippatsu).toBe(false);
    expect(called.players[0].riichi).toBe(true);
  });
});

describe('hand end', () => {
  it('pays tenpai seats on an exhaustive draw and zero-sums the deltas', () => {
    const s = setupGame({
      hands: [
        '234m567m234p78p55s', // tenpai on 4p/7p
        '13579m13579p135s', // nowhere
        '234m678m234p56p19s', // 1-shanten: 3 sets, one partial, two floaters
        '345m678m234p56p19s', // 1-shanten, and does not complete on the 9s
      ],
      dealer: 0,
      turnNumber: 4, // seat 2 pairs the 9s, but that hand is yakuless
      turn: 0,
      phase: 'awaitingDiscard',
      drawn: '9s',
    });
    s.wall = [];
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    expect(after.phase).toBe('handOver');
    const r = after.handOver!;
    expect(r.reason).toBe('exhaustiveDraw');
    expect(r.tenpaiSeats).toEqual([0]);
    const deltas = [0, 1, 2, 3].map((i) => r.deltas[i as SeatIndex]);
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
    expect(deltas[0]).toBe(3000);
    expect(deltas[1]).toBe(-1000);
    expect(deltas[2]).toBe(-1000);
    expect(deltas[3]).toBe(-1000);
    expect(r.renchan).toBe(true);
  });

  it('pays nothing when nobody is tenpai', () => {
    const s = setupGame({
      hands: [
        '13579m13579p135s',
        '2468m2468p246s13p',
        'ESWNPFC11m22m33m',
        '123s456s78s1479p1m',
      ],
      dealer: 0,
      turn: 0,
      phase: 'awaitingDiscard',
      drawn: '9s',
    });
    s.wall = [];
    const after = applyAction(s, { type: 'discard', seat: 0, tile: s.players[0].drawnTile! });
    const r = after.handOver!;
    expect(r.reason).toBe('exhaustiveDraw');
    expect(r.tenpaiSeats).toEqual([]);
    expect([0, 1, 2, 3].map((i) => r.deltas[i as SeatIndex])).toEqual([0, 0, 0, 0]);
  });

  it('counts honba sticks on top of the base payment', () => {
    const s = setupGame({
      hands: [
        '234m567m89m123p99p',
        '234m567m234p55p57s',
        '345m678m234p567p9s',
        '234m678m234p66s77p',
      ],
      wall: '6s',
      dora: 'E',
      dealer: 0,
      turn: 1,
      phase: 'awaitingDraw',
      honba: 2,
    });
    const drawn = applyAction(s, { type: 'draw', seat: 1 });
    const won = applyAction(drawn, { type: 'tsumo', seat: 1 });
    const r = won.handOver!;
    // 30 fu / 2 han non-dealer tsumo: dealer 1000, others 500.
    // 2 honba x 300 = 600 total, split three ways: 200 extra per payer.
    expect(r.deltas[0]).toBe(-1200);
    expect(r.deltas[2]).toBe(-700);
    expect(r.deltas[3]).toBe(-700);
    expect(r.deltas[1]).toBe(2600);
  });

  it('hands the riichi sticks to the winner', () => {
    const s = setupGame({
      hands: [
        '234m567m89m123p99p',
        '234m567m234p55p57s',
        '345m678m234p567p9s',
        '234m678m234p66s77p',
      ],
      wall: '6s',
      dora: 'E',
      dealer: 0,
      turn: 1,
      phase: 'awaitingDraw',
      riichiSticks: 2,
      // Two seats already put a stick up, so the table still totals 100000.
      points: [24000, 25000, 25000, 24000],
    });
    const drawn = applyAction(s, { type: 'draw', seat: 1 });
    const won = applyAction(drawn, { type: 'tsumo', seat: 1 });
    expect(won.handOver!.deltas[1]).toBe(2000 + 2000);
    expect(won.riichiSticks).toBe(0);
    expect(won.players.reduce((a, p) => a + p.points, 0)).toBe(100000);
  });
});

describe('hand and match advance', () => {
  /** Play out one hand with a fixed, dumb policy: draw, then discard. */
  function playHand(state: GameState): GameState {
    let s = cloneState(state);
    for (let i = 0; i < 5000 && s.phase !== 'handOver' && s.phase !== 'matchOver'; i++) {
      const pending = pendingSeats(s);
      const seat = pending.length ? pending[0] : s.turn;
      const legal = getLegalActions(s, seat);
      expect(legal.length).toBeGreaterThan(0);
      const act = legal.find((l) => l.action.type === 'draw') ?? legal[legal.length - 1];
      s = applyAction(s, act.action);
    }
    return s;
  }

  it('follows the renchan rule for dealer and honba', () => {
    const ended = playHand(createMatch(DEFAULT_SETTINGS, 99));
    expect(ended.phase).toBe('handOver');
    const r = ended.handOver!;
    const next = nextHand(ended);
    expect(next.dealer).toBe(r.renchan ? ended.dealer : ((ended.dealer + 1) % 4));
    expect(next.honba).toBe(r.reason === 'exhaustiveDraw' || r.renchan ? ended.honba + 1 : 0);
    expect(next.handNumber).toBe(ended.handNumber + 1);
    expect(next.phase).toBe('awaitingDiscard');
    expect(next.handOver).toBeNull();
    expect(next.callWindow).toBeNull();
    expect(next.players.map((p) => p.river.length)).toEqual([0, 0, 0, 0]);
    expect(next.players.map((p) => p.hand.length)).toEqual([13, 13, 13, 13]);
    expect(next.players.map((p) => p.melds.length)).toEqual([0, 0, 0, 0]);
    expect(next.riichiSticks).toBe(ended.riichiSticks);
  });

  it('plays a hanchan east 1 through south 4 and stops', () => {
    let s = createMatch(DEFAULT_SETTINGS, 4);
    const rounds: string[] = [];
    for (let i = 0; i < 20 && s.phase !== 'matchOver'; i++) {
      rounds.push(`${s.roundWind}${s.roundNumber}`);
      s = playHand(s);
      if (s.phase === 'handOver') s = nextHand(s);
    }
    expect(rounds).toEqual([
      'east1', 'east2', 'east3', 'east4', 'south1', 'south2', 'south3', 'south4',
    ]);
    expect(s.phase).toBe('matchOver');
    const m = s.matchOver!;
    expect(m.handsPlayed).toBe(8);
    expect(m.ranking).toHaveLength(4);
    expect(new Set(m.ranking).size).toBe(4);
    const points = m.ranking.map((seat) => m.finalPoints[seat]);
    expect([...points].sort((a, b) => b - a)).toEqual(points);
    expect(points.reduce((a, b) => a + b, 0)).toBe(100000);
  });
});

describe('toPublicView firewall', () => {
  it('never exposes another seat’s concealed tiles', () => {
    const s = createMatch(DEFAULT_SETTINGS, 31337);
    for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
      const view = toPublicView(s, seat);
      const mine = new Set([
        ...s.players[seat].hand,
        ...(s.players[seat].drawnTile !== null ? [s.players[seat].drawnTile] : []),
      ]);
      expect(view.hand.length).toBe(s.players[seat].hand.length);
      for (const id of view.hand) expect(mine.has(id)).toBe(true);

      for (const other of [0, 1, 2, 3] as SeatIndex[]) {
        if (other === seat) continue;
        const raw = view.seats[other] as unknown as Record<string, unknown>;
        expect(raw.hand).toBeUndefined();
        expect(raw.drawnTile).toBeUndefined();
        expect(raw.uraIndicators).toBeUndefined();
        const p = s.players[other];
        expect(raw.concealedCount).toBe(p.hand.length + (p.drawnTile !== null ? 1 : 0));
      }
    }
  });

  it('counts only what the viewer can actually see', () => {
    const s = createMatch(DEFAULT_SETTINGS, 555);
    const view = toPublicView(s, 0);
    // 13 concealed + the draw + 1 dora indicator; nothing from the wall.
    expect(view.visibleCounts.reduce((a, b) => a + b, 0)).toBe(15);
    expect(view.tilesRemaining).toBe(69);
    expect(view.doraIndicators).toEqual(s.doraIndicators);
  });
});

describe('tile naming', () => {
  it('names tiles for the UI', () => {
    expect(tileName(0)).toBe('1m');
    expect(tileName(K_5M)).toBe('5m');
    expect(tileName(K_7S)).toBe('7s');
    expect(tileName(K_9S)).toBe('9s');
    expect(tileName(31)).toBe('Haku');
    expect(tileName(33)).toBe('Chun');
  });
});
