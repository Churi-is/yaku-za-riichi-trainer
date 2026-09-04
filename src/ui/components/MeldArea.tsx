/** MeldArea — a seat's called melds. Owned by Worker D. */
import type { Meld } from '@engine/types';
import Tile, { type TileSize, type TileOrientation } from './Tile';

export interface MeldAreaProps {
  melds: Meld[];
  size?: TileSize;
  /** Sideways seats pass 'left'/'right'; called tiles become upright markers (§5.3). */
  orientation?: TileOrientation;
}

export default function MeldArea({ melds, size = 'sm', orientation = 'upright' }: MeldAreaProps) {
  if (melds.length === 0) return null;
  const side = orientation === 'left' || orientation === 'right' ? orientation : undefined;
  return (
    <div className="opp-melds" aria-label="melds">
      {melds.map((m, i) => (
        <div className="meld" key={i}>
          {m.tiles.map((t, j) => (
            <Tile
              key={j}
              id={t}
              size={size}
              faceDown={m.type === 'ankan' && (j === 0 || j === 3)}
              rotated={m.calledTile === t && m.calledFrom !== null && !side}
              orientation={side ?? 'upright'}
              marker={m.calledTile === t && m.calledFrom !== null && !!side}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
