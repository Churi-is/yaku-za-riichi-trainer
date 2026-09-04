/** DiscardRiver — a seat's discard pond. Owned by Worker D. */
import type { DiscardEntry } from '@engine/types';
import Tile from './Tile';

export interface DiscardRiverProps {
  river: DiscardEntry[];
  orientation?: 'bottom' | 'top' | 'left' | 'right';
}

/** Chunk into vertical columns of 6; chunk 1 is the oldest discards. */
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Side seats (left/right) render columns of 6 so the river never exceeds the strip width.
 * Visual orientation: oldest column at the outer edge, newest nearest the table centre;
 * inside every column the first discard sits at the bottom (see PLAN-MOBILE-LAYOUT §5.4).
 */
export default function DiscardRiver({ river, orientation = 'bottom' }: DiscardRiverProps) {
  if (orientation === 'left' || orientation === 'right') {
    const side = orientation; // 'left' | 'right'
    return (
      <div className={`river river-side river-${side}`} aria-label="discards">
        {chunks(river, 6).map((chunk, ci) => (
          <div className="river-col" key={ci}>
            {chunk.map((d, i) => (
              <Tile
                key={i}
                id={d.tile}
                size="xs"
                orientation={side}
                marker={d.riichiDeclaration}
                dimmed={d.calledBy !== null}
                title={d.calledBy !== null ? 'called away' : d.tsumogiri ? 'tsumogiri' : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="river" aria-label="discards">
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
