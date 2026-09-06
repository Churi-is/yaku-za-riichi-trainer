/** Compact notation for scripted positions and AI fixtures. */
import { KIND_COUNT, RED_FIVE_KINDS } from './tiles';
import type { TileId, TileKind } from './types';

/** Parse compact notation ("123m456p EEEE") into sorted tile ids.
 *  Mirrors the engine test helper so fixtures read the same way. */
export function parseHand(str: string): TileId[] {
  const HONOR_CHARS: Record<string, number> = {
    E: 27, S: 28, W: 29, N: 30, P: 31, F: 32, C: 33,
  };
  const SUIT_BASE: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 };
  const ids: TileId[] = [];
  const next = new Array<number>(KIND_COUNT).fill(0);
  const taken = new Set<TileId>();
  let digits = '';
  const push = (kind: TileKind, red: boolean): void => {
    if (!Number.isInteger(kind) || kind < 0 || kind >= KIND_COUNT) {
      throw new Error(`bad tile in "${str}": no such tile kind ${kind}`);
    }
    let copy = red ? 0 : next[kind];
    if (!red && copy === 0 && RED_FIVE_KINDS.includes(kind)) copy = 1;
    while (copy < 4 && taken.has(kind * 4 + copy)) copy++;
    if (copy >= 4) {
      // Copies 1-3 are gone; the red copy is still reserved for a '0' that
      // never came. Spend it rather than overflowing into the next kind.
      copy = 0;
      while (copy < 4 && taken.has(kind * 4 + copy)) copy++;
    }
    if (copy >= 4) throw new Error(`too many copies of ${kind} in "${str}"`);
    taken.add(kind * 4 + copy);
    ids.push(kind * 4 + copy);
    next[kind] = copy + 1;
  };
  for (const ch of str.replace(/\s+/g, '')) {
    if (/[0-9]/.test(ch)) {
      digits += ch;
      continue;
    }
    const honor = HONOR_CHARS[ch];
    if (honor !== undefined) {
      push(honor, false);
      digits = '';
      continue;
    }
    const base = SUIT_BASE[ch];
    if (base === undefined) throw new Error(`bad tile char: ${ch}`);
    for (const d of digits) {
      const rank = Number(d);
      if (ch === 'z') push(27 + rank - 1, false);
      else push(base + (rank === 0 ? 4 : rank - 1), rank === 0);
    }
    digits = '';
  }
  return ids.sort((a, b) => a - b);
}
