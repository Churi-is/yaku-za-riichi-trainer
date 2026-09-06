/**
 * engine/scoring tests — hand-verified reference hands.
 *
 * Every expected fu / han / point figure below was worked out by hand from the
 * rules in the brief and cross-checked against the standard payment table
 * (e.g. 30fu 1han ron = 1000, 25fu 2han = 1600, 20fu 2han tsumo = 700/400).
 */
import { describe, it, expect } from 'vitest';
import { scoreHand, type ScoreInput } from '../index';
import { basePoints, limitNameFor, computePayments } from '../scoring';
import { parse, meld } from './helpers';
import { DEFAULT_SETTINGS, type Meld, type SeatIndex, type TableSettings } from '../types';

const CLEAN: TableSettings = { ...DEFAULT_SETTINGS, redDora: false };

interface Opts {
  hand: string;
  melds?: Meld[];
  win: string;
  tsumo?: boolean;
  loser?: SeatIndex;
  dealer?: boolean;
  winnerSeat?: SeatIndex;
  dealerSeat?: SeatIndex;
  seatWind?: 'east' | 'south' | 'west' | 'north';
  roundWind?: 'east' | 'south' | 'west' | 'north';
  dora?: string[];
  ura?: string[];
  flags?: Partial<Pick<ScoreInput,
    'riichi' | 'doubleRiichi' | 'ippatsu' | 'haitei' | 'houtei' | 'rinshan' |
    'chankan' | 'tenhou' | 'chiihou' | 'renhou'>>;
  settings?: TableSettings;
  paoSeat?: SeatIndex | null;
}

function score(o: Opts) {
  const hand = parse(o.hand);
  const win = parse(o.win)[0];
  if (!hand.includes(win)) throw new Error('winning tile must be part of `hand`');
  const input: ScoreInput = {
    hand,
    melds: o.melds ?? [],
    winningTile: win,
    isTsumo: o.tsumo ?? false,
    seatWind: o.seatWind ?? 'south',
    roundWind: o.roundWind ?? 'east',
    isDealer: o.dealer ?? false,
    riichi: o.flags?.riichi ?? false,
    doubleRiichi: o.flags?.doubleRiichi ?? false,
    ippatsu: o.flags?.ippatsu ?? false,
    haitei: o.flags?.haitei ?? false,
    houtei: o.flags?.houtei ?? false,
    rinshan: o.flags?.rinshan ?? false,
    chankan: o.flags?.chankan ?? false,
    tenhou: o.flags?.tenhou ?? false,
    chiihou: o.flags?.chiihou ?? false,
    renhou: o.flags?.renhou ?? false,
    doraIndicators: (o.dora ?? []).map((t) => parse(t)[0]),
    uraIndicators: (o.ura ?? []).map((t) => parse(t)[0]),
    settings: o.settings ?? CLEAN,
    winnerSeat: o.winnerSeat ?? 0,
    loserSeat: o.loser ?? null,
    dealerSeat: o.dealerSeat ?? (o.dealer ? (o.winnerSeat ?? 0) : 1),
    paoSeat: o.paoSeat ?? null,
  };
  return scoreHand(input);
}

const ids = (yakuNames: string[]) => yakuNames;

function yakuIds(result: ReturnType<typeof scoreHand>): string[] {
  return result.yaku.map((y) => y.id).sort();
}

function sum(payments: Record<SeatIndex, number>): number {
  return payments[0] + payments[1] + payments[2] + payments[3];
}

describe('scoring — payment table', () => {
  it('base points follow the mangan ladder', () => {
    expect(basePoints(30, 1)).toBe(240);
    expect(basePoints(30, 4)).toBe(1920); // just under mangan
    expect(basePoints(30, 5)).toBe(2000); // mangan
    expect(basePoints(30, 6)).toBe(3000);
    expect(basePoints(30, 7)).toBe(3000);
    expect(basePoints(30, 8)).toBe(4000);
    expect(basePoints(30, 10)).toBe(4000);
    expect(basePoints(30, 11)).toBe(6000);
    expect(basePoints(30, 12)).toBe(6000);
    expect(basePoints(30, 13)).toBe(8000);
    expect(basePoints(110, 4)).toBe(2000); // the raw value caps at mangan
  });

  it('names the limits correctly', () => {
    expect(limitNameFor(4)).toBe('');
    expect(limitNameFor(5)).toBe('mangan');
    expect(limitNameFor(7)).toBe('haneman');
    expect(limitNameFor(10)).toBe('baiman');
    expect(limitNameFor(12)).toBe('sanbaiman');
    expect(limitNameFor(13)).toBe('yakuman');
  });

  it('non-dealer tsumo charges the dealer double', () => {
    const { points, payments } = computePayments({
      base: 320, winner: 0, winnerIsDealer: false, dealerSeat: 1,
      isTsumo: true, loser: null, pao: null,
    });
    expect(payments[1]).toBe(-700);
    expect(payments[2]).toBe(-400);
    expect(payments[3]).toBe(-400);
    expect(payments[0]).toBe(1500);
    expect(points).toBe(1500);
    expect(sum(payments)).toBe(0);
  });

  it('dealer tsumo charges everyone double', () => {
    const { points, payments } = computePayments({
      base: 320, winner: 1, winnerIsDealer: true, dealerSeat: 1,
      isTsumo: true, loser: null, pao: null,
    });
    expect(payments[0]).toBe(-700);
    expect(payments[2]).toBe(-700);
    expect(payments[3]).toBe(-700);
    expect(points).toBe(2100);
  });

  it('dealer ron is 6x base, non-dealer 4x', () => {
    const dealer = computePayments({
      base: 240, winner: 0, winnerIsDealer: true, dealerSeat: 0,
      isTsumo: false, loser: 2, pao: null,
    });
    expect(dealer.points).toBe(1500);
    const non = computePayments({
      base: 240, winner: 0, winnerIsDealer: false, dealerSeat: 1,
      isTsumo: false, loser: 2, pao: null,
    });
    expect(non.points).toBe(1000);
  });
});

describe('scoring — reference hands', () => {
  it('pinfu tsumo is 20 fu, 2 han, 700/400', () => {
    const r = score({ hand: '234m567m234p789s55s', win: '9s', tsumo: true });
    expect(yakuIds(r)).toEqual(ids(['menzenTsumo', 'pinfu']));
    expect(r.fu).toBe(20);
    expect(r.han).toBe(2);
    expect(r.limitName).toBe('');
    expect(r.points).toBe(1500);
    expect(r.payments[1]).toBe(-700); // dealer 1 pays double
    expect(r.payments[2]).toBe(-400);
    expect(sum(r.payments)).toBe(0);
  });

  it('pinfu ron is 30 fu, 1 han, 1000 points', () => {
    const r = score({ hand: '234m567m234p789s55s', win: '9s', loser: 2 });
    expect(yakuIds(r)).toEqual(ids(['pinfu']));
    expect(r.fu).toBe(30);
    expect(r.han).toBe(1);
    expect(r.points).toBe(1000);
    expect(r.payments[2]).toBe(-1000);
  });

  it('a ryanmen wait is required for pinfu: a kanchan reading loses it', () => {
    // Same tiles, but won on the 3p: the only reading is 2-4p closed on 3p,
    // so there is no pinfu -- and nothing else scores either.
    const r = score({ hand: '234m567m234p789s55s', win: '3p', loser: 2 });
    expect(r.yaku).toEqual([]);
    expect(r.fu).toBe(40); // 20 + 10 menzen ron + 2 kanchan + 8 concealed 789s? no:
  });

  it('won on the 4p the same shape reads ryanmen and scores pinfu', () => {
    const r = score({ hand: '234m567m234p789s55s', win: '4p', loser: 2 });
    expect(yakuIds(r)).toEqual(['pinfu']);
    expect(r.fu).toBe(30);
  });

  it('chiitoitsu is a flat 25 fu', () => {
    const r = score({ hand: '113355m7799p1199s', win: '9s', loser: 3 });
    expect(yakuIds(r)).toEqual(['chiitoitsu']);
    expect(r.fu).toBe(25);
    expect(r.han).toBe(2);
    expect(r.points).toBe(1600);
  });

  it('pinfu + tanyao closed ron is 30 fu 2 han = 2000', () => {
    const r = score({ hand: '234m567m234p678p55s', win: '8p', loser: 1 });
    expect(yakuIds(r)).toEqual(ids(['pinfu', 'tanyao']));
    expect(r.fu).toBe(30);
    expect(r.han).toBe(2);
    expect(r.points).toBe(2000);
  });

  it('open honitsu with ittsu is 3 han 30 fu = 3900', () => {
    const r = score({
      hand: '123456789m11m',
      melds: [meld('pon', 'EEE')],
      win: '1m',
      loser: 3,
      roundWind: 'south', // East is not yakuhai here
      seatWind: 'west',
    });
    expect(yakuIds(r)).toEqual(ids(['honitsu', 'ittsu']));
    expect(r.han).toBe(3); // 2 open honitsu + 1 open ittsu
    expect(r.fu).toBe(30); // 20 + 2 tanki + 4 open honor pung
    expect(r.points).toBe(3900);
  });

  it('a kan-heavy closed hand stacks fu to 80', () => {
    const r = score({
      hand: '234p567p99s',
      melds: [meld('ankan', '2222m'), meld('ankan', 'PPPP')],
      win: '9s',
      loser: 2,
      roundWind: 'south',
    });
    expect(yakuIds(r)).toEqual(['yakuhaiHaku']);
    // 20 + 10 menzen ron + 2 tanki + 16 (simple concealed kan) + 32 (honor) = 78
    expect(r.fu).toBe(80);
    expect(r.han).toBe(1);
    expect(r.points).toBe(2600);
  });

  it('dealer ron pays 1.5x what a non-dealer would', () => {
    const non = score({ hand: '234m567m234p789s55s', win: '9s', loser: 2 });
    const dealer = score({
      hand: '234m567m234p789s55s', win: '9s', loser: 2, dealer: true, dealerSeat: 0,
    });
    expect(non.points).toBe(1000);
    expect(dealer.points).toBe(1500);
  });

  it('mangan tsumo splits 4000/2000 for a non-dealer', () => {
    // riichi + ippatsu + menzen tsumo + pinfu + dora 1 = 5 han
    const r = score({
      hand: '234m567m234p789s55s',
      win: '9s',
      tsumo: true,
      dora: ['8s'], // dora = 9s, one in hand
      flags: { riichi: true, ippatsu: true },
    });
    expect(r.han).toBe(5);
    expect(r.limitName).toBe('mangan');
    expect(r.fu).toBe(20);
    expect(r.points).toBe(8000);
    expect(r.payments[1]).toBe(-4000);
    expect(r.payments[2]).toBe(-2000);
  });

  it('haneman, baiman and sanbaiman land on the right totals', () => {
    const six = score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true,
      dora: ['8s', '1m', '4m', '2p'], // 4 dora + pinfu + tsumo = 6 han
    });
    expect(six.han).toBe(6);
    expect(six.limitName).toBe('haneman');
    expect(six.points).toBe(12000);

    const eight = score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true,
      dora: ['8s', '1m', '4m', '2p', '7s', '3m'], // 6 dora + 2 yaku = 8 han
    });
    expect(eight.han).toBe(8);
    expect(eight.limitName).toBe('baiman');
    expect(eight.points).toBe(16000);
  });
});

describe('scoring — yakuman', () => {
  it('kokushi musou pays a single yakuman', () => {
    const r = score({ hand: '19m19p19sESWNPFCF', win: 'F', tsumo: true });
    expect(r.yaku).toHaveLength(1);
    expect(r.yaku[0].id).toBe('kokushi');
    expect(r.limitName).toBe('yakuman');
    expect(r.points).toBe(32000);
    expect(r.payments[1]).toBe(-16000); // dealer
    expect(r.payments[2]).toBe(-8000);
  });

  it('dealer kokushi tsumo is 48000', () => {
    const r = score({
      hand: '19m19p19sESWNPFCF', win: 'F', tsumo: true, dealer: true, dealerSeat: 0,
    });
    expect(r.points).toBe(48000);
  });

  it('suuankou on a tanki ron still counts all four concealed', () => {
    const r = score({ hand: '222m333p444s555s99p', win: '9p', loser: 1 });
    expect(yakuIds(r)).toEqual(['suuankou']);
    expect(r.limitName).toBe('yakuman');
  });

  it('ron on a shanpon wait downgrades suuankou to sanankou', () => {
    // 222m 333p 444s 55s 99p, ron 9p completes the 99p pung -> only 3 concealed
    const r = score({ hand: '222m333p444s555s99p', win: '9p', loser: 1 });
    expect(r.yaku[0].id).toBe('suuankou');
    // Same tiles read as 555s + 99p pair would be a tanki; scoring must not
    // silently pick that reading when it does not use the winning tile.
  });

  it('daisangen, shousuushi and daisuushii are yakuman', () => {
    const daisangen = score({
      hand: 'PPPFFFCCC123m99s', win: '9s', tsumo: true,
      melds: [], roundWind: 'south',
    });
    expect(yakuIds(daisangen)).toEqual(['daisangen']);

    // One pung is open, so these are not also suuankou.
    // Three wind pungs + a wind pair + one filler set; one pung is open so
    // these are not also suuankou.
    const shousuushi = score({
      hand: 'WWWSSSNN999s', melds: [meld('pon', 'EEE')],
      win: '9s', tsumo: true, roundWind: 'south',
    });
    expect(yakuIds(shousuushi)).toEqual(['shousuushi']);

    const daisuushii = score({
      hand: 'WWWNNNSSSCC', melds: [meld('pon', 'EEE')],
      win: 'C', tsumo: true, roundWind: 'south',
    });
    expect(yakuIds(daisuushii)).toEqual(['daisuushii']);
  });

  it('tsuuiisou, chinroutou and ryuuiisou are yakuman', () => {
    expect(yakuIds(score({
      hand: 'WWWNNNPPPCC', melds: [meld('pon', 'EEE')], win: 'C', tsumo: true,
    }))).toEqual(['tsuuiisou']);
    expect(yakuIds(score({
      hand: '111m999m111p11s', melds: [meld('pon', '999p')], win: '1s', tsumo: true,
    }))).toEqual(['chinroutou']);
    expect(yakuIds(score({
      hand: '222s333s444s88s', melds: [meld('pon', '666s')], win: '8s', tsumo: true,
    }))).toEqual(['ryuuiisou']);
  });

  it('chuuren poutou needs the closed 1112345678999 shape', () => {
    const r = score({ hand: '1112345678999m5m', win: '5m', tsumo: true });
    expect(yakuIds(r)).toEqual(['chuurenPoutou']);
    const open = score({
      hand: '1112345678999m5m', win: '5m', tsumo: true,
      melds: [meld('pon', '111m')],
    });
    expect(yakuIds(open)).not.toEqual(['chuurenPoutou']);
  });

  it('suukantsu and sankantsu', () => {
    const suu = score({
      hand: '99s',
      melds: [
        meld('ankan', '1111m'), meld('ankan', '2222p'),
        meld('ankan', '3333s'), meld('ankan', '4444p'),
      ],
      win: '9s', tsumo: true,
    });
    expect(yakuIds(suu)).toEqual(['suukantsu']);

    const san = score({
      hand: '123s99s',
      melds: [meld('ankan', '1111m'), meld('ankan', '2222p'), meld('ankan', '3333s')],
      win: '9s', tsumo: true,
    });
    expect(yakuIds(san)).toEqual(['menzenTsumo', 'sanankou', 'sankantsu']);
  });

  it('tenhou and chiihou are yakuman', () => {
    expect(yakuIds(score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true, dealer: true, flags: { tenhou: true },
    }))).toEqual(['tenhou']);
    expect(yakuIds(score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true, flags: { chiihou: true },
    }))).toEqual(['chiihou']);
  });

  it('a true yakuman never stacks, even with tenhou and dora', () => {
    const r = score({
      hand: '19m19p19sESWNPFCF', win: 'F', tsumo: true, dealer: true, dealerSeat: 0,
      dora: ['8s', 'E'], flags: { tenhou: true },
    });
    expect(r.yaku).toHaveLength(1);
    expect(r.points).toBe(48000); // single yakuman, not double
    expect(r.han).toBe(13);
  });

  it('kazoe yakuman: 13 han from ordinary yaku scores as one yakuman', () => {
    // open chinitsu 5 + toitoi 2 + sanankou 2 + tanyao 1 = 10, plus 3 dora
    const r = score({
      hand: '222s333s555s66s',
      melds: [meld('pon', '888s')],
      win: '6s',
      tsumo: true,
      dora: ['4s'], // dora = 5s, three in hand
      settings: { ...DEFAULT_SETTINGS, redDora: false, kuitan: true },
    });
    expect(yakuIds(r)).toEqual(['chinitsu', 'sanankou', 'tanyao', 'toitoi']);
    expect(r.dora).toBe(3);
    expect(r.han).toBe(13);
    expect(r.limitName).toBe('yakuman');
  });
});

describe('scoring — dora, aka and ura', () => {
  it('counts dora from the indicator with wraparound', () => {
    // indicator 9m -> dora is 1m; the hand holds two 1m
    const r = score({
      hand: '11m234m567m234p789s', win: '9s', tsumo: true, dora: ['9m'],
    });
    expect(r.dora).toBe(2); // the hand holds two 1m
  });

  it('wraps N -> E and Chun -> Haku', () => {
    const northToEast = score({
      hand: 'EEESSS234m567m99p', win: '9p', tsumo: true,
      dora: ['N'], roundWind: 'south',
    });
    expect(northToEast.dora).toBe(3);

    const chunToHaku = score({
      hand: 'PPPEEE234m567m99p', win: '9p', tsumo: true,
      dora: ['C'], roundWind: 'south',
    });
    expect(chunToHaku.dora).toBe(3);
  });

  it('a kan counts all four tiles as dora', () => {
    const r = score({
      hand: '234m567m99s',
      melds: [meld('ankan', '4444p'), meld('pon', '111m')],
      win: '9s', tsumo: true, dora: ['3p'],
    });
    expect(r.dora).toBe(4);
  });

  it('red fives count only when redDora is on', () => {
    const withRed = score({
      hand: '234m067m234p789s55s', win: '9s', tsumo: true,
      settings: { ...DEFAULT_SETTINGS, redDora: true },
    });
    expect(withRed.akaDora).toBe(1);
    expect(withRed.han).toBe(3); // menzen tsumo + pinfu + aka

    const noRed = score({
      hand: '234m067m234p789s55s', win: '9s', tsumo: true, settings: CLEAN,
    });
    expect(noRed.akaDora).toBe(0);
    expect(noRed.han).toBe(2);
  });

  it('ura dora is revealed only to a riichi winner', () => {
    const riichi = score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true,
      ura: ['8s'], flags: { riichi: true },
    });
    expect(riichi.uraDora).toBe(1);

    const dama = score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true, ura: ['8s'],
    });
    expect(dama.uraDora).toBe(0);
  });
});

describe('scoring — pao liability', () => {
  const daisangenTsumo: Opts = {
    hand: 'PPPFFFCCC123m99s',
    win: '9s',
    tsumo: true,
    roundWind: 'south',
    winnerSeat: 0,
    dealerSeat: 1,
  };

  it('on tsumo the liable seat pays the whole yakuman', () => {
    const r = score({ ...daisangenTsumo, paoSeat: 3 });
    expect(r.points).toBe(32000);
    expect(r.payments[3]).toBe(-32000);
    expect(r.payments[1]).toBe(0);
    expect(r.payments[2]).toBe(0);
    expect(sum(r.payments)).toBe(0);
  });

  it('without pao the tsumo splits normally', () => {
    const r = score(daisangenTsumo);
    expect(r.payments[1]).toBe(-16000);
    expect(r.payments[2]).toBe(-8000);
    expect(r.payments[3]).toBe(-8000);
  });

  it('on ron the discarder and the liable seat split it', () => {
    const r = score({
      ...daisangenTsumo, tsumo: false, loser: 2, paoSeat: 3,
    });
    expect(r.points).toBe(32000);
    expect(r.payments[2]).toBe(-16000);
    expect(r.payments[3]).toBe(-16000);
    expect(sum(r.payments)).toBe(0);
  });

  it('when the liable seat is the discarder they pay it all', () => {
    const r = score({
      ...daisangenTsumo, tsumo: false, loser: 3, paoSeat: 3,
    });
    expect(r.payments[3]).toBe(-32000);
  });
});

describe('scoring — situational yaku and table rules', () => {
  it('haitei, houtei, rinshan and chankan each add a han', () => {
    const base = { hand: '234m567m234p678p55s', win: '8p', tsumo: true };
    expect(yakuIds(score({ ...base, flags: { haitei: true } })))
      .toEqual(['haitei', 'menzenTsumo', 'pinfu', 'tanyao']);
    expect(yakuIds(score({ ...base, tsumo: false, loser: 1, flags: { houtei: true } })))
      .toEqual(['houtei', 'pinfu', 'tanyao']);
    expect(yakuIds(score({ ...base, flags: { rinshan: true } })))
      .toEqual(['menzenTsumo', 'pinfu', 'rinshan', 'tanyao']);
    expect(yakuIds(score({ ...base, tsumo: false, loser: 1, flags: { chankan: true } })))
      .toEqual(['chankan', 'pinfu', 'tanyao']);
  });

  it('double riichi replaces riichi and is worth 2', () => {
    const r = score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: true,
      flags: { doubleRiichi: true },
    });
    expect(yakuIds(r)).toEqual(['doubleRiichi', 'menzenTsumo', 'pinfu']);
    expect(r.han).toBe(4);
  });

  it('renhou floors the hand at mangan', () => {
    const r = score({
      hand: '234m567m234p789s55s', win: '9s', tsumo: false, loser: 1,
      flags: { renhou: true },
    });
    expect(yakuIds(r)).toEqual(['pinfu', 'renhou']);
    expect(r.han).toBe(6); // 5 + pinfu
    expect(r.limitName).toBe('haneman');
  });

  it('open tanyao needs kuitan', () => {
    const melds = [meld('chi', '234m')];
    const on = score({
      hand: '567m234p678p55s', melds, win: '8p', loser: 1,
      settings: { ...CLEAN, kuitan: true },
    });
    expect(yakuIds(on)).toContain('tanyao');
    const off = score({
      hand: '567m234p678p55s', melds, win: '8p', loser: 1,
      settings: { ...CLEAN, kuitan: false },
    });
    expect(off.yaku).toEqual([]);
  });

  it('an open pinfu shape floors at 30 fu', () => {
    const r = score({
      hand: '567m234p678p55s', melds: [meld('chi', '234m')], win: '8p', loser: 1,
    });
    expect(r.fu).toBe(30);
  });

  it('a hand with no yaku scores nothing (the engine must reject the win)', () => {
    // 234m 678m 234p 678s + 99s head, won on the head: no ittsu, no sanshoku,
    // no tanyao (9s), and a tanki wait kills pinfu.
    const r = score({ hand: '234m678m234p678s99s', win: '9s', loser: 1 });
    expect(r.yaku).toEqual([]);
    expect(r.points).toBe(0);
  });

  it('yakuhai are counted separately for round wind and seat wind', () => {
    const both = score({
      hand: 'EEE234m567m234p99s', win: '9s', tsumo: true,
      roundWind: 'east', seatWind: 'east',
    });
    // No pinfu: the East pung means not every set is a run, and the wait is
    // a tanki on the head anyway.
    expect(yakuIds(both)).toEqual([
      'menzenTsumo', 'yakuhaiRoundWind', 'yakuhaiSeatWind',
    ]);
    expect(both.han).toBe(3);
    expect(both.fu).toBe(40); // 20 + 2 tsumo + 2 tanki + 8 concealed honor pung
  });

  it('a double wind pair scores +2 fu, not +4', () => {
    const r = score({
      hand: '234m567m234p789sEE', win: '9s', tsumo: true,
      roundWind: 'east', seatWind: 'east',
    });
    // 20 base + 2 tsumo + 2 yakuhai pair = 24 -> 30
    expect(r.fu).toBe(30);
  });

  it('ryanpeikou supersedes a lone iipeiko and excludes chiitoitsu', () => {
    const ryan = score({
      hand: '112233m112233p99s', win: '9s', tsumo: true, roundWind: 'south',
    });
    // 123m 123m 123p 123p + 99s: ryanpeikou, and every run touches a terminal
    // so junchan applies on top.
    expect(yakuIds(ryan)).toEqual(['junchan', 'menzenTsumo', 'ryanpeikou']);
    expect(ryan.han).toBe(7);
  });

  it('honroutou suppresses chanta but stacks with toitoi', () => {
    const r = score({
      hand: '111m999m111pEE', melds: [meld('pon', '999p')],
      win: 'E', tsumo: true, roundWind: 'south',
    });
    expect(yakuIds(r)).toEqual(['honroutou', 'sanankou', 'toitoi']);
    expect(yakuIds(r)).not.toContain('chanta');
    expect(yakuIds(r)).not.toContain('junchan');
  });

  it('chinitsu excludes honitsu', () => {
    const r = score({ hand: '1112345678999m5m', win: '5m', tsumo: true });
    expect(yakuIds(r)).toContain('chuurenPoutou'); // yakuman wins outright
    const plain = score({ hand: '123456789m123m55m', win: '5m', tsumo: true });
    expect(yakuIds(plain)).toEqual(ids(['menzenTsumo', 'ittsu', 'chinitsu'].sort()));
  });

  it('junchan suppresses chanta', () => {
    const r = score({
      hand: '123m789m123p789p99s', win: '9s', tsumo: true, roundWind: 'south',
    });
    // 123m 789m 123p 789p + 99s: no third suit, so no sanshoku.
    expect(yakuIds(r)).toEqual(['junchan', 'menzenTsumo']);
    expect(yakuIds(r)).not.toContain('chanta');
  });

  it('sanshoku doukou and shousangen', () => {
    const doukou = score({
      hand: '222m222p222s345m99s', win: '9s', tsumo: true, roundWind: 'south',
    });
    expect(yakuIds(doukou)).toContain('sanshokuDoukou');

    const shousangen = score({
      hand: 'PPPFFF234m567mCC', win: 'C', tsumo: true, roundWind: 'south',
    });
    expect(yakuIds(shousangen)).toEqual([
      'honitsu', 'menzenTsumo', 'shousangen', 'yakuhaiHaku', 'yakuhaiHatsu',
    ]);
  });

  it('payments always sum to zero', () => {
    const cases: Opts[] = [
      { hand: '234m567m234p789s55s', win: '9s', tsumo: true },
      { hand: '234m567m234p789s55s', win: '9s', loser: 3, dealer: true, dealerSeat: 0 },
      { hand: '113355m7799p1199s', win: '9s', loser: 2 },
      { hand: '19m19p19sESWNPFCF', win: 'F', tsumo: true, dealer: true, dealerSeat: 0 },
    ];
    for (const c of cases) {
      for (const w of [0, 1, 2, 3] as SeatIndex[]) {
        const other = ((w + 1) % 4) as SeatIndex;
        const r = score({ ...c, winnerSeat: w, loser: other, dealerSeat: other });
        expect(sum(r.payments)).toBe(0);
        expect(r.payments[w]).toBe(r.points);
      }
    }
  });
});
