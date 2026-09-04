/** useViewport — which match skeleton is active (see PLAN-MOBILE-LAYOUT §4.1). */
import { useEffect, useState } from 'react';

export type Viewport = 'desktop' | 'portrait' | 'landscape';

function query(): Viewport {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  const portrait = window.matchMedia('(max-width: 600px) and (orientation: portrait)');
  const landscape = window.matchMedia('(max-height: 500px) and (orientation: landscape)');
  return portrait.matches ? 'portrait' : landscape.matches ? 'landscape' : 'desktop';
}

function listen(mql: MediaQueryList, onChange: () => void): () => void {
  // Older mobile browsers only have addListener; the fallback keeps them working.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

/** Follow the same media queries the CSS skeletons use. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(query);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const portrait = window.matchMedia('(max-width: 600px) and (orientation: portrait)');
    const landscape = window.matchMedia('(max-height: 500px) and (orientation: landscape)');
    const update = () => setViewport(query());
    const offPortrait = listen(portrait, update);
    const offLandscape = listen(landscape, update);
    return () => {
      offPortrait();
      offLandscape();
    };
  }, []);

  return viewport;
}
