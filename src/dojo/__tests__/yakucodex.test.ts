/**
 * The Yaku Codex track is meant to name EVERY yaku the engine recognises.
 * This test checks the coverage the way a reader would: walk the engine's
 * yaku table and confirm a codex lesson id (or one of the grouped family
 * lessons) exists for it, and that every codex lesson keeps the course
 * rhythm (two teach screens then three drills).
 */
import { describe, expect, it } from 'vitest';
import { YAKU_NAMES } from '@engine/yaku';
import { TRACKS } from '../course';

const codex = TRACKS.find((t) => t.id === 'yaku')!;
const lessonIds = new Set(codex.chapters.flatMap((c) => c.lessons.map((l) => l.id)));

/** Engine YakuId -> the codex lesson id that teaches it. */
const COVERED_BY: Record<string, string> = {
  menzenTsumo: 'menzen-tsumo',
  riichi: 'riichi-family',
  doubleRiichi: 'riichi-family',
  ippatsu: 'riichi-family',
  haitei: 'last-tile',
  houtei: 'last-tile',
  rinshan: 'kan-draws',
  chankan: 'kan-draws',
  renhou: 'renhou',
  pinfu: 'pinfu-codex',
  tanyao: 'tanyao-codex',
  yakuhaiHaku: 'yakuhai-codex',
  yakuhaiHatsu: 'yakuhai-codex',
  yakuhaiChun: 'yakuhai-codex',
  yakuhaiRoundWind: 'yakuhai-codex',
  yakuhaiSeatWind: 'yakuhai-codex',
  chiitoitsu: 'chiitoitsu-codex',
  toitoi: 'toitoi-codex',
  sanshokuDoujun: 'sanshoku-doujun',
  ittsu: 'ittsu-codex',
  chanta: 'chanta-junchan',
  junchan: 'chanta-junchan',
  honroutou: 'honroutou',
  shousangen: 'shousangen',
  sanankou: 'sanankou',
  sankantsu: 'sankantsu',
  sanshokuDoukou: 'sanshoku-doukou',
  honitsu: 'honitsu-codex',
  chinitsu: 'chinitsu-codex',
  ryanpeikou: 'ryanpeikou',
  kokushi: 'kokushi',
  suuankou: 'suuankou',
  daisangen: 'daisangen',
  shousuushi: 'four-winds',
  daisuushii: 'four-winds',
  tsuuiisou: 'tsuuiisou',
  chinroutou: 'chinroutou',
  ryuuiisou: 'ryuuiisou',
  chuurenPoutou: 'chuuren',
  suukantsu: 'suukantsu',
  tenhou: 'tenhou-chiihou',
  chiihou: 'tenhou-chiihou',
};

describe('the yaku codex', () => {
  it('has a lesson for every yaku the engine recognises', () => {
    const all = Object.keys(YAKU_NAMES);
    const missing = all.filter((id) => {
      const lesson = COVERED_BY[id];
      return !lesson || !lessonIds.has(lesson);
    });
    expect(missing, `uncovered engine yaku: ${missing.join(', ')}`).toEqual([]);
    // No lesson claimed by coverage but absent from the track.
    for (const lessonId of new Set(Object.values(COVERED_BY))) {
      expect(lessonIds.has(lessonId), `coverage points at missing lesson ${lessonId}`).toBe(true);
    }
  });

  it('every codex lesson is two teach screens then three drills', () => {
    for (const lesson of codex.chapters.flatMap((c) => c.lessons)) {
      const teach = lesson.steps.filter((s) => s.kind === 'teach').length;
      const drills = lesson.steps.filter((s) => s.kind === 'drill').length;
      expect(teach, `${lesson.id} teach`).toBe(2);
      expect(drills, `${lesson.id} drills`).toBe(3);
    }
  });
});
