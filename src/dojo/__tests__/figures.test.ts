/**
 * Figure verification. Course figures are tile strips shown to the student
 * with a caption asserting what they are; the engine is the only arbiter of
 * whether that assertion holds.
 *
 * - every figure must parse (parseHand throws on a bad tile or a fifth copy);
 * - a 14-tile figure must be a legal winning hand (isAgari);
 * - a 13-tile figure must be tenpai (the only 13-tile figures the course
 *   shows are deals the caption calls tenpai);
 * - a 16-tile figure must be exactly four kinds of four (a four-kan hand);
 * - where a caption names yaku, the claimed yaku must be present in the
 *   union of the engine's yaku across every reading of the hand.
 */
import { describe, expect, it } from 'vitest';
import { enumerateWinShapes } from '@engine/decompose';
import { kindOf, parseHand, shanten } from '@engine/index';
import { DEFAULT_SETTINGS } from '@engine/types';
import { detectYaku } from '@engine/yaku';
import type { YakuId } from '@engine/types';
import { ALL_LESSONS } from '../course';

/**
 * Captions that name yaku, keyed by the figure's tile string. The claimed
 * ids must all be present in the union of the hand's readings. Figures
 * absent here only need to be a legal win (or tenpai, at 13 tiles).
 */
const CLAIMED: Record<string, YakuId[]> = {
  '11m 33m 55p 77p 99p 22s FF': ['chiitoitsu'],
  'EEE 555m PPP 999p 22s': ['toitoi'],
  '222m 789m 345m EEE FF': ['honitsu'],
  '234m 456m 234p 345s 66p': ['pinfu', 'tanyao', 'menzenTsumo'],
  '234m 345m 345p 234s 88p': ['pinfu', 'tanyao', 'menzenTsumo'],
  '123m 456m 234p 234s 55s': ['pinfu'],
  '234m 456m 345p 345s 66p': ['tanyao'],
  '234m 234p 234s 567m 88s': ['sanshokuDoujun'],
  '123m 456m 789m 234p 55s': ['ittsu'],
  '123m 789m 123p 789p EE': ['chanta'],
  '111m 999m PPP FFF 11p': ['honroutou', 'toitoi', 'yakuhaiHaku', 'yakuhaiHatsu'],
  '111m 555p 999s 234p 88m': ['sanankou'],
  '333m 333p 333s 123m 55s': ['sanshokuDoukou'],
  'PPP FFF CC 123m 456s': ['shousangen'],
  '123m 456m 789m 111m 22m': ['chinitsu', 'ittsu'],
  '345m 345m 234p 234p 55s': ['ryanpeikou'],
  '19m 19p 19s E S W N P F C 1m': ['kokushi'],
  '111m 555p 999s 777s 22m': ['suuankou'],
  'PPP FFF CCC 123m 55m': ['daisangen'],
  'EEE SSS WWW NN 123m': ['shousuushi'],
  'PPP FFF EEE SSS WW': ['tsuuiisou'],
  '111m 999m 111p 999s 11s': ['chinroutou'],
  '234s 234s 888s 666s FF': ['ryuuiisou'],
  '111m 2345678m 999m 5m': ['chuurenPoutou'],
};

/** Neutral seat/round: no incidental seat-wind yakuhai, round wind is East. */
const CTX = { seatWind: 'west' as const, roundWind: 'east' as const };

/**
 * Union of yaku ids across every reading of the 14 tiles (tsumo and ron).
 * For each candidate winning tile, the 13-tile pre-draw hand is fed to the
 * engine's shape enumerator with that tile as the win.
 */
function yakuUnion(ids: number[]): Set<YakuId> {
  const union = new Set<YakuId>();
  const kinds = [...new Set(ids.map(kindOf))];
  for (const k of kinds) {
    const pre = ids.slice();
    const at = pre.findIndex((id) => kindOf(id) === k);
    const winId = pre.splice(at, 1)[0];
    for (const isTsumo of [true, false]) {
      let shapes = enumerateWinShapes(pre, [], winId);
      if (shapes.length === 0) {
        // Chiitoitsu and kokushi only exist in the engine's 14-tile branch.
        shapes = enumerateWinShapes(ids, [], winId);
      }
      for (const shape of shapes) {
        const hits = detectYaku(shape, {
          isClosed: true,
          isTsumo,
          seatWind: CTX.seatWind,
          roundWind: CTX.roundWind,
          winKind: k,
          settings: DEFAULT_SETTINGS,
          flags: {
            riichi: false, doubleRiichi: false, ippatsu: false, haitei: false,
            houtei: false, rinshan: false, chankan: false, tenhou: false,
            chiihou: false, renhou: false,
          },
        });
        for (const h of hits) union.add(h.id);
      }
    }
  }
  return union;
}

describe('course figures', () => {
  it('every figure parses to real tiles, no fifth copy', () => {
    const seen = new Set<string>();
    for (const { track, chapter, lesson } of ALL_LESSONS) {
      const where = `${track.id}/${chapter.id}/${lesson.id}`;
      for (const s of lesson.steps) {
        for (const f of s.figures ?? []) {
          expect(() => parseHand(f.tiles), `${where}: figure "${f.tiles}"`).not.toThrow();
          seen.add(`${where}: ${f.tiles}`);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('14-tile figures are legal wins; 13-tile figures are tenpai; 16-tile figures are four kans', () => {
    for (const { track, chapter, lesson } of ALL_LESSONS) {
      const where = `${track.id}/${chapter.id}/${lesson.id}`;
      for (const s of lesson.steps) {
        for (const f of s.figures ?? []) {
          const ids = parseHand(f.tiles);
          const label = `${where}: "${f.tiles}"`;
          if (ids.length === 14) {
            expect(shanten(ids, []), `${label}: not a winning hand`).toBe(-1);
          } else if (ids.length === 13) {
            expect(shanten(ids, []), `${label}: 13-tile figure must be tenpai`).toBe(0);
          } else if (ids.length === 16) {
            const counts = new Map<number, number>();
            for (const id of ids) counts.set(kindOf(id), (counts.get(kindOf(id)) ?? 0) + 1);
            expect([...counts.values()], `${label}: four-kan figure must be 4×4`).toEqual([4, 4, 4, 4]);
          }
          // Any other length is a shape or reference strip (a 2-tile head,
          // a 3-tile set, a whole suit, the honour family) — parseable and
          // copy-safe, which test one already proved.
        }
      }
    }
  });

  it('every caption-named yaku is in the hand, per the engine', () => {
    for (const [tiles, claimed] of Object.entries(CLAIMED)) {
      const ids = parseHand(tiles);
      expect(ids.length, `"${tiles}" should be a 14-tile hand`).toBe(14);
      const union = yakuUnion(ids);
      const missing = claimed.filter((y) => !union.has(y));
      expect(missing, `"${tiles}" does not score [${missing.join(', ')}]`).toEqual([]);
    }
  });
});
