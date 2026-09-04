/**
 * DiscardRiver — a seat's discard pond, oriented for the top-down table.
 * The pond is a FIXED 6x3 (or 3x6) grid: tiles are placed into explicit cells
 * so adding a discard never reflows or re-centres anything on the table.
 * Rows start at the owning seat's own edge and advance toward the centre, in
 * that seat's left-to-right order — like a physical pond.
 */
import type { CSSProperties } from 'react';
import type { DiscardEntry } from '@engine/types';
import Tile, { type TileRotation, type TileSize } from './Tile';

export interface DiscardRiverProps {
  river: DiscardEntry[];
  /** Base rotation of the owning seat on the table (0/90/180/270). */
  rotation?: TileRotation;
  /** Side seats lay their pond 3-wide (which reads as 3 columns rotated). */
  side?: boolean;
  size?: TileSize;
}

/** Grid cell for discard i, per seat orientation. r = row of 6, c = index in row. */
function cellStyle(rotation: TileRotation, i: number): CSSProperties {
  const r = Math.floor(i / 6);
  const c = i % 6;
  switch (rotation) {
    case 180: // across: their left→right is screen right→left; rows go down
      return { gridRow: r + 1, gridColumn: 6 - c };
    case 90: // left seat: their left→right is screen top→down; rows go right
      return { gridColumn: r + 1, gridRow: c + 1 };
    case 270: // right seat: their left→right is screen bottom→top; rows go left
      return { gridColumn: 3 - r, gridRow: 6 - c };
    default: // own pond: their left→right is screen left→right; rows go up
      return { gridRow: 3 - r, gridColumn: c + 1 };
  }
}

export default function DiscardRiver({ river, rotation = 0, side = false, size = 'rv' }: DiscardRiverProps) {
  return (
    <div className={`river${side ? ' side' : ''}`} aria-label="discards">
      {river.map((d, i) => (
        <div className="river-cell" key={i} style={cellStyle(rotation, i)}>
          <Tile
            id={d.tile}
            size={size}
            rotation={(((rotation + (d.riichiDeclaration ? 90 : 0)) % 360) as TileRotation)}
            dimmed={d.calledBy !== null}
            title={d.calledBy !== null ? 'called away' : d.tsumogiri ? 'tsumogiri' : undefined}
          />
        </div>
      ))}
    </div>
  );
}
