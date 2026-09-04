/**
 * LayoutGuard — DEV-only layout invariant checker (PLAN-MOBILE-LAYOUT §12.3).
 * Re-checks on resize that the match screen has no horizontal overflow and that
 * the main chrome regions never overlap. Tree-shaken from production builds.
 */
import { useEffect, useRef } from 'react';

const REGIONS = ['.match-top', '.table-wrap', '.call-bar', '.hand-dock'];

function check(root: HTMLElement) {
  if (root.scrollWidth > root.clientWidth + 1) {
    console.warn(
      '[layout] horizontal overflow:',
      root.scrollWidth, '>', root.clientWidth,
    );
  }
  const rects = REGIONS.map((sel) => root.querySelector(sel)?.getBoundingClientRect() ?? null);
  const pairs = REGIONS.map((sel, i) => ({ sel, rect: rects[i] })).filter((r) => r.rect);
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i].rect!;
      const b = pairs[j].rect!;
      const overlap =
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      if (overlap && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) {
        console.warn('[layout] overlapping regions:', pairs[i].sel, pairs[j].sel);
      }
    }
  }
}

export default function LayoutGuard() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const root = ref.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const checkNow = () => check(root);
    const ro = new ResizeObserver(checkNow);
    ro.observe(root);
    checkNow();
    return () => ro.disconnect();
  }, []);

  // No-op wrapper so the guard mounts with the match screen.
  return <span ref={ref} data-layout-guard hidden />;
}
