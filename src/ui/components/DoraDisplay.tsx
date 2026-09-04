/** DoraDisplay — face-up dora indicators. Owned by Worker D. */
import type { TileId } from '@engine/types';
import Tile from './Tile';

export interface DoraDisplayProps {
  indicators: TileId[];
  tilesRemaining: number;
}

export default function DoraDisplay({ indicators, tilesRemaining }: DoraDisplayProps) {
  return (
    <div className="dora-box">
      <span className="dora-label">Dora indicators</span>
      <div className="dora-tiles">
        {indicators.map((id, i) => <Tile key={i} id={id} size="sm" />)}
        {/* unrevealed indicators shown as backs to hint at the dead wall */}
        {Array.from({ length: Math.max(0, 5 - indicators.length) }).map((_, i) => (
          <Tile key={`b${i}`} id={0} size="sm" faceDown />
        ))}
      </div>
      <span className="sticks">{tilesRemaining} tiles left</span>
    </div>
  );
}
