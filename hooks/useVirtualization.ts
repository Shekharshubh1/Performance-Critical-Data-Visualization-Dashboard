'use client';

import { useCallback, useRef, useState } from 'react';

export interface VirtualizationOptions {
  rowHeight: number;
  overscan?: number;
}

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
}

/** Windowing for long lists: only rows inside viewport + overscan render. */
export function useVirtualization(itemCount: number, { rowHeight, overscan = 6 }: VirtualizationOptions): VirtualWindow {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeightRef = useRef(400);

  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    viewportHeightRef.current = e.currentTarget.clientHeight;
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const viewportHeight = viewportHeightRef.current;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(itemCount, startIndex + visibleCount);

  return {
    startIndex,
    endIndex,
    totalHeight: itemCount * rowHeight,
    offsetY: startIndex * rowHeight,
    onScroll,
  };
}
