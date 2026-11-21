import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';

/** A figure that counts up when it first appears or changes (bondhu-fund's CountText). Skipped for reduced motion. */
export const CountText: React.FC<{ value: number | null | undefined; className?: string; suffix?: string }> = ({ value, className = '', suffix = '' }) => {
  const { num } = useApp();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const to = Number(value ?? 0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(to); from.current = to; return; }
    const start = performance.now(), a = from.current, dur = 700;
    let id = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (to - a) * e));
      if (p < 1) id = requestAnimationFrame(step); else from.current = to;
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <span className={`num-in tabular-nums ${className}`}>{value === null || value === undefined ? '—' : num(shown)}{suffix}</span>;
};

export default CountText;
