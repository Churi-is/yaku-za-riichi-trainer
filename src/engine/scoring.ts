/**
 * engine/scoring — han/fu table, payments, and `scoreHand`.
 *
 * Mangan 5 han, haneman 6-7, baiman 8-10, sanbaiman 11-12, 13+ = counted
 * yakuman. Kazoe yakuman and true yakuman both pay a SINGLE yakuman: no
 * stacking, no double yakuman.
 *
 * `scoreHand` enumerates every legal reading of the hand (see decompose.ts)
 * and returns the one that pays most, which is what a player is entitled to.
 */
import { countsFromIds, doraKindForIndicator, isRed, kindOf, SEATS } from './tiles';
import { enumerateWinShapes, type WinShape } from './decompose';
import { calculateFu } from './fu';
import { detectYaku, totalHan, type YakuFlags } from './yaku';
import type {
  Meld, ScoreResult, SeatIndex, TableSettings, TileId, YakuHit
} from './types';
import type { ScoreInput } from './index';

const YAKUMAN_HAN = 13;

export function ceil100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

/** The "base points" figure every payment is derived from. */
export function basePoints(fu: number, han: number): number {
  if (han >= 13) return 8000; // counted yakuman
  if (han >= 11) return 6000; // sanbaiman
  if (han >= 8) return 4000; // baiman
  if (han >= 6) return 3000; // haneman
  if (han >= 5) return 2000; // mangan
  const raw = fu * Math.pow(2, han + 2);
  return raw >= 2000 ? 2000 : raw; // mangan cutoff
}

export function limitNameFor(han: number): ScoreResult['limitName'] {
  if (han >= 13) return 'yakuman';
  if (han >= 11) return 'sanbaiman';
  if (han >= 8) return 'baiman';
  if (han >= 6) return 'haneman';
  if (han >= 5) return 'mangan';
  return '';
}

interface PaymentInput {
  base: number;
  winner: SeatIndex;
  /** Winner is the dealer. */
  winnerIsDealer: boolean;
  /** Seat wind of the table's dealer, so tsumo splits the dealer share right. */
  dealerSeat: SeatIndex;
  isTsumo: boolean;
  /** Ron only: who discarded into the hand. */
  loser: SeatIndex | null;
  /** Pao liability seat (daisangen / daisuushii). */
  pao: SeatIndex | null;
}

/**
 * Base point movement, excluding honba and riichi sticks.
 * Winner is positive, payers negative, and the four always sum to zero.
 */
export function computePayments(input: PaymentInput): {
  points: number;
  payments: Record<SeatIndex, number>;
} {
  const payments: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const { base, winner, isTsumo, winnerIsDealer, dealerSeat, loser, pao } = input;

  if (!isTsumo && loser !== null) {
    const total = ceil100(base * (winnerIsDealer ? 6 : 4));
    if (pao !== null && pao !== loser) {
      // Split on ron: the discarder and the liable player each cover half.
      const fromLoser = ceil100(total / 2);
      payments[loser] -= fromLoser;
      payments[pao] -= total - fromLoser;
    } else {
      payments[loser] -= total;
    }
    payments[winner] += total;
    return { points: total, payments };
  }

  // Tsumo.
  const shares: { seat: SeatIndex; amount: number }[] = [];
  for (const s of SEATS) {
    if (s === winner) continue;
    const paysDouble = winnerIsDealer || s === dealerSeat;
    shares.push({ seat: s, amount: ceil100(base * (paysDouble ? 2 : 1)) });
  }
  const total = shares.reduce((n, x) => n + x.amount, 0);

  if (pao !== null) {
    // Pao on tsumo: the liable player covers the whole hand.
    payments[pao] -= total;
  } else {
    for (const share of shares) payments[share.seat] -= share.amount;
  }
  payments[winner] += total;
  return { points: total, payments };
}

function countIndicators(counts: number[], indicators: TileId[]): number {
  let n = 0;
  for (const ind of indicators) n += counts[doraKindForIndicator(kindOf(ind))] ?? 0;
  return n;
}

/** Dora / aka / ura across the whole hand, kans counting all four tiles. */
function countDora(
  hand: TileId[], melds: Meld[], doraIndicators: TileId[], settings: TableSettings,
): { dora: number; aka: number } {
  const counts = countsFromIds(hand);
  for (const m of melds) for (const id of m.tiles) counts[kindOf(id)]++;
  let aka = 0;
  if (settings.redDora) {
    for (const id of hand) if (isRed(id)) aka++;
    for (const m of melds) for (const id of m.tiles) if (isRed(id)) aka++;
  }
  return { dora: countIndicators(counts, doraIndicators), aka };
}

function emptyResult(): ScoreResult {
  return {
    yaku: [], han: 0, fu: 0, dora: 0, akaDora: 0, uraDora: 0,
    points: 0, payments: { 0: 0, 1: 0, 2: 0, 3: 0 }, limitName: '',
  };
}

/** Score a completed hand, for engine settlement and hypothetical AI evaluations. */
export function scoreHand(input: ScoreInput): ScoreResult {
  const shapes = enumerateWinShapes(input.hand, input.melds, input.winningTile);
  if (shapes.length === 0) return emptyResult();

  const winKind = kindOf(input.winningTile);
  const isClosed = input.melds.every((m) => m.concealed);
  const flags: YakuFlags = {
    riichi: input.riichi,
    doubleRiichi: input.doubleRiichi,
    ippatsu: input.ippatsu,
    haitei: input.haitei,
    houtei: input.houtei,
    rinshan: input.rinshan,
    chankan: input.chankan,
    tenhou: input.tenhou,
    chiihou: input.chiihou,
    renhou: input.renhou,
  };

  const { dora, aka } = countDora(input.hand, input.melds, input.doraIndicators, input.settings);
  const winnerIsRiichi = input.riichi || input.doubleRiichi;
  const ura = winnerIsRiichi
    ? countIndicators(countsForUra(input.hand, input.melds), input.uraIndicators)
    : 0;

  const winner = (input.winnerSeat ?? 0) as SeatIndex;
  const loser = (input.loserSeat ?? null) as SeatIndex | null;
  const pao = (input.paoSeat ?? null) as SeatIndex | null;
  const dealerSeat = (input.dealerSeat ?? winner) as SeatIndex;

  let best: { shape: WinShape; yaku: YakuHit[]; fu: number; han: number; points: number } | null =
    null;

  for (const shape of shapes) {
    const yaku = detectYaku(shape, {
      isClosed,
      isTsumo: input.isTsumo,
      seatWind: input.seatWind,
      roundWind: input.roundWind,
      winKind,
      settings: input.settings,
      flags,
    });
    const fu = calculateFu(shape.d, shape.wait, input.isTsumo, isClosed, winKind, {
      seatWind: input.seatWind,
      roundWind: input.roundWind,
    });
    const isYakuman = yaku.some((y) => y.yakuman);
    // A true yakuman scores as one yakuman and ignores dora; kazoe yakuman is
    // just a han count that happens to reach 13.
    const han = isYakuman ? YAKUMAN_HAN : totalHan(yaku) + dora + aka + ura;
    const base = basePoints(fu, han);
    const { points } = computePayments({
      base, winner, winnerIsDealer: input.isDealer, dealerSeat,
      isTsumo: input.isTsumo, loser, pao,
    });
    // The player is entitled to the reading that pays most; ties break on han
    // then fu so the reported figures match the money.
    const rank = isYakuman ? 1 : 0;
    const bestRank = best ? (best.yaku.some((y) => y.yakuman) ? 1 : 0) : -1;
    const better =
      best === null ||
      rank > bestRank ||
      (rank === bestRank &&
        (points > best.points ||
          (points === best.points &&
            (han > best.han || (han === best.han && fu > best.fu)))));
    if (better) best = { shape, yaku, fu, han, points };
  }

  if (!best) return emptyResult();

  const isYakuman = best.yaku.some((y) => y.yakuman);
  const { payments } = computePayments({
    base: basePoints(best.fu, best.han),
    winner,
    winnerIsDealer: input.isDealer,
    dealerSeat,
    isTsumo: input.isTsumo,
    loser,
    pao,
  });

  // A hand with no yaku cannot win, so it must not move any points. Callers
  // should still gate on `isLegalWin` (which also enforces the two-han
  // minimum), but returning zero here means a missed check cannot pay out.
  if (best.yaku.length === 0) {
    return {
      yaku: [], han: best.han, fu: best.fu, dora, akaDora: aka, uraDora: ura,
      points: 0, payments: { 0: 0, 1: 0, 2: 0, 3: 0 }, limitName: '',
    };
  }

  return {
    yaku: best.yaku,
    han: best.han,
    fu: best.fu,
    dora,
    akaDora: aka,
    uraDora: ura,
    points: best.points,
    payments,
    limitName: isYakuman ? 'yakuman' : limitNameFor(best.han),
  };
}

function countsForUra(hand: TileId[], melds: Meld[]): number[] {
  const counts = countsFromIds(hand);
  for (const m of melds) for (const id of m.tiles) counts[kindOf(id)]++;
  return counts;
}

/**
 * Would this hand be a legal win? At least one yaku, and 2+ han (dora do not
 * count toward the minimum) when the table plays a two-han minimum.
 */
export function isLegalWin(score: ScoreResult, settings: TableSettings): boolean {
  if (score.yaku.length === 0) return false;
  if (!settings.twoHanMinimum) return true;
  return totalHan(score.yaku) >= 2;
}
