/**
 * useBoxSize — the live pixel size of an element.
 *
 * The table is designed at exact board coordinates and then uniformly scaled,
 * exactly like a real game board: nothing ever reflows awkwardly on a small
 * phone. To do that well the board also needs to know the SHAPE of the felt it
 * has been given, so it can stretch its layout to fill it instead of sitting
 * in a letterbox of dead cloth — hence the raw box, not just a scale factor.
 */
import { useEffect, useState, type RefObject } from 'react';

interface BoxSize { w: number; h: number }

export function useBoxSize(ref: RefObject<HTMLElement | null>): BoxSize {
  const [box, setBox] = useState<BoxSize>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 40 || height < 40) return; // jsdom / pre-layout: keep 0
      setBox((prev) => (
        Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
          ? prev
          : { w: width, h: height }
      ));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return box;
}

/** uniform scale that fits a fixed board of `boardW × boardH` into `box` */
export function fitScale(box: BoxSize, boardW: number, boardH: number): number {
  if (box.w < 40 || box.h < 40) return 1;
  return Math.max(0.4, Math.min(Math.min(box.w / boardW, box.h / boardH), 2.4));
}
