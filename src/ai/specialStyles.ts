/** Public, lightweight descriptions/status; safe to use in the UI. */
import type { PublicSeatView } from '@engine/types';
import type { SpecialStyle } from './types';

const GEAR_LENGTH = 3;

/** Phase comes from the river, so every new hand resets without hidden state. */
export function racingGear(discards: number): { attack: boolean; step: number; label: string } {
  const count = Math.max(0, Math.floor(discards));
  const attack = Math.floor(count / GEAR_LENGTH) % 2 === 0;
  const step = count % GEAR_LENGTH + 1;
  return { attack, step, label: `${attack ? 'Redline' : 'Pit stop'} ${step}/${GEAR_LENGTH}` };
}

/** Only publicly observable commitments; never announces a private hand read. */
export function specialStatus(style: SpecialStyle, seat: PublicSeatView): string {
  switch (style) {
    case 'selfSabotage': return 'Self-sabotage';
    case 'manganMinimum': return 'Mangan min.';
    case 'ronOnly': return 'Ron only';
    case 'gearShift': return seat.riichi ? 'Riichi locked' : racingGear(seat.river.length).label;
  }
}
