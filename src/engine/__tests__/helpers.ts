/**
 * Shared test helpers for the engine suite.
 *
 * Notation: `123m 45p 789s ESWN PFC`, digits run until a suit letter.
 *   m/p/s = man/pin/sou. `z` also works (`1z` = East ... `7z` = Chun).
 *   E S W N = winds, P = Haku (white), F = Hatsu (green), C = Chun (red).
 *   `0m` / `0p` / `0s` = the RED five. A plain `5m` is always a NON-red five,
 *   so tests never hit an aka dora by accident.
 */
import { idOf, RED_FIVE_KINDS } from '../tiles';
import type { Meld, TileId, TileKind } from '../types';

const SUIT_BASE: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 };
const HONOR_CHARS: Record<string, number> = { E: 27, S: 28, W: 29, N: 30, P: 31, F: 32, C: 33 };

interface Tok {
  kind: TileKind;
  red: boolean;
}

export function parseTokens(text: string): Tok[] {
  const toks: Tok[] = [];
  let digits = '';
  for (const ch of text.replace(/\s+/g, '')) {
    if (/[0-9]/.test(ch)) {
      digits += ch;
      continue;
    }
    // Honors are UPPERCASE, suits are lowercase — 'S' is South, 's' is sou.
    const honor = HONOR_CHARS[ch];
    if (honor !== undefined) {
      toks.push({ kind: honor, red: false });
      digits = '';
      continue;
    }
    const suit = SUIT_BASE[ch];
    if (suit === undefined) throw new Error(`bad tile char: ${ch}`);
    if (!digits) throw new Error(`missing rank before suit: ${ch}`);
    for (const d of digits) {
      const rank = Number(d);
      if (rank === 0) {
        if (ch === 'z') throw new Error('no red honors');
        toks.push({ kind: suit + 4, red: true });
      } else if (ch === 'z') {
        toks.push({ kind: 26 + rank, red: false });
      } else {
        toks.push({ kind: suit + rank - 1, red: false });
      }
    }
    digits = '';
  }
  return toks;
}

/** Parse notation into tile ids (sorted ascending). */
export function parse(text: string): TileId[] {
  const next = new Array<number>(34).fill(0);
  const taken = new Set<TileId>();
  const ids: TileId[] = [];
  for (const tok of parseTokens(text)) {
    let copy = tok.red ? 0 : next[tok.kind];
    if (!tok.red && copy === 0 && RED_FIVE_KINDS.includes(tok.kind)) copy = 1;
    while (taken.has(idOf(tok.kind, copy))) copy++;
    if (copy > 3) throw new Error(`more than four copies of kind ${tok.kind}`);
    taken.add(idOf(tok.kind, copy));
    ids.push(idOf(tok.kind, copy));
    next[tok.kind] = copy + 1;
  }
  return ids.sort((a, b) => a - b);
}

/** Parse notation into a 34-slot count array. */
export function parseCounts(text: string): number[] {
  const counts = new Array<number>(34).fill(0);
  for (const tok of parseTokens(text)) counts[tok.kind]++;
  return counts;
}

/** Build a meld from notation. `calledFrom` defaults to the kamicha. */
export function meld(type: Meld['type'], text: string, calledFrom: 0 | 1 | 2 | 3 | null = 3): Meld {
  const tiles = parse(text);
  if (type === 'chi' && tiles.length !== 3) throw new Error('chi needs 3 tiles');
  return {
    type,
    tiles,
    calledFrom: type === 'ankan' ? null : calledFrom,
    calledTile: type === 'ankan' ? null : tiles[0],
    concealed: type === 'ankan',
  };
}
