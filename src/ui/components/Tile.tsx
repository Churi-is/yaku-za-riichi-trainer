/** Tile — renders a single mahjong tile face or back. Owned by Worker D. */
import type { TileId } from '@engine/types';
import { isRedFiveId, tileFace } from '@ui/tiles';
import TileFace from './TileFace';

export type TileSize = 'xs' | 'sm' | 'md' | 'lg' | 'rv' | 'bk' | 'hand' | 'meld';
export type TileRotation = 0 | 90 | 180 | 270;

export interface TileProps {
  id: TileId;
  /** Render the tile back (never reveals a concealed opponent tile). */
  faceDown?: boolean;
  size?: TileSize;
  /** Orientation on the table: opponents' tiles sit rotated, top-down. */
  rotation?: TileRotation;
  /** Dimmed, e.g. a tile that was called away or a spent discard. */
  dimmed?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}

export default function Tile({
  id, faceDown = false, size = 'md', rotation = 0, dimmed = false,
  selected = false, disabled = false, onClick, title, ariaLabel,
}: TileProps) {
  const red = !faceDown && isRedFiveId(id);
  const cls = [
    'tile',
    `tile-${size}`,
    rotation !== 0 ? `rot${rotation}` : '',
    dimmed ? 'tile-dimmed' : '',
    selected ? 'tile-selected' : '',
    onClick ? 'tile-clickable' : '',
    disabled ? 'tile-disabled' : '',
    faceDown ? 'tile-back' : '',
    red ? 'tile-red' : '',
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return <div className={cls} aria-hidden="true" title={title} />;
  }

  const face = tileFace(id);
  const label = ariaLabel ?? (red ? `red ${face.label}` : face.label);
  const content = <span className="tile-art"><TileFace id={id} /></span>;

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={disabled}
        title={title ?? label}
        aria-label={label}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cls} role="img" aria-label={label} title={title ?? label}>
      {content}
    </div>
  );
}
