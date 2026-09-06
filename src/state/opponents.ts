/** Fixed physical seats. Removing a bot must never move anybody else. */
import { DEFAULT_OPPONENTS, PERSONALITIES } from '@ai/personalities';

export type OpponentSeat = 1 | 2 | 3;
export type OpponentSeats = [string | null, string | null, string | null];

export const OPPONENT_POSITIONS = [
  { seat: 1, label: 'Right', japanese: '下家', hint: 'Plays after you' },
  { seat: 2, label: 'Across', japanese: '対面', hint: 'Opposite you' },
  { seat: 3, label: 'Left', japanese: '上家', hint: 'You can chi from this seat' },
] as const;

const knownIds = new Set(PERSONALITIES.map((p) => p.id));

/** Unknown ids and duplicates become holes, never a compacted/shifted array. */
export function normalizeOpponents(ids: readonly (string | null)[]): OpponentSeats {
  const seen = new Set<string>();
  return [0, 1, 2].map((index) => {
    const id = ids[index];
    if (!id || !knownIds.has(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  }) as OpponentSeats;
}

/** Assign a new opponent, or swap two seats if the character is already here. */
export function assignOpponent(
  ids: readonly (string | null)[], seat: OpponentSeat, id: string,
): OpponentSeats {
  const next = normalizeOpponents(ids);
  if (!knownIds.has(id)) return next;
  const target = seat - 1;
  const source = next.indexOf(id);
  if (source === target) return next;
  if (source >= 0) next[source] = next[target];
  next[target] = id;
  return next;
}

/** Defensive match-start fallback; preserve every valid manual assignment. */
export function completeOpponents(ids: readonly (string | null)[]): [string, string, string] {
  const seats = normalizeOpponents(ids);
  const candidates = [...DEFAULT_OPPONENTS, ...PERSONALITIES.map((p) => p.id)];
  for (let i = 0; i < 3; i++) {
    if (seats[i] === null) seats[i] = candidates.find((id) => !seats.includes(id))!;
  }
  return seats as [string, string, string];
}
