'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Measures an element with a ResizeObserver. Charts use this to place SVG
 * axis labels at exact pixel positions instead of percentage approximations.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}
