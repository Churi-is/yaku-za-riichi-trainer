/**
 * engine/decompose — enumerate every way a winning hand can be read.
 * Owned by Worker A. Internal to the engine, but shared by fu.ts and yaku.ts
 * so scoring and yaku detection always agree on the shape of the hand.
 *
 * A 14-tile concealed shape can often be read more than one way (222345m is
 * 22m + 234m + 5m, or 234m + 25m...), and the player is entitled to the
 * reading that scores best. So we enumerate all of them, together with every
 * wait the winning tile could have completed, and scoring picks the best.
 */
import { countsFromIds, kindOf, KIND_COUNT } from './tiles';
import { YAOCHUU_KINDS } from './shanten';
import type { Meld, TileId, TileKind } from './types';

export type WaitType = 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki';

export interface SetInfo {
  type: 'shuntsu' | 'koutsu';
  /** Lowest kind of the set (the run's first tile, or the triplet's kind). */
  kind: TileKind;
  /** Concealed = from the hand, or an ankan. Kakan/pon/minkan/chi are open. */
  concealed: boolean;
  isKan: boolean;
}

export interface Decomposition {
  /** Sets built out of the concealed tiles. */
  concealedSets: SetInfo[];
  /** Sets from declared melds (chi/pon/kan). */
  meldSets: SetInfo[];
  /** Head. -1 for kokushi. */
  pair: TileKind;
  /** The seven pair kinds, chiitoitsu only. */
  pairs: TileKind[];
  chiitoi: boolean;
  kokushi: boolean;
  /** 34-slot counts of the CONCEALED tiles (14 of them), for chuuren etc. */
  concealedCounts: number[];
}

export interface WinShape {
  d: Decomposition;
  wait: WaitType;
}

function meldToSet(m: Meld): SetInfo {
  const kind = kindOf(Math.min(...m.tiles));
  if (m.type === 'chi') {
    return { type: 'shuntsu', kind, concealed: false, isKan: false };
  }
  // A pon is a triplet, NOT a kan: it scores 2/4 fu, not 8/16, and must not
  // count toward sankantsu. Only minkan/kakan/ankan are kans.
  const isKan = m.type !== 'pon';
  // minkan / kakan are open; ankan is concealed.
  return { type: 'koutsu', kind, concealed: m.concealed, isKan };
}

function isChiitoiCounts(counts: readonly number[]): boolean {
  let pairs = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 2) pairs++;
    else if (counts[k] !== 0) return false;
  }
  return pairs === 7;
}

function isKokushiCounts(counts: readonly number[]): boolean {
  let total = 0;
  let pairs = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue;
    if (!YAOCHUU_KINDS.includes(k) || counts[k] > 2) return false;
    if (counts[k] === 2) pairs++;
    total += counts[k];
  }
  return total === 14 && pairs === 1 && YAOCHUU_KINDS.every((k) => counts[k] >= 1);
}

/** All four sets, melds first. */
export function allSets(d: Decomposition): SetInfo[] {
  return [...d.meldSets, ...d.concealedSets];
}

/** Every tile kind in the hand, melds included (a kan contributes all four). */
export function allKinds(d: Decomposition): TileKind[] {
  const kinds: TileKind[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    for (let i = 0; i < d.concealedCounts[k]; i++) kinds.push(k);
  }
  for (const s of d.meldSets) {
    if (s.type === 'koutsu') {
      const n = s.isKan ? 4 : 3;
      for (let i = 0; i < n; i++) kinds.push(s.kind);
    } else {
      kinds.push(s.kind, s.kind + 1, s.kind + 2);
    }
  }
  return kinds;
}

/** Every reading of the winning hand, each paired with a possible wait. */
export function enumerateWinShapes(
  concealed: TileId[], melds: Meld[], winningTile: TileId,
): WinShape[] {
  const counts = countsFromIds(concealed);
  const total = concealed.length;
  const winKind = kindOf(winningTile);
  const meldSets = melds.map(meldToSet);
  const shapes: WinShape[] = [];

  if (melds.length === 0 && total === 14) {
    if (isChiitoiCounts(counts)) {
      const pairs: TileKind[] = [];
      for (let k = 0; k < KIND_COUNT; k++) if (counts[k] === 2) pairs.push(k);
      shapes.push({
        d: {
          concealedSets: [], meldSets: [], pair: pairs[0], pairs,
          chiitoi: true, kokushi: false, concealedCounts: counts.slice(),
        },
        wait: 'tanki',
      });
    }
    if (isKokushiCounts(counts)) {
      let pair: TileKind = YAOCHUU_KINDS[0];
      for (const k of YAOCHUU_KINDS) if (counts[k] === 2) pair = k;
      shapes.push({
        d: {
          concealedSets: [], meldSets: [], pair, pairs: [],
          chiitoi: false, kokushi: true, concealedCounts: counts.slice(),
        },
        wait: 'tanki',
      });
    }
  }

  const needed = 4 - melds.length;
  const work = counts.slice();

  const emit = (sets: SetInfo[], pair: TileKind) => {
    const d: Decomposition = {
      concealedSets: sets,
      meldSets,
      pair,
      pairs: [],
      chiitoi: false,
      kokushi: false,
      concealedCounts: counts.slice(),
    };
    for (const wait of waitTypesFor(d, winKind)) shapes.push({ d, wait });
  };

  const rec = (pos: number, sets: SetInfo[], pair: TileKind): void => {
    while (pos < KIND_COUNT && work[pos] === 0) pos++;
    if (pos >= KIND_COUNT) {
      if (sets.length === needed && pair >= 0) emit(sets, pair);
      return;
    }
    if (sets.length > needed) return;

    // Every branch consumes the lowest remaining tile, so each distinct
    // decomposition is produced exactly once.
    if (pair < 0 && work[pos] >= 2) {
      work[pos] -= 2;
      rec(pos, sets, pos);
      work[pos] += 2;
    }
    if (work[pos] >= 3) {
      work[pos] -= 3;
      rec(pos, [...sets, { type: 'koutsu', kind: pos, concealed: true, isKan: false }], pair);
      work[pos] += 3;
    }
    if (pos < 27 && pos % 9 <= 6 && work[pos + 1] > 0 && work[pos + 2] > 0) {
      work[pos]--; work[pos + 1]--; work[pos + 2]--;
      rec(pos, [...sets, { type: 'shuntsu', kind: pos, concealed: true, isKan: false }], pair);
      work[pos]++; work[pos + 1]++; work[pos + 2]++;
    }
  };

  rec(0, [], -1);
  return shapes;
}

/** How the winning tile could have completed this decomposition. */
function waitTypesFor(d: Decomposition, winKind: TileKind): WaitType[] {
  const out = new Set<WaitType>();
  if (d.pair === winKind) out.add('tanki');
  for (const s of d.concealedSets) {
    if (s.type === 'koutsu') {
      if (s.kind === winKind) out.add('shanpon');
      continue;
    }
    const off = winKind - s.kind;
    if (off < 0 || off > 2) continue;
    const rank = s.kind % 9;
    if (off === 1) out.add('kanchan');
    else if (off === 0) out.add(rank === 6 ? 'penchan' : 'ryanmen'); // 789 waiting on 7
    else out.add(rank === 0 ? 'penchan' : 'ryanmen'); // 123 waiting on 3
  }
  return [...out];
}

/**
 * A triplet completed by RON on a shanpon wait was open at the moment of the
 * win: it scores as an open triplet and does not count toward sanankou.
 * Tsumo keeps it concealed.
 */
export function effectiveSets(
  d: Decomposition, wait: WaitType, isTsumo: boolean, winKind: TileKind,
): SetInfo[] {
  const sets = allSets(d);
  if (isTsumo || wait !== 'shanpon') return sets;
  return sets.map((s) =>
    s.concealed && s.type === 'koutsu' && !s.isKan && s.kind === winKind
      ? { ...s, concealed: false }
      : s);
}

/** Concealed triplets/kans, applying the ron-shanpon rule. */
export function concealedTriplets(
  d: Decomposition, wait: WaitType, isTsumo: boolean, winKind: TileKind,
): SetInfo[] {
  return effectiveSets(d, wait, isTsumo, winKind).filter((s) => s.type === 'koutsu' && s.concealed);
}
