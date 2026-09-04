/** Tile — renders a single mahjong tile face or back. Owned by Worker D. */
import type { TileId } from '@engine/types';
import { isRedFiveId, tileFace } from '@ui/tiles';

export type TileSize = 'xs' | 'sm' | 'md' | 'lg';

export interface TileProps {
  id: TileId;
  /** Render the tile back (never reveals a concealed opponent tile). */
  faceDown?: boolean;
  size?: TileSize;
  /** Rotated sideways, e.g. riichi declaration tile or a called meld tile. */
  rotated?: boolean;
  /** Dimmed, e.g. a tile that was called away or a spent discard. */
  dimmed?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}

export default function Tile({
  id, faceDown = false, size = 'md', rotated = false, dimmed = false,
  selected = false, disabled = false, onClick, title, ariaLabel,
}: TileProps) {
  const cls = [
    'tile',
    `tile-${size}`,
    rotated ? 'tile-rotated' : '',
    dimmed ? 'tile-dimmed' : '',
    selected ? 'tile-selected' : '',
    onClick ? 'tile-clickable' : '',
    disabled ? 'tile-disabled' : '',
    faceDown ? 'tile-back' : '',
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return <div className={cls} aria-hidden="true" title={title} />;
  }

  const face = tileFace(id);
  const red = isRedFiveId(id);
  const label = ariaLabel ?? (red ? `red ${face.label}` : face.label);
  const content = (
    <span className={`tile-face tile-group-${face.group}${red ? ' tile-red' : ''}`}>
      <span className="tile-glyph">{face.glyph}</span>
      {face.suitGlyph && <span className="tile-suit">{face.suitGlyph}</span>}
    </span>
  );

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
