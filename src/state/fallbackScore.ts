/**
 * Fallback hand scoring (Worker D). Used only by the fallback engine until
 * Worker A's scoreHand lands. Covers the common yaku, fu, and limit hands well
 * enough to drive a believable trainer. Not a bit-perfect scoring engine.
 */
import type {
  Meld, ScoreResult, SeatIndex, TableSettings, TileId, Wind, YakuHit, YakuId,
} from '@engine/types';
import type { ScoreInput } from '@engine/index';
import {
  isHonor, isTerminalOrHonor, kindOf, suitOf, toCounts,
} from './mahjong';
import { doraFromIndicator, isRedFiveId } from '@ui/tiles';

interface Group {
  kind: 'run' | 'triplet' | 'pair';
  tiles: number[]; // kinds
  base: number; // lowest kind
  concealed: boolean;
  isKan?: boolean;
}

const WIND_KIND: Record<Wind, number> = { east: 27, south: 28, west: 29, north: 30 };

/** Decompose a concealed 14-count (already includes winning tile) into groups. */
function decomposeStandard(counts: number[]): Group[] | null {
  const c = [...counts];
  // find pair then 4 melds
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2;
      const melds = extractMelds(c);
      if (melds) {
        c[p] += 2;
        return [{ kind: 'pair', tiles: [p, p], base: p, concealed: true }, ...melds];
      }
      c[p] += 2;
    }
  }
  return null;
}

function extractMelds(c: number[]): Group[] | null {
  let i = 0;
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return [];
  const suit = suitOf(i);
  // triplet
  if (c[i] >= 3) {
    c[i] -= 3;
    const rest = extractMelds(c);
    c[i] += 3;
    if (rest) return [{ kind: 'triplet', tiles: [i, i, i], base: i, concealed: true }, ...rest];
  }
  // run
  if (suit !== 3 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--;
    const rest = extractMelds(c);
    c[i]++; c[i + 1]++; c[i + 2]++;
    if (rest) return [{ kind: 'run', tiles: [i, i + 1, i + 2], base: i, concealed: true }, ...rest];
  }
  return null;
}

function isChiitoitsu(counts: number[]): boolean {
  let pairs = 0;
  for (let k = 0; k < 34; k++) {
    if (counts[k] === 2) pairs++;
    else if (counts[k] !== 0) return false;
  }
  return pairs === 7;
}

function isKokushi(counts: number[]): boolean {
  let types = 0;
  let pair = false;
  for (let k = 0; k < 34; k++) {
    if (counts[k] === 0) continue;
    if (!isTerminalOrHonor(k)) return false;
    types++;
    if (counts[k] === 2) pair = true;
    if (counts[k] > 2) return false;
  }
  return types === 13 && pair;
}

function meldToGroup(m: Meld): Group {
  const kinds = m.tiles.map(kindOf);
  if (m.type === 'chi') {
    const sorted = [...new Set(kinds)].sort((a, b) => a - b);
    return { kind: 'run', tiles: sorted, base: sorted[0], concealed: false };
  }
  const k = kinds[0];
  const isKan = m.type === 'ankan' || m.type === 'minkan' || m.type === 'kakan';
  return {
    kind: 'triplet',
    tiles: [k, k, k],
    base: k,
    concealed: m.type === 'ankan',
    isKan,
  };
}

export function fallbackScore(input: ScoreInput): ScoreResult {
  const {
    hand, melds, winningTile, isTsumo, seatWind, roundWind, isDealer,
    riichi, doubleRiichi, ippatsu, haitei, houtei, rinshan, chankan,
    tenhou, chiihou, renhou, doraIndicators, uraIndicators, settings,
  } = input;

  const allIds = [...hand, winningTile];
  const counts = toCounts(allIds.map(kindOf));
  const meldGroups = melds.map(meldToGroup);
  const closed = melds.every((m) => m.type === 'ankan') || melds.length === 0;
  const menzen = melds.filter((m) => m.type !== 'ankan').length === 0;

  const yaku: YakuHit[] = [];
  let yakumanCount = 0;

  const add = (id: YakuId, name: string, han: number) => yaku.push({ id, name, han, yakuman: false });
  const addYakuman = (id: YakuId, name: string) => {
    yaku.push({ id, name, han: 13, yakuman: true });
    yakumanCount++;
  };

  // --- Special shapes -----------------------------------------------------
  const chiitoi = melds.length === 0 && isChiitoitsu(counts);
  const kokushi = melds.length === 0 && isKokushi(counts);

  if (kokushi) addYakuman('kokushi', 'Kokushi Musou');

  let groups: Group[] = [];
  if (!chiitoi && !kokushi) {
    const decomp = decomposeStandard(counts);
    if (decomp) groups = [...decomp, ...meldGroups];
  }

  // --- Yakuman checks (standard) -----------------------------------------
  if (!chiitoi && !kokushi && groups.length) {
    const triplets = groups.filter((g) => g.kind === 'triplet');
    const pair = groups.find((g) => g.kind === 'pair')!;
    const allTerminalHonor = groups.every((g) =>
      g.tiles.every((t) => isTerminalOrHonor(t)));
    const allHonor = groups.every((g) => g.tiles.every((t) => isHonor(t)));
    const dragons = triplets.filter((t) => t.base >= 31);
    const winds = triplets.filter((t) => t.base >= 27 && t.base <= 30);

    if (allHonor) addYakuman('tsuuiisou', 'Tsuuiisou');
    if (dragons.length === 3) addYakuman('daisangen', 'Daisangen');
    if (winds.length === 4) addYakuman('daisuushii', 'Daisuushii');
    else if (winds.length === 3 && pair.base >= 27 && pair.base <= 30) addYakuman('shousuushi', 'Shousuushi');
    if (allTerminalHonor && groups.every((g) => g.tiles.every((t) => !isHonor(t) ? (t % 9 === 0 || t % 9 === 8) : false) || g.tiles.every(isHonor)) && groups.every((g) => g.kind !== 'run') && !allHonor && groups.every((g) => g.tiles.every((t) => t % 9 === 0 || t % 9 === 8))) {
      addYakuman('chinroutou', 'Chinroutou');
    }
    // Suuankou: four concealed triplets (tsumo, or ron not on the completing pair)
    const concealedTriplets = triplets.filter((t) => t.concealed);
    if (concealedTriplets.length === 4 && menzen) addYakuman('suuankou', 'Suuankou');
  }

  if (yakumanCount > 0) {
    return finalize(yaku, 0, isTsumo, isDealer, doraIndicators, uraIndicators, allIds, melds, riichi, settings, true);
  }

  // --- Regular yaku -------------------------------------------------------
  if (riichi && menzen) {
    if (doubleRiichi) add('doubleRiichi', 'Double Riichi', 2);
    else add('riichi', 'Riichi', 1);
    if (ippatsu) add('ippatsu', 'Ippatsu', 1);
  }
  if (isTsumo && menzen && !tenhou && !chiihou && !renhou) add('menzenTsumo', 'Menzen Tsumo', 1);
  if (tenhou) addYakuman('tenhou', 'Tenhou');
  if (chiihou) addYakuman('chiihou', 'Chiihou');
  if (renhou) add('renhou', 'Renhou', 5);
  if (haitei) add('haitei', 'Haitei', 1);
  if (houtei) add('houtei', 'Houtei', 1);
  if (rinshan) add('rinshan', 'Rinshan Kaihou', 1);
  if (chankan) add('chankan', 'Chankan', 1);

  // Tanyao
  const allSimples = allIds.every((id) => !isTerminalOrHonor(kindOf(id)));
  if (allSimples && (menzen || settings.kuitan)) add('tanyao', 'Tanyao', 1);

  // Yakuhai
  if (!chiitoi && !kokushi && groups.length) {
    const triplets = groups.filter((g) => g.kind === 'triplet');
    for (const t of triplets) {
      if (t.base === 31) add('yakuhaiHaku', 'Yakuhai (White)', 1);
      if (t.base === 32) add('yakuhaiHatsu', 'Yakuhai (Green)', 1);
      if (t.base === 33) add('yakuhaiChun', 'Yakuhai (Red)', 1);
      if (t.base === WIND_KIND[roundWind]) add('yakuhaiRoundWind', 'Yakuhai (Round Wind)', 1);
      if (t.base === WIND_KIND[seatWind]) add('yakuhaiSeatWind', 'Yakuhai (Seat Wind)', 1);
    }
    // Shousangen
    const dragonTriplets = triplets.filter((t) => t.base >= 31).length;
    const pair = groups.find((g) => g.kind === 'pair')!;
    if (dragonTriplets === 2 && pair.base >= 31) add('shousangen', 'Shousangen', 2);
  }

  // Chiitoitsu
  if (chiitoi) add('chiitoitsu', 'Chiitoitsu', 2);

  // Structural yaku on standard hands
  if (!chiitoi && !kokushi && groups.length) {
    structuralYaku(groups, menzen, add);
  }

  // Honitsu / Chinitsu
  const suits = new Set(allIds.map((id) => suitOf(kindOf(id))).filter((s) => s !== 3));
  const hasHonor = allIds.some((id) => isHonor(kindOf(id)));
  if (suits.size === 1) {
    if (!hasHonor) add('chinitsu', 'Chinitsu', menzen ? 6 : 5);
    else add('honitsu', 'Honitsu', menzen ? 3 : 2);
  }

  return finalize(yaku, computeFu(groups, chiitoi, kokushi, menzen, isTsumo, winningTile, seatWind, roundWind, yaku), isTsumo, isDealer, doraIndicators, uraIndicators, allIds, melds, riichi, settings, false);
}

function structuralYaku(groups: Group[], menzen: boolean, add: (id: YakuId, name: string, han: number) => void) {
  const runs = groups.filter((g) => g.kind === 'run');
  const triplets = groups.filter((g) => g.kind === 'triplet');
  const pair = groups.find((g) => g.kind === 'pair')!;

  // Pinfu: all runs, non-yakuhai pair, closed (wait-shape not fully checked here)
  if (menzen && runs.length === 4 && (pair.base < 27 || (pair.base >= 27 && pair.base <= 30))) {
    const pairIsYakuhai = pair.base >= 31;
    if (!pairIsYakuhai) add('pinfu', 'Pinfu', 1);
  }

  // Tanyao handled elsewhere. Toitoi
  if (triplets.length === 4) add('toitoi', 'Toitoi', 2);

  // Sanankou
  const concealedTrips = triplets.filter((t) => t.concealed).length;
  if (concealedTrips === 3) add('sanankou', 'Sanankou', 2);

  // Sankantsu / suukantsu
  const kans = triplets.filter((t) => t.isKan).length;
  if (kans === 4) add('sankantsu', 'Suukantsu', 2); // approx
  else if (kans === 3) add('sankantsu', 'Sankantsu', 2);

  // Sanshoku doujun
  const runBases = runs.map((r) => r.base % 9);
  for (const rb of runBases) {
    const suitsWith = new Set(runs.filter((r) => r.base % 9 === rb).map((r) => suitOf(r.base)));
    if (suitsWith.size === 3) { add('sanshokuDoujun', 'Sanshoku Doujun', menzen ? 2 : 1); break; }
  }

  // Sanshoku doukou
  const tripBases = triplets.map((t) => t.base % 9);
  for (const tb of tripBases) {
    const suitsWith = new Set(triplets.filter((t) => t.base % 9 === tb && t.base < 27).map((t) => suitOf(t.base)));
    if (suitsWith.size === 3) { add('sanshokuDoukou', 'Sanshoku Doukou', 2); break; }
  }

  // Ittsu (1-9 same suit)
  for (let s = 0; s < 3; s++) {
    const base = s * 9;
    if (runs.some((r) => r.base === base) && runs.some((r) => r.base === base + 3) && runs.some((r) => r.base === base + 6)) {
      add('ittsu', 'Ittsu', menzen ? 2 : 1); break;
    }
  }

  // Iipeikou / ryanpeikou (closed)
  if (menzen) {
    const runKey = runs.map((r) => r.base).sort((a, b) => a - b);
    const seen = new Map<number, number>();
    for (const b of runKey) seen.set(b, (seen.get(b) ?? 0) + 1);
    const pairsOfRuns = [...seen.values()].filter((v) => v >= 2).length;
    if (pairsOfRuns === 2) add('ryanpeikou', 'Ryanpeikou', 3);
  }

  // Chanta / Junchan
  const allGroupsHaveTerminalHonor = groups.every((g) => g.tiles.some((t) => isTerminalOrHonor(t)));
  if (allGroupsHaveTerminalHonor) {
    const anyHonor = groups.some((g) => g.tiles.some(isHonor));
    if (anyHonor) add('chanta', 'Chanta', menzen ? 2 : 1);
    else add('junchan', 'Junchan', menzen ? 3 : 2);
  }

  // Honroutou
  if (groups.every((g) => g.tiles.every(isTerminalOrHonor)) && triplets.length + (pair ? 1 : 0) === groups.length && runs.length === 0) {
    add('honroutou', 'Honroutou', 2);
  }
}

function computeFu(
  groups: Group[], chiitoi: boolean, kokushi: boolean, menzen: boolean,
  isTsumo: boolean, winningTile: number, seatWind: Wind, roundWind: Wind,
  yaku: YakuHit[],
): number {
  if (chiitoi) return 25;
  if (kokushi) return 20;
  const hasPinfu = yaku.some((y) => y.id === 'pinfu');
  if (hasPinfu) return isTsumo ? 20 : 30;
  let fu = 20;
  if (isTsumo) fu += 2;
  if (menzen && !isTsumo) fu += 10; // menzen ron
  for (const g of groups) {
    if (g.kind === 'triplet') {
      const terminal = isTerminalOrHonor(g.base);
      let base = terminal ? 8 : 4;
      if (!g.concealed) base /= 2;
      if (g.isKan) base *= 4;
      fu += base;
    }
    if (g.kind === 'pair') {
      if (g.base >= 31) fu += 2; // dragons
      if (g.base === WIND_KIND[seatWind]) fu += 2;
      if (g.base === WIND_KIND[roundWind]) fu += 2;
    }
  }
  // round up to 10
  return Math.ceil(fu / 10) * 10;
}

function countDora(ids: number[], indicators: number[], melds: Meld[]): number {
  let dora = 0;
  const doraKinds = indicators.map((ind) => doraFromIndicator(ind));
  const meldIds = melds.flatMap((m) => m.tiles);
  const all = [...ids, ...meldIds];
  for (const id of all) {
    for (const dk of doraKinds) if (kindOf(id) === dk) dora++;
  }
  return dora;
}

function countAka(ids: number[], melds: Meld[]): number {
  const meldIds = melds.flatMap((m) => m.tiles);
  return [...ids, ...meldIds].filter((id) => isRedFiveId(id)).length;
}

function finalize(
  yaku: YakuHit[], fu: number, isTsumo: boolean, isDealer: boolean,
  doraIndicators: number[], uraIndicators: number[], allIds: number[],
  melds: Meld[], riichi: boolean, settings: TableSettings, isYakuman: boolean,
): ScoreResult {
  let han = yaku.reduce((s, y) => s + y.han, 0);
  const dora = settings.redDora || true ? countDora(allIds, doraIndicators, melds) : 0;
  const akaDora = settings.redDora ? countAka(allIds, melds) : 0;
  const uraDora = riichi ? countDora(allIds, uraIndicators, melds) : 0;

  if (!isYakuman) han += dora + akaDora + uraDora;

  const { points, payments, limitName } = payout(han, fu, isTsumo, isDealer, isYakuman);

  return {
    yaku, han, fu, dora, akaDora, uraDora, points,
    payments: payments as Record<SeatIndex, number>,
    limitName,
  };
}

function basePoints(han: number, fu: number, isYakuman: boolean): { base: number; limit: ScoreResult['limitName'] } {
  if (isYakuman) return { base: 8000, limit: 'yakuman' };
  if (han >= 13) return { base: 8000, limit: 'yakuman' };
  if (han >= 11) return { base: 6000, limit: 'sanbaiman' };
  if (han >= 8) return { base: 4000, limit: 'baiman' };
  if (han >= 6) return { base: 3000, limit: 'haneman' };
  const base = fu * Math.pow(2, 2 + han);
  if (han >= 5 || base >= 2000) return { base: 2000, limit: 'mangan' };
  return { base, limit: '' };
}

function roundUp100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

function payout(han: number, fu: number, isTsumo: boolean, isDealer: boolean, isYakuman: boolean) {
  const { base, limit } = basePoints(han, fu, isYakuman);
  const payments: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let points = 0;
  if (isTsumo) {
    if (isDealer) {
      const each = roundUp100(base * 2);
      points = each * 3;
    } else {
      const dealerPay = roundUp100(base * 2);
      const nonDealerPay = roundUp100(base);
      points = dealerPay + nonDealerPay * 2;
    }
  } else {
    points = isDealer ? roundUp100(base * 6) : roundUp100(base * 4);
  }
  return { points, payments, limitName: limit };
}
