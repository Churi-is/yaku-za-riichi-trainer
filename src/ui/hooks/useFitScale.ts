/**
 * useFitScale — scales a fixed-coordinate board to fit its container.
 * The table is designed once per orientation at exact pixel coordinates and
 * then uniformly scaled, exactly like a game board: nothing ever overflows or
 * reflows awkwardly on a small phone.
 */
import { useEffect, useState, type RefObject } from 'react';

export function useFitScale(
  ref: RefObject<HTMLElement | null>,
  boardW: number,
  boardH: number,
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 40 || height < 40) return; // jsdom / pre-layout: keep 1
      const s = Math.min(width / boardW, height / boardH);
      setScale(Math.max(0.4, Math.min(s, 2.2)));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, boardW, boardH]);

  return scale;
}
