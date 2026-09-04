/** MeldArea — a seat's called melds. Owned by Worker D. */
import type { Meld } from '@engine/types';
import Tile from './Tile';
import type { TileSize } from './Tile';

export interface MeldAreaProps {
  melds: Meld[];
  size?: TileSize;
}

export default function MeldArea({ melds, size = 'sm' }: MeldAreaProps) {
  if (melds.length === 0) return null;
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
              rotated={m.calledTile === t && m.calledFrom !== null}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
