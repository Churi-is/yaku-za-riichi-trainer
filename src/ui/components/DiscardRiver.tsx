/** DiscardRiver — a seat's discard pond. Owned by Worker D. */
import type { DiscardEntry } from '@engine/types';
import Tile from './Tile';

export interface DiscardRiverProps {
  river: DiscardEntry[];
  orientation?: 'bottom' | 'top' | 'left' | 'right';
}

export default function DiscardRiver({ river, orientation = 'bottom' }: DiscardRiverProps) {
  const cls = orientation === 'left' || orientation === 'right' ? 'river river-left' : 'river';
  return (
    <div className={cls} aria-label="discards">
      {river.map((d, i) => (
        <Tile
          key={i}
          id={d.tile}
          size="xs"
          rotated={d.riichiDeclaration}
          dimmed={d.calledBy !== null}
          title={d.calledBy !== null ? 'called away' : d.tsumogiri ? 'tsumogiri' : undefined}
        />
      ))}
    </div>
  );
}
