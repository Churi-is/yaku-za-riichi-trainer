/**
 * engine/yaku — yaku detection.
 *
 * Full set from the brief. Exclusions handled here:
 *   - any yakuman suppresses every non-yakuman yaku (single yakuman, no stack)
 *   - chinitsu suppresses honitsu
 *   - junchan suppresses chanta
 *   - honroutou suppresses chanta and junchan
 *   - ryanpeikou and chiitoitsu are mutually exclusive (different shapes)
 *   - iipeiko is deliberately NOT in the contract's yaku set, so a lone
 *     identical-run pair scores nothing; two of them score ryanpeikou
 *
 * DOCUMENTED DECISION: renhou is worth 5 han, which is exactly mangan. It
 * therefore guarantees the "renhou = mangan" floor and still stacks naturally
 * with any other yaku the hand happens to have.
 */
import {
  GREEN_KINDS, isDragon, isHonor, isSimple, isTerminal,
  isTerminalOrHonor, isWind, kindOfWind, KIND_COUNT,
} from './tiles';
import { allKinds, allSets, concealedTriplets, effectiveSets, type WinShape } from './decompose';
import { isPinfuShape } from './fu';
import type { TableSettings, Wind, YakuId, YakuHit } from './types';

const YAKU_NAMES: Record<YakuId, string> = {
  menzenTsumo: 'Menzen Tsumo',
  riichi: 'Riichi',
  ippatsu: 'Ippatsu',
  pinfu: 'Pinfu',
  tanyao: 'Tanyao',
  yakuhaiHaku: 'Yakuhai (Haku)',
  yakuhaiHatsu: 'Yakuhai (Hatsu)',
  yakuhaiChun: 'Yakuhai (Chun)',
  yakuhaiRoundWind: 'Yakuhai (Round Wind)',
  yakuhaiSeatWind: 'Yakuhai (Seat Wind)',
  doubleRiichi: 'Double Riichi',
  chankan: 'Chankan',
  haitei: 'Haitei Raoyue',
  houtei: 'Houtei Raoyui',
  rinshan: 'Rinshan Kaihou',
  chiitoitsu: 'Chiitoitsu',
  toitoi: 'Toitoi',
  sanshokuDoujun: 'Sanshoku Doujun',
  ittsu: 'Ittsu',
  chanta: 'Chanta',
  honroutou: 'Honroutou',
  shousangen: 'Shousangen',
  sanankou: 'Sanankou',
  sankantsu: 'Sankantsu',
  sanshokuDoukou: 'Sanshoku Doukou',
  honitsu: 'Honitsu',
  junchan: 'Junchan',
  ryanpeikou: 'Ryanpeikou',
  chinitsu: 'Chinitsu',
  renhou: 'Renhou',
  kokushi: 'Kokushi Musou',
  suuankou: 'Suuankou',
  daisangen: 'Daisangen',
  shousuushi: 'Shousuushi',
  daisuushii: 'Daisuushii',
  tsuuiisou: 'Tsuuiisou',
  chinroutou: 'Chinroutou',
  ryuuiisou: 'Ryuuiisou',
  chuurenPoutou: 'Chuuren Poutou',
  suukantsu: 'Suukantsu',
  tenhou: 'Tenhou',
  chiihou: 'Chiihou',
};

/** Han for every non-yakuman yaku as [closed, open]. */
const YAKU_HAN: Record<string, [number, number]> = {
  menzenTsumo: [1, 0],
  riichi: [1, 0],
  doubleRiichi: [2, 0],
  ippatsu: [1, 0],
  pinfu: [1, 0],
  tanyao: [1, 1],
  yakuhaiHaku: [1, 1],
  yakuhaiHatsu: [1, 1],
  yakuhaiChun: [1, 1],
  yakuhaiRoundWind: [1, 1],
  yakuhaiSeatWind: [1, 1],
  chankan: [1, 1],
  haitei: [1, 1],
  houtei: [1, 1],
  rinshan: [1, 1],
  renhou: [5, 5],
  chiitoitsu: [2, 0],
  toitoi: [2, 2],
  sanshokuDoujun: [2, 1],
  ittsu: [2, 1],
  chanta: [2, 1],
  honroutou: [2, 2],
  shousangen: [2, 2],
  sanankou: [2, 2],
  sankantsu: [2, 2],
  sanshokuDoukou: [2, 2],
  honitsu: [3, 2],
  junchan: [3, 2],
  ryanpeikou: [3, 0],
  chinitsu: [6, 5],
};

export interface YakuFlags {
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  haitei: boolean;
  houtei: boolean;
  rinshan: boolean;
  chankan: boolean;
  tenhou: boolean;
  chiihou: boolean;
  renhou: boolean;
}

interface YakuContext {
  isClosed: boolean;
  isTsumo: boolean;
  seatWind: Wind;
  roundWind: Wind;
  winKind: number;
  settings: TableSettings;
  flags: YakuFlags;
}

function hit(id: YakuId, han: number): YakuHit {
  return { id, name: YAKU_NAMES[id], han, yakuman: false };
}

function yakumanHit(id: YakuId): YakuHit {
  return { id, name: YAKU_NAMES[id], han: 0, yakuman: true };
}

function hanFor(id: YakuId, isClosed: boolean): number {
  const entry = YAKU_HAN[id];
  return entry ? (isClosed ? entry[0] : entry[1]) : 0;
}

/** True when the hand is 1112345678999 in one suit plus one spare of that suit. */
function isChuuren(counts: readonly number[]): boolean {
  const suits = [0, 9, 18];
  for (const base of suits) {
    let ok = true;
    let extra = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      const inSuit = k >= base && k < base + 9;
      const want = inSuit ? (k === base || k === base + 8 ? 3 : 1) : 0;
      const diff = counts[k] - want;
      if (diff < 0) { ok = false; break; }
      extra += diff;
    }
    if (ok && extra === 1) return true;
  }
  return false;
}

function isRyanpeikou(shape: WinShape): boolean {
  const runs = allSets(shape.d)
    .filter((s) => s.type === 'shuntsu')
    .map((s) => s.kind);
  if (runs.length !== 4) return false;
  const byKind = new Map<number, number>();
  for (const k of runs) byKind.set(k, (byKind.get(k) ?? 0) + 1);
  let pairs = 0;
  for (const n of byKind.values()) {
    if (n % 2 !== 0) return false;
    pairs += n / 2;
  }
  return pairs === 2;
}

export function detectYaku(shape: WinShape, ctx: YakuContext): YakuHit[] {
  const { d, wait } = shape;
  const kinds = allKinds(d);
  const sets = effectiveSets(d, wait, ctx.isTsumo, ctx.winKind);
  const ankou = concealedTriplets(d, wait, ctx.isTsumo, ctx.winKind);
  const kans = d.meldSets.filter((s) => s.isKan);
  const yakuman: YakuHit[] = [];
  const out: YakuHit[] = [];
  const add = (id: YakuId) => out.push(hit(id, hanFor(id, ctx.isClosed)));

  // ------------------------------------------------------------------ yakuman
  if (d.kokushi) yakuman.push(yakumanHit('kokushi'));
  // Four kans is the more specific claim than four concealed triplets, so it
  // is checked first (both pay one yakuman; this only decides the label).
  if (kans.length === 4) yakuman.push(yakumanHit('suukantsu'));
  if (ankou.length === 4) yakuman.push(yakumanHit('suuankou'));

  const dragonPungs = sets.filter((s) => s.type === 'koutsu' && isDragon(s.kind));
  const windPungs = sets.filter((s) => s.type === 'koutsu' && isWind(s.kind));
  if (dragonPungs.length === 3) yakuman.push(yakumanHit('daisangen'));
  if (windPungs.length === 4) yakuman.push(yakumanHit('daisuushii'));
  if (windPungs.length === 3 && isWind(d.pair)) yakuman.push(yakumanHit('shousuushi'));

  if (kinds.every(isHonor)) yakuman.push(yakumanHit('tsuuiisou'));
  if (kinds.every((k) => isTerminal(k))) yakuman.push(yakumanHit('chinroutou'));
  if (kinds.every((k) => GREEN_KINDS.includes(k))) yakuman.push(yakumanHit('ryuuiisou'));
  if (ctx.isClosed && !d.chiitoi && !d.kokushi && isChuuren(d.concealedCounts)) {
    yakuman.push(yakumanHit('chuurenPoutou'));
  }
  if (ctx.flags.tenhou) yakuman.push(yakumanHit('tenhou'));
  if (ctx.flags.chiihou) yakuman.push(yakumanHit('chiihou'));

  // A single yakuman, no stacking: everything else is dropped.
  if (yakuman.length > 0) return [yakuman[0]];

  // ------------------------------------------------------------- context yaku
  if (ctx.isClosed && ctx.isTsumo) add('menzenTsumo');
  if (ctx.flags.doubleRiichi) add('doubleRiichi');
  else if (ctx.flags.riichi) add('riichi');
  if (ctx.flags.ippatsu) add('ippatsu');
  if (ctx.flags.rinshan) add('rinshan');
  if (ctx.flags.chankan) add('chankan');
  if (ctx.flags.haitei) add('haitei');
  if (ctx.flags.houtei) add('houtei');
  if (ctx.flags.renhou) add('renhou');

  // -------------------------------------------------------------- shape yaku
  const allYaochuu = kinds.every(isTerminalOrHonor);
  const honorsPresent = kinds.some(isHonor);
  const suitsPresent = new Set(kinds.filter((k) => k < 27).map((k) => Math.floor(k / 9)));

  if (d.chiitoi) {
    add('chiitoitsu');
  } else {
    if (isPinfuShape(d, wait, ctx.isClosed, { seatWind: ctx.seatWind, roundWind: ctx.roundWind })) {
      add('pinfu');
    }
    if (sets.every((s) => s.type === 'koutsu')) add('toitoi');
    if (ctx.isClosed && isRyanpeikou(shape)) add('ryanpeikou');

    // Sanshoku doujun: the same run in all three suits.
    const runStarts = new Set(sets.filter((s) => s.type === 'shuntsu').map((s) => s.kind));
    for (let rank = 0; rank < 7; rank++) {
      if (runStarts.has(rank) && runStarts.has(rank + 9) && runStarts.has(rank + 18)) {
        add('sanshokuDoujun');
        break;
      }
    }
    // Ittsu: 1-9 of one suit.
    for (const base of [0, 9, 18]) {
      if (runStarts.has(base) && runStarts.has(base + 3) && runStarts.has(base + 6)) {
        add('ittsu');
        break;
      }
    }
    // Sanshoku doukou: the same triplet in all three suits.
    const pungKinds = new Set(sets.filter((s) => s.type === 'koutsu').map((s) => s.kind));
    for (let rank = 0; rank < 9; rank++) {
      if (pungKinds.has(rank) && pungKinds.has(rank + 9) && pungKinds.has(rank + 18)) {
        add('sanshokuDoukou');
        break;
      }
    }

    // Chanta / junchan: every set and the pair touch a terminal.
    const setHasTerminal = sets.every((s) =>
      s.type === 'koutsu'
        ? isTerminalOrHonor(s.kind)
        : s.kind % 9 === 0 || s.kind % 9 === 6);
    if (setHasTerminal && isTerminalOrHonor(d.pair) && !allYaochuu) {
      if (honorsPresent) add('chanta');
      else add('junchan');
    }

    // Sanankou / sankantsu.
    if (ankou.length === 3) add('sanankou');
    if (kans.length === 3) add('sankantsu');

    // Shousangen: two dragon pungs and a dragon pair.
    if (dragonPungs.length === 2 && isDragon(d.pair)) add('shousangen');
  }

  if (allYaochuu && !d.kokushi) add('honroutou');

  // Tanyao: all simples. Open only when kuitan is on.
  if (kinds.every(isSimple) && (ctx.isClosed || ctx.settings.kuitan)) add('tanyao');

  // Yakuhai pungs, each counted separately.
  for (const s of sets) {
    if (s.type !== 'koutsu') continue;
    if (s.kind === 31) add('yakuhaiHaku');
    else if (s.kind === 32) add('yakuhaiHatsu');
    else if (s.kind === 33) add('yakuhaiChun');
    else if (s.kind === kindOfWind(ctx.roundWind)) add('yakuhaiRoundWind');
    if (s.kind === kindOfWind(ctx.seatWind)) add('yakuhaiSeatWind');
  }

  // Honitsu / chinitsu (chinitsu wins).
  if (suitsPresent.size === 1) {
    if (!honorsPresent) add('chinitsu');
    else add('honitsu');
  }

  return out;
}

/** Sum of han across a yaku list (yakuman contribute 0 here). */
export function totalHan(yaku: YakuHit[]): number {
  let n = 0;
  for (const y of yaku) n += y.han;
  return n;
}
