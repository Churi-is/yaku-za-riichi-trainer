/** DiscardRiver — a seat's discard pond, oriented for the top-down table. */
import type { DiscardEntry } from '@engine/types';
import Tile, { type TileRotation, type TileSize } from './Tile';

export interface DiscardRiverProps {
  river: DiscardEntry[];
  /** Base rotation of the owning seat on the table (0/90/180/270). */
  rotation?: TileRotation;
  /** Side seats lay their river 3-wide (which reads as 3 columns rotated). */
  side?: boolean;
  size?: TileSize;
}

export default function DiscardRiver({ river, rotation = 0, side = false, size = 'rv' }: DiscardRiverProps) {
  return (
    <div className={`river${side ? ' side' : ''}`} aria-label="discards">
      {river.length === 0 && <div className="river-empty" aria-hidden="true" />}
      {river.map((d, i) => (
        <Tile
          key={i}
          id={d.tile}
          size={size}
          rotation={(((rotation + (d.riichiDeclaration ? 90 : 0)) % 360) as TileRotation)}
          dimmed={d.calledBy !== null}
          title={d.calledBy !== null ? 'called away' : d.tsumogiri ? 'tsumogiri' : undefined}
        />
      ))}
    </div>
  );
}
