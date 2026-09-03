/**
 * The three table personalities — one per archetype, seated at every table.
 * Yakuza-flavored but generic (no copyrighted character lore). Each tagline
 * honestly telegraphs the archetype: it is a training aid, shown at match
 * start so the player can build a mental model of each seat.
 */
import type { Personality } from './types';

export const PERSONALITIES: Personality[] = [
  {
    id: 'kenta',
    name: 'Kenta the Rush',
    archetype: 'aggressive',
    tagline:
      'Calls pon and chi early to slap together fast, cheap hands. Declares riichi the instant he is tenpai and almost never backs down — he will deal in.',
  },
  {
    id: 'sada',
    name: 'Sada the Steady',
    archetype: 'balanced',
    tagline:
      'Reads the table, chimes in only when a call clearly speeds or values the hand, and folds when the math turns against him.',
  },
  {
    id: 'tsuru',
    name: 'Tsuru the Wall',
    archetype: 'defensive',
    tagline:
      'Plays closed and patient, holds strong shapes, waits for value, and slips out on genbutsu and suji the moment danger shows. Very hard to deal into.',
  },
];

export function personalityById(id: string): Personality {
  const p = PERSONALITIES.find((x) => x.id === id);
  if (!p) throw new Error(`unknown personality id: ${id}`);
  return p;
}
