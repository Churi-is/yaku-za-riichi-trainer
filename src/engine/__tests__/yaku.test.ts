/**
 * engine/yaku tests — the yaku the scoring suite does not reach directly,
 * plus the win-legality gate.
 */
import { describe, it, expect } from 'vitest';
import {
  scoreHand, isLegalWin, createMatch, applyAction, getLegalActions,
  type ScoreInput,
} from '../index';
import { kindOf } from '../tiles';
import { basePoints, ceil100 } from '../scoring';
import { DEFAULT_SETTINGS, type GameState, type Meld, type SeatIndex, type TableSettings, type TileId } from '../types';
import { parse, meld } from './helpers';
import { setupGame } from './loop';

// kind values used below: 1m=0, 7m=6, 9m=8, 1p=9, 4p=12, 2s=19.
const K_1M = 0;
const K_7M = 6;
const K_9M = 8;
const K_1P = 9;
const K_4P = 12;
const K_2S = 19;

const CLEAN: TableSettings = { ...DEFAULT_SETTINGS, redDora: false };

function score(
  hand: string, win: string, over: Partial<ScoreInput> = {},
) {
  const h = parse(hand);
  const w = parse(win)[0];
  if (!h.includes(w)) throw new Error('winning tile must be in `hand`');
  return scoreHand({
    hand: h,
    melds: [] as Meld[],
    winningTile: w,
    isTsumo: false,
    seatWind: 'south',
    roundWind: 'south',
    isDealer: false,
    riichi: false, doubleRiichi: false, ippatsu: false,
    haitei: false, houtei: false, rinshan: false, chankan: false,
    tenhou: false, chiihou: false, renhou: false,
    doraIndicators: [], uraIndicators: [],
    settings: CLEAN,
    winnerSeat: 0, loserSeat: 1, dealerSeat: 1, paoSeat: null,
    ...over,
  });
}

const ids = (r: ReturnType<typeof score>) => r.yaku.map((y) => y.id).sort();

describe('yaku — structural families', () => {
  it('sanshoku doujun is 2 han closed', () => {
    const r = score('234m234p234s678m99s', '9s', { isTsumo: true });
    expect(ids(r)).toEqual(['menzenTsumo', 'sanshokuDoujun']);
    expect(r.han).toBe(3);
  });

  it('sanshoku doujun drops to 1 han when open', () => {
    const r = score('234p234s678m99s', '9s', {
      isTsumo: true, melds: [meld('chi', '234m')],
    });
    expect(ids(r)).toEqual(['sanshokuDoujun']);
    expect(r.han).toBe(1);
  });

  it('sanshoku doujun needs the same rank, not just three suits', () => {
    const r = score('234m345p234s678m99s', '9s', { isTsumo: true });
    expect(ids(r)).not.toContain('sanshokuDoujun');
  });

  it('ittsu needs 1-9 of one suit', () => {
    const r = score('123456789m234p99s', '9s', { isTsumo: true });
    expect(ids(r)).toContain('ittsu');
    const open = score('456789m234p99s', '9s', {
      isTsumo: true, melds: [meld('chi', '123m')],
    });
    // Still 1-9 in man, just open now: ittsu is worth 1 han.
    expect(ids(open)).toContain('ittsu');
    expect(open.yaku.find((y) => y.id === 'ittsu')?.han).toBe(1);
  });

  it('chanta: every set and the pair touch a terminal or honor', () => {
    const r = score('123m789m123p789pEE', 'E', { isTsumo: true });
    expect(ids(r)).toEqual(['chanta', 'menzenTsumo']);
    expect(r.han).toBe(3);
    expect(ids(r)).not.toContain('junchan'); // honors present
  });

  it('chanta drops to 1 han when open', () => {
    const r = score('123m789m123pEE', 'E', {
      isTsumo: true, melds: [meld('chi', '789p')],
    });
    expect(ids(r)).toContain('chanta');
    expect(r.yaku.find((y) => y.id === 'chanta')?.han).toBe(1);
  });

  it('a single missing set breaks chanta', () => {
    const r = score('123m789m234p789pEE', 'E', { isTsumo: true });
    expect(ids(r)).not.toContain('chanta');
  });

  it('toitoi: all four sets are triplets', () => {
    const r = score('222m333p444s99s', '9s', {
      isTsumo: true, melds: [meld('pon', '888p')],
    });
    expect(ids(r)).toEqual(['sanankou', 'toitoi']);
    expect(r.han).toBe(4);
  });

  it('toitoi needs no runs at all', () => {
    const r = score('222m333p445s99s', '9s', {
      isTsumo: true, melds: [meld('chi', '445s')],
    });
    expect(ids(r)).not.toContain('toitoi');
  });

  it('honitsu is 3 han closed and 2 open; chinitsu 6 and 5', () => {
    const closed = score('123456789m123mEE', 'E', { isTsumo: true });
    expect(closed.yaku.find((y) => y.id === 'honitsu')?.han).toBe(3);
    const open = score('456789m123mEE', 'E', {
      isTsumo: true, melds: [meld('pon', '111m')],
    });
    expect(open.yaku.find((y) => y.id === 'honitsu')?.han).toBe(2);

    const chinClosed = score('123456789m123m55m', '5m', { isTsumo: true });
    expect(chinClosed.yaku.find((y) => y.id === 'chinitsu')?.han).toBe(6);
    const chinOpen = score('456789m123m55m', '5m', {
      isTsumo: true, melds: [meld('chi', '123m')],
    });
    expect(chinOpen.yaku.find((y) => y.id === 'chinitsu')?.han).toBe(5);
    expect(ids(chinOpen)).not.toContain('honitsu');
  });

  it('ryanpeikou is closed only', () => {
    const closed = score('112233m112233p99s', '9s', { isTsumo: true });
    expect(ids(closed)).toContain('ryanpeikou');
    const open = score('112233m233p99s', '9s', {
      isTsumo: true, melds: [meld('chi', '123p')],
    });
    expect(ids(open)).not.toContain('ryanpeikou');
  });

  it('a lone iipeiko scores nothing in this ruleset', () => {
    // 112233m + 456p + 789s + 99s: one identical-run pair only.
    const r = score('112233m456p789s99s', '9s', { isTsumo: true });
    expect(ids(r)).not.toContain('ryanpeikou');
  });

  it('menzen tsumo needs a closed hand', () => {
    const closed = score('234m567m234p789s55s', '9s', { isTsumo: true });
    expect(ids(closed)).toContain('menzenTsumo');
    const open = score('567m234p789s55s', '9s', {
      isTsumo: true, melds: [meld('chi', '234m')],
    });
    expect(ids(open)).not.toContain('menzenTsumo');
  });

  it('an ankan keeps the hand closed; a pon does not', () => {
    const ankan = score('234m567m789p99s', '9s', {
      isTsumo: true, melds: [meld('ankan', '1111p')],
    });
    expect(ids(ankan)).toContain('menzenTsumo');
    const pon = score('234m567m789p99s', '9s', {
      isTsumo: true, melds: [meld('pon', '222p')],
    });
    expect(ids(pon)).not.toContain('menzenTsumo');
  });
});

describe('yaku — win legality', () => {
  it('a hand with no yaku is not a legal win and pays nothing', () => {
    const r = score('234m678m234p678s99s', '9s', { loserSeat: 2 });
    expect(r.yaku).toEqual([]);
    expect(r.points).toBe(0);
    expect(isLegalWin(r, CLEAN)).toBe(false);
  });

  it('dora alone never makes a hand legal', () => {
    const r = score('234m678m234p678s99s', '9s', {
      loserSeat: 2, doraIndicators: parse('8s'),
    });
    expect(r.dora).toBe(2); // the pair of 9s is dora twice
    expect(r.han).toBe(2);
    expect(isLegalWin(r, CLEAN)).toBe(false);
  });

  it('a one-han hand fails a two-han minimum', () => {
    const r = score('234m567m234p789s55s', '9s', { loserSeat: 2 });
    expect(r.han).toBe(1);
    expect(isLegalWin(r, CLEAN)).toBe(true);
    expect(isLegalWin(r, { ...CLEAN, twoHanMinimum: true })).toBe(false);
  });

  it('dora do not count toward the two-han minimum', () => {
    const r = score('234m567m234p789s55s', '9s', {
      loserSeat: 2, doraIndicators: parse('8s'),
    });
    expect(r.han).toBe(2); // pinfu + 1 dora
    expect(isLegalWin(r, { ...CLEAN, twoHanMinimum: true })).toBe(false);
  });

  it('two yaku han satisfy the minimum', () => {
    const r = score('234m567m234p678p55s', '8p', { loserSeat: 2 });
    expect(r.yaku).toHaveLength(2);
    expect(isLegalWin(r, { ...CLEAN, twoHanMinimum: true })).toBe(true);
  });

  it('open tanyao is illegal with kuitan off, legal with it on', () => {
    // The concealed triplet keeps this off pinfu, so tanyao is the only
    // possible yaku here (a pinfu-shaped hand would win legally either way).
    const melds = [meld('chi', '234m')];
    const off = score('567m234p666p55s', '6p', {
      loserSeat: 2, melds, settings: { ...CLEAN, kuitan: false },
    });
    expect(isLegalWin(off, { ...CLEAN, kuitan: false })).toBe(false);
    const on = score('567m234p666p55s', '6p', {
      loserSeat: 2, melds, settings: { ...CLEAN, kuitan: true },
    });
    expect(isLegalWin(on, { ...CLEAN, kuitan: true })).toBe(true);
  });
});

describe('yaku — decomposition choice', () => {
  it('returns a self-consistent result for ambiguous shapes', () => {
    // 334455m reads as 345m + 345m (all runs -> pinfu) rather than three pairs,
    // and whatever reading wins, the reported numbers must agree with each
    // other and with the payment table.
    const hands: [string, string][] = [
      ['334455m678p123s99s', '5m'],
      ['222345m567p789p99s', '5m'],
      ['1112345678999m5m', '5m'],
      ['11223344556677m', '7m'],
    ];
    for (const [h, w] of hands) {
      const r = score(h, w, { loserSeat: 2 });
      const yakuHan = r.yaku.reduce((n, y) => n + y.han, 0);
      const isYakuman = r.yaku.some((y) => y.yakuman);
      expect(r.han).toBe(isYakuman ? 13 : yakuHan + r.dora + r.akaDora + r.uraDora);
      const expected = ceil100(basePoints(r.fu, r.han) * 4);
      expect(r.points).toBe(r.yaku.length === 0 ? 0 : expected);
    }
  });

  it('scores a hand with no legal reading as empty', () => {
    // 12 concealed tiles and no melds: cannot be 4 sets + a pair.
    const r = scoreHand({
      hand: parse('123m456m789m11p2s'),
      melds: [],
      winningTile: parse('2s')[0],
      isTsumo: false,
      seatWind: 'south',
      roundWind: 'south',
      isDealer: false,
      riichi: false, doubleRiichi: false, ippatsu: false,
      haitei: false, houtei: false, rinshan: false, chankan: false,
      tenhou: false, chiihou: false, renhou: false,
      doraIndicators: [], uraIndicators: [], settings: CLEAN,
    });
    expect(r.yaku).toEqual([]);
    expect(r.points).toBe(0);
    expect(r.payments).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
  });
});

// ---------------------------------------------------------------------------
// Ippatsu is a one-go-around window, not a permanent flag
// ---------------------------------------------------------------------------

describe('ippatsu expiry', () => {
  const settings: TableSettings = { ...DEFAULT_SETTINGS, gameLength: 'east' };

  /** Play until `seat` is offered a riichi discard, then declare it. */
  function declareRiichi(seed: number): { state: GameState; seat: SeatIndex } | null {
    let s = createMatch(settings, seed);
    for (let i = 0; i < 600 && !s.handOver; i++) {
      let acted = false;
      for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
        const legal = getLegalActions(s, seat);
        if (!legal.length) continue;
        const r = legal.find(
          (l) => l.action.type === 'discard' && (l.action as { riichi?: boolean }).riichi,
        );
        if (r) return { state: applyAction(s, r.action), seat };
        // never call: a call would end the ippatsu window for a different reason
        const pass = legal.find((l) => l.action.type === 'pass');
        const draw = legal.find((l) => l.action.type === 'draw');
        const disc = legal.find((l) => l.action.type === 'discard');
        const pick = draw ?? pass ?? disc;
        if (!pick) continue;
        s = applyAction(s, pick.action);
        acted = true;
        break;
      }
      if (!acted) break;
    }
    return null;
  }

  it('is live the moment riichi is declared and dies on the declarer\'s next discard', () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      const got = declareRiichi(seed);
      if (!got) continue;
      found = true;
      let { state } = got;
      const seat = got.seat;
      expect(state.players[seat].ippatsu).toBe(true);

      // Walk forward with no calls until the declarer discards AGAIN —
      // ippatsu is still alive through that player's next draw (tsumo
      // ippatsu is legal), it only dies on the next discard.
      let sawDraw = false;
      let died = false;
      for (let i = 0; i < 80 && !died && !state.handOver; i++) {
        for (const s2 of [0, 1, 2, 3] as SeatIndex[]) {
          const legal = getLegalActions(state, s2);
          if (!legal.length) continue;
          const draw = legal.find((l) => l.action.type === 'draw');
          const pass = legal.find((l) => l.action.type === 'pass');
          const disc = legal.find((l) => l.action.type === 'discard');
          const pick = draw ?? pass ?? disc;
          if (!pick) continue;
          state = applyAction(state, pick.action);
          if (s2 === seat) {
            if (pick.action.type === 'draw') sawDraw = true;
            if (pick.action.type === 'discard' && sawDraw) died = true;
          }
          break;
        }
      }
      expect(died).toBe(true);
      expect(state.players[seat].ippatsu).toBe(false);
    }
    expect(found).toBe(true);
  });

  it('still scores on a tsumo with the declarer\'s next drawn tile', () => {
    // Declarer: 234m 123p 789s + 99m + 44p, riichi on the 9m, shanpon
    // wait 9m/4p. The opponents hold no manzu and cannot claim the 1p,
    // 7m or 1m the wall deals them, so the lap runs clean to the draw.
    const s = setupGame({
      hands: [
        '234m123p789s99m44p', // 0: declarer
        '123s456s789s99p22s',
        '234s567s899s33p77p',
        '111s222p456p78p99p',
      ],
      wall: '1p7m1m4p',
      dealer: 0,
      turn: 0,
      phase: 'awaitingDiscard',
      drawn: '9m',
    });
    const tileOf = (st: GameState, seat: SeatIndex, kind: number): TileId => {
      const drawn = st.players[seat].drawnTile;
      if (drawn !== null && kindOf(drawn) === kind) return drawn;
      return st.players[seat].hand.find((t) => kindOf(t) === kind)!;
    };
    const declared = applyAction(s, { type: 'discard', seat: 0, tile: tileOf(s, 0, K_9M), riichi: true });
    expect(declared.players[0].riichi).toBe(true);
    expect(declared.players[0].ippatsu).toBe(true);

    // One full lap, then the declarer draws.
    const d1 = applyAction(declared, { type: 'draw', seat: 1 });
    const d2 = applyAction(d1, { type: 'discard', seat: 1, tile: tileOf(d1, 1, K_1P) });
    const d3 = applyAction(d2, { type: 'draw', seat: 2 });
    const d4 = applyAction(d3, { type: 'discard', seat: 2, tile: tileOf(d3, 2, K_7M) });
    const d5 = applyAction(d4, { type: 'draw', seat: 3 });
    const d6 = applyAction(d5, { type: 'discard', seat: 3, tile: tileOf(d5, 3, K_1M) });
    const d7 = applyAction(d6, { type: 'draw', seat: 0 });
    expect(kindOf(d7.players[0].drawnTile!)).toBe(K_4P);
    // The flag is still live on this draw.
    expect(d7.players[0].ippatsu).toBe(true);

    const tsumo = getLegalActions(d7, 0).find((l) => l.action.type === 'tsumo');
    expect(tsumo).toBeDefined();
    const won = applyAction(d7, tsumo!.action);
    const r = won.handOver!;
    expect(r.reason).toBe('tsumo');
    expect(r.score!.yaku.map((y) => y.id)).toContain('ippatsu');
  });

  it('is broken by a kakan from another player', () => {
    const s = setupGame({
      hands: [
        '234m123p789s99m44p', // 0: declarer
        '345m678p2s99s1s', // 1: holds the 4th 2s over a called pon
        '123m456p789p11s44s',
        '234m567p89s11m22p88p',
      ],
      melds: [undefined, [{ type: 'pon', text: '222s', calledFrom: 0 }]],
      wall: '4p5p',
      dealer: 0,
      turn: 0,
      phase: 'awaitingDiscard',
      drawn: '9m',
    });
    const tileOf = (st: GameState, seat: SeatIndex, kind: number): TileId => {
      const drawn = st.players[seat].drawnTile;
      if (drawn !== null && kindOf(drawn) === kind) return drawn;
      return st.players[seat].hand.find((t) => kindOf(t) === kind)!;
    };
    const declared = applyAction(s, { type: 'discard', seat: 0, tile: tileOf(s, 0, K_9M), riichi: true });
    expect(declared.players[0].ippatsu).toBe(true);

    const d1 = applyAction(declared, { type: 'draw', seat: 1 });
    const kakanTile = d1.players[1].hand.find((t) => kindOf(t) === K_2S)!;
    const kakan = applyAction(d1, { type: 'kakan', seat: 1, tile: kakanTile });
    // Any tile call ends ippatsu — a kan is no exception (a chankan is a
    // win, not a call, so it does not reach this path).
    expect(kakan.players[0].ippatsu).toBe(false);
    expect(kakan.players[1].melds.some((m) => m.type === 'kakan')).toBe(true);
  });
});
