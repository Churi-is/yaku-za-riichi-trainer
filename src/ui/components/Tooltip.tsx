/** Tooltip — explains the METHOD behind a signal. Owned by Worker D. */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface TooltipProps {
  /** The explanatory text (the teaching). */
  content: ReactNode;
  /** Trigger label; defaults to a small "why?" affordance. */
  label?: ReactNode;
}

export default function Tooltip({ content, label = 'why?' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <span className="tt" ref={ref}>
      <button
        type="button"
        className="tt-trigger"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {label}
      </button>
      {open && <span className="tt-bubble" role="tooltip">{content}</span>}
    </span>
  );
}
