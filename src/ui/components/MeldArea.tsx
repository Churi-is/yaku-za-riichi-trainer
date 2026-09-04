/** MeldArea — a seat's called melds, oriented for the table. */
import type { Meld } from '@engine/types';
import Tile, { type TileRotation, type TileSize } from './Tile';

export interface MeldAreaProps {
  melds: Meld[];
  size?: TileSize;
  /** Rotation matching the owning seat on the top-down table. */
  rotation?: TileRotation;
  /** Side seats: melds stack along their edge and each meld's tiles run
   *  along that same edge (a column on screen), matching their hand row. */
  vertical?: boolean;
}

export default function MeldArea({ melds, size = 'sm', rotation = 0, vertical = false }: MeldAreaProps) {
  if (melds.length === 0) return null;
  return (
    <div
      className="opp-melds"
      aria-label="melds"
      style={vertical ? { flexDirection: 'column', alignItems: 'center' } : undefined}
    >
      {melds.map((m, i) => (
        <div className="meld" key={i} style={{ display: 'flex', gap: 1, flexDirection: vertical ? 'column' : 'row' }}>
          {m.tiles.map((t, j) => (
            <Tile
              key={j}
              id={t}
              size={size}
              faceDown={m.type === 'ankan' && (j === 0 || j === 3)}
              rotation={((rotation + (m.calledTile === t && m.calledFrom !== null ? 90 : 0)) % 360) as TileRotation}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
