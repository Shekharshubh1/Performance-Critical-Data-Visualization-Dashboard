'use client';

import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { setupCanvas } from '@/lib/canvasUtils';
import { scheduleFrame } from '@/lib/performanceUtils';

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * Owns a canvas element: handles DPR-aware sizing, ResizeObserver-driven
 * invalidation, and a shared rAF render loop. The `draw` callback is kept in
 * a ref so changing it never re-subscribes observers.
 *
 * Redraws happen only when dirty: the hook marks the canvas dirty after every
 * component render (data tick / interaction), so draw cost is paid at the rate
 * state changes — not at the 60Hz frame rate.
 */
export function useChartRenderer(draw: (dc: DrawContext) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const dirtyRef = useRef(true);
  const sizeRef = useRef({ width: 0, height: 0 });

  const invalidate = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // every render (new data, zoom/pan, hover) requests exactly one redraw
  useLayoutEffect(() => {
    dirtyRef.current = true;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      dirtyRef.current = true;
    });
    ro.observe(canvas);

    const stop = scheduleFrame(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const sizeChanged = w !== sizeRef.current.width || h !== sizeRef.current.height;
      if (!(dirtyRef.current || sizeChanged)) return;
      dirtyRef.current = false;
      sizeRef.current = { width: w, height: h };
      const ctx = setupCanvas(canvas);
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      drawRef.current({ ctx, width: w, height: h });
    });

    return () => {
      ro.disconnect();
      stop();
    };
  }, []);

  return { canvasRef, invalidate };
}
