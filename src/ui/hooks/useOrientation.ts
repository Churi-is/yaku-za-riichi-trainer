/**
 * useOrientation — portrait-first viewport layout mode.
 * Portrait (a phone held upright) is the primary layout; landscape is the
 * wide-table variant, with a compact sub-mode for short landscape viewports
 * (phones on their side). Falls back to aspect ratio when matchMedia is
 * missing.
 */
import { useEffect, useState } from 'react';

export type Orientation = 'portrait' | 'landscape';

export interface ViewportMode {
  orient: Orientation;
  /** Landscape on a short viewport (phone sideways): tighter board. */
  compact: boolean;
  /** Viewport width in CSS pixels, for layouts that need more than a mode. */
  width: number;
}

function current(): ViewportMode {
  if (typeof window === 'undefined') return { orient: 'portrait', compact: false, width: 0 };
  let portrait = window.innerHeight >= window.innerWidth;
  try {
    if (typeof window.matchMedia === 'function') {
      portrait = window.matchMedia('(orientation: portrait)').matches;
    }
  } catch { /* keep aspect fallback */ }
  const compact = !portrait && window.innerHeight < 520;
  return { orient: portrait ? 'portrait' : 'landscape', compact, width: window.innerWidth };
}

export function useOrientation(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(current);

  useEffect(() => {
    const update = () => setMode(current());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mode;
}
