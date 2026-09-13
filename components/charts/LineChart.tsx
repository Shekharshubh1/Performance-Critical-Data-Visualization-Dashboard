'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useDataWindow, useDashboardSettings } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { useElementSize } from '@/hooks/useElementSize';
import { downsampleLOD, findIndexBefore, formatTime, niceTicks } from '@/lib/canvasUtils';
import { CATEGORY_COLORS } from '@/lib/types';
import type { DataPoint } from '@/lib/types';
import { useMemoizedAggregation } from '@/hooks/useMemoizedAggregation';
import { dataPerf } from '@/lib/performanceUtils';
import { GRID_COLOR, MARGIN } from './chartTheme';

export default function LineChart() {
  const { rangeData } = useDataWindow();
  const { aggregation, viewport, dispatch } = useDashboardSettings();
  const [containerRef, size] = useElementSize<HTMLDivElement>();

  const plotData = useMemoizedAggregation(rangeData, aggregation);

  const [t0, t1] = useMemo((): [number, number] => {
    if (viewport && viewport.end > viewport.start) return [viewport.start, viewport.end];
    if (plotData.length === 0) return [Date.now() - 60_000, Date.now()];
    return [plotData[0].timestamp, plotData[plotData.length - 1].timestamp];
  }, [viewport, plotData]);

  // single O(window) pass per data tick: category split + value extents
  const windowed = useMemo(() => {
    const i0 = Math.max(0, findIndexBefore(plotData, t0));
    const i1 = findIndexBefore(plotData, t1);
    const by = new Map<string, DataPoint[]>();
    let min = Infinity;
    let max = -Infinity;
    // index-bounded scan — no slice copy of the (possibly 100k-point) window
    for (let i = i0; i <= i1; i++) {
      const p = plotData[i];
      let arr = by.get(p.category);
      if (!arr) by.set(p.category, (arr = []));
      arr.push(p);
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
    return { by, min: min === Infinity ? 0 : min, max: max === Infinity ? 1 : max };
  }, [plotData, t0, t1]);

  const dataByCategory = windowed.by;

  const yTicks = useMemo(() => niceTicks(windowed.min, windowed.max, 5), [windowed]);
  const xTicks = useMemo(() => {
    const n = 6;
    return Array.from({ length: n + 1 }, (_, i) => t0 + ((t1 - t0) * i) / n);
  }, [t0, t1]);

  const plotW = Math.max(1, size.width - MARGIN.left - MARGIN.right);

  // zoom via a native, non-passive wheel listener: React's onWheel is passive,
  // so preventDefault() inside it is ignored and the page scrolls while zooming
  const viewRef = useRef({ t0, t1 });
  viewRef.current = { t0, t1 };
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width - MARGIN.left - MARGIN.right);
      const { t0, t1 } = viewRef.current;
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - MARGIN.left) / w));
      const span = t1 - t0;
      const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
      const newSpan = Math.max(2000, span * factor);
      const pivot = t0 + span * frac;
      const start = pivot - newSpan * frac;
      dispatch({ type: 'set-viewport', viewport: { start, end: start + newSpan } });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [containerRef, dispatch]);

  const panRef = useRef<{ x: number; t0: number; t1: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; span: number; midFrac: number; pivot: number } | null>(null);

  const pinchState = () => {
    const el = containerRef.current;
    const [a, b] = [...pointersRef.current.values()];
    if (!el || !a || !b) return null;
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, rect.width - MARGIN.left - MARGIN.right);
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mid = (a.x + b.x) / 2;
    return { dist, span: t1 - t0, midFrac: Math.min(1, Math.max(0, (mid - rect.left - MARGIN.left) / w)), pivot: t0 + ((t1 - t0) * Math.min(1, Math.max(0, (mid - rect.left - MARGIN.left) / w))) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      // two fingers: pinch zoom anchored at the pinch midpoint
      const s = pinchState();
      if (s) pinchRef.current = s;
      panRef.current = null;
    } else if (pointersRef.current.size === 1) {
      panRef.current = { x: e.clientX, t0, t1 };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const newSpan = Math.max(2000, pinch.span / (dist / pinch.dist));
      const start = pinch.pivot - newSpan * pinch.midFrac;
      dispatch({ type: 'set-viewport', viewport: { start, end: start + newSpan } });
      return;
    }
    const p = panRef.current;
    if (!p) return;
    const dx = ((e.clientX - p.x) / plotW) * (p.t1 - p.t0);
    dispatch({ type: 'set-viewport', viewport: { start: p.t0 - dx, end: p.t1 - dx } });
  };
  const onPointerUp = (e?: React.PointerEvent) => {
    if (e) pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
    else if (pointersRef.current.size === 1) {
      const [p] = [...pointersRef.current.values()];
      panRef.current = { x: p.x, t0, t1 };
    }
  };

  const { canvasRef } = useChartRenderer(
    ({ ctx, width, height }) => {
      const left = MARGIN.left;
      const right = width - MARGIN.right;
      const top = MARGIN.top;
      const bottom = height - MARGIN.bottom;
      const sx = (right - left) / (t1 - t0 || 1);
      const sy = (bottom - top) / (yTicks.max - yTicks.min || 1);
      const X = (t: number) => left + (t - t0) * sx;
      const Y = (v: number) => bottom - (v - yTicks.min) * sy;

      ctx.fillStyle = 'rgba(2,6,23,0.35)';
      ctx.fillRect(left, top, right - left, bottom - top);

      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      for (const t of yTicks.ticks) {
        const y = Y(t);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }

      // LOD: cap at ~2 points per pixel of plot width
      const bins = Math.max(10, Math.floor((right - left) * 2));
      // don't connect lines across time gaps (window shift, sparse categories)
      const maxStepMs = (t1 - t0) / 40;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const lodT0 = performance.now();
      for (const [category, arr] of dataByCategory) {
        const pts = arr.length > bins ? downsampleLOD(arr, t0, t1, bins) : arr;
        const color = CATEGORY_COLORS[category] ?? '#38bdf8';
        ctx.strokeStyle = color;
        ctx.beginPath();
        let prev: DataPoint | null = null;
        for (let i = 0; i < pts.length; i++) {
          const x = X(pts[i].timestamp);
          const y = Y(pts[i].value);
          if (!prev || pts[i].timestamp - prev.timestamp > maxStepMs) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          prev = pts[i];
        }
        ctx.stroke();

        // soft gradient area under the line
        if (pts.length > 1) {
          const grad = ctx.createLinearGradient(0, top, 0, bottom);
          grad.addColorStop(0, color + '33');
          grad.addColorStop(1, color + '00');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(X(pts[0].timestamp), bottom);
          for (let i = 0; i < pts.length; i++) {
            const x = X(pts[i].timestamp);
            const y = Y(pts[i].value);
            if (i > 0 && pts[i].timestamp - pts[i - 1].timestamp > maxStepMs) {
              // close the previous segment's area, restart after the gap
              ctx.lineTo(x, bottom);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(X(pts[pts.length - 1].timestamp), bottom);
          ctx.closePath();
          ctx.fill();
        }
      }
      dataPerf.lodMs = performance.now() - lodT0;
    }
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-crosshair touch-none select-none"
      onDoubleClick={() => dispatch({ type: 'set-viewport', viewport: null })}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Scroll to zoom · drag to pan · double-click to reset"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-[10px]">
        {size.height > 0 &&
          yTicks.ticks.map((t) => {
            const frac = (yTicks.max - t) / (yTicks.max - yTicks.min || 1);
            const y = MARGIN.top + frac * (size.height - MARGIN.top - MARGIN.bottom);
            return (
              <text key={`y${t}`} x={MARGIN.left - 6} y={y} dy="0.32em" textAnchor="end" className="fill-slate-400">
                {t.toFixed(1)}
              </text>
            );
          })}
        {size.width > 0 &&
          xTicks.map((t, i) => {
            const x = MARGIN.left + (i / (xTicks.length - 1)) * plotW;
            return (
              <text
                key={`x${i}`}
                x={x}
                y={size.height - 8}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                className="fill-slate-400"
              >
                {formatTime(t)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
