/**
 * engine/fu — fu (minipoint) calculation, per standard riichi rules.
 *
 * Rules implemented:
 *   base 20; +10 concealed ron; +2 tsumo (not on pinfu); +10 closed wait
 *   (kanchan/penchan/tanki/shanpon); open triplet +2 simples / +4 yaochuu;
 *   concealed triplet +4 / +8; open kan +8 / +16; closed kan +16 / +32;
 *   yakuhai pair +10; chiitoitsu flat 25; an open pinfu-shaped hand is
 *   20 fu (the 20-fu rule); round up to the next 10.
 *
 * DOCUMENTED DECISIONS
 *   - Double wind pair (round wind == seat wind) scores +10, not +20. This
 *     matches Tenhou and keeps the value of a wind pair constant.
 *   - An added kan (kakan) scores as an OPEN kan (+8/+16). It began as an open
 *     pon, so it never earns concealed-kan fu.
 */
import { isDragon, isTerminalOrHonor, kindOfWind } from './tiles';
import { allSets, effectiveSets, type Decomposition, type WaitType } from './decompose';
import type { TileKind, Wind } from './types';

interface FuContext {
  seatWind: Wind;
  roundWind: Wind;
}

/** A pair that earns fu: any dragon, the round wind, or the seat wind. */
function isYakuhaiPair(kind: TileKind, ctx: FuContext): boolean {
  return isDragon(kind) || kind === kindOfWind(ctx.seatWind) || kind === kindOfWind(ctx.roundWind);
}

/**
 * Pinfu shape, open or closed: four runs, a valueless pair, and an open
 * (ryanmen) wait. Worth 1 han in either case; a closed pinfu hand forces fu
 * to a bare 20 (30 on ron via the +10), and an open pinfu-shaped hand is a
 * flat 20 fu (the 20-fu rule).
 */
export function isPinfuShapeBody(
  d: Decomposition, wait: WaitType, ctx: FuContext,
): boolean {
  if (d.chiitoi || d.kokushi) return false;
  if (wait !== 'ryanmen') return false;
  if (isYakuhaiPair(d.pair, ctx)) return false;
  return allSets(d).every((s) => s.type === 'shuntsu');
}

/** Closed pinfu shape. */
export function isPinfuShape(
  d: Decomposition, wait: WaitType, isClosed: boolean, ctx: FuContext,
): boolean {
  return isClosed && isPinfuShapeBody(d, wait, ctx);
}

/** Fu for a specific winning tile, applying the ron-shanpon downgrade. */
export function calculateFu(
  d: Decomposition,
  wait: WaitType,
  isTsumo: boolean,
  isClosed: boolean,
  winKind: TileKind,
  ctx: FuContext,
): number {
  if (d.kokushi) return 0;
  if (d.chiitoi) return 25;

  let fu = 20;
  if (isClosed && !isTsumo) fu += 10;
  const pinfu = isPinfuShape(d, wait, isClosed, ctx);
  if (isTsumo && !pinfu) fu += 2;
  if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki' || wait === 'shanpon') fu += 10;

  for (const s of effectiveSets(d, wait, isTsumo, winKind)) {
    if (s.type !== 'koutsu') continue;
    const hon = isTerminalOrHonor(s.kind);
    if (s.isKan) fu += s.concealed ? (hon ? 32 : 16) : (hon ? 16 : 8);
    else fu += s.concealed ? (hon ? 8 : 4) : (hon ? 4 : 2);
  }

  if (isYakuhaiPair(d.pair, ctx)) fu += 10;
  // 20-fu rule: an open hand with a pinfu shape is a flat 20 fu.
  if (!isClosed && isPinfuShapeBody(d, wait, ctx)) return 20;
  return Math.ceil(fu / 10) * 10;
}
