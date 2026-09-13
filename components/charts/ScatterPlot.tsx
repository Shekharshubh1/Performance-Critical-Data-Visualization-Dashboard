'use client';

import { useMemo, useState } from 'react';
import { useDataWindow, useDashboardSettings } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { useElementSize } from '@/hooks/useElementSize';
import { downsampleLOD, findIndexBefore, formatTime, niceTicks } from '@/lib/canvasUtils';
import { CATEGORY_COLORS } from '@/lib/types';
import { dataPerf } from '@/lib/performanceUtils';
import { GRID_COLOR, MARGIN, extent } from './chartTheme';
import type { DataPoint } from '@/lib/types';

/**
 * Scatter plot with LOD downsampling and a nearest-point hover tooltip.
 * Data points are drawn as filled circles on canvas (single batched path
 * per category); the crosshair + tooltip are SVG.
 */
export default function ScatterPlot() {
  const { rangeData } = useDataWindow();
  const { viewport } = useDashboardSettings();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; y: number; point: DataPoint } | null>(null);

  const points = useMemo(() => {
    if (rangeData.length === 0) return [];
    const last = rangeData[rangeData.length - 1].timestamp;
    const first = rangeData[0].timestamp;
    const [t0, t1] = viewport && viewport.end > viewport.start ? [viewport.start, viewport.end] : [first, last];
    const i0 = Math.max(0, findIndexBefore(rangeData, t0));
    const i1 = findIndexBefore(rangeData, t1);
    // LOD: at most ~1 point per pixel of an assumed 700px plot (index-bounded,
    // no slice copy of the window)
    const t = performance.now();
    const result = downsampleLOD(rangeData, t0, t1, 700, i0, i1);
    dataPerf.lodMs = performance.now() - t;
    return result;
  }, [rangeData, viewport]);

  const [t0, t1] = useMemo((): [number, number] => {
    if (viewport && viewport.end > viewport.start) return [viewport.start, viewport.end];
    if (points.length === 0) return [Date.now() - 60_000, Date.now()];
    return extent(points, (p) => p.timestamp);
  }, [points, viewport]);

  const [vMin, vMax] = useMemo(
    () => (points.length ? extent(points, (p) => p.value) : ([0, 1] as const)),
    [points]
  );
  const yTicks = useMemo(() => niceTicks(vMin, vMax, 5), [vMin, vMax]);

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

      ctx.strokeStyle = GRID_COLOR;
      for (const t of yTicks.ticks) {
        ctx.beginPath();
        ctx.moveTo(left, Y(t));
        ctx.lineTo(right, Y(t));
        ctx.stroke();
      }

      // batch per category: one fill per category keeps state changes minimal
      const r = 2;
      for (const category of Object.keys(CATEGORY_COLORS)) {
        ctx.fillStyle = CATEGORY_COLORS[category];
        ctx.beginPath();
        let any = false;
        for (const p of points) {
          if (p.category !== category) continue;
          const x = X(p.timestamp);
          const y = Y(p.value);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
          any = true;
        }
        if (any) ctx.fill();
      }
    },

  );

  // hover: nearest point lookup on move (throttled by pointer event rate)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const w = rect.width - MARGIN.left - MARGIN.right;
    if (w <= 0 || points.length === 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - MARGIN.left) / w));
    const ts = t0 + (t1 - t0) * frac;
    const idx = Math.max(0, findIndexBefore(points, ts));
    const p = points[idx];
    if (!p) return setHover(null);
    const heightFrac = (yTicks.max - p.value) / (yTicks.max - yTicks.min || 1);
    const plotH = rect.height - MARGIN.top - MARGIN.bottom;
    setHover({ x: e.clientX - rect.left, y: MARGIN.top + heightFrac * plotH, point: p });
  };

  const plotH = Math.max(1, size.height - MARGIN.top - MARGIN.bottom);

  return (
    <div ref={containerRef} className="relative h-full w-full select-none" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-[10px]">
        {size.height > 0 &&
          yTicks.ticks.map((t) => {
            const frac = (yTicks.max - t) / (yTicks.max - yTicks.min || 1);
            return (
              <text
                key={`y${t}`}
                x={MARGIN.left - 6}
                y={MARGIN.top + frac * plotH}
                dy="0.32em"
                textAnchor="end"
                className="fill-slate-400"
              >
                {t.toFixed(1)}
              </text>
            );
          })}
        {hover && (
          <g>
            <line x1={hover.x} y1={MARGIN.top} x2={hover.x} y2="85%" stroke="rgba(148,163,184,0.4)" strokeDasharray="3 3" />
            <circle cx={hover.x} cy={hover.y} r={4} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />
            <g
              transform={`translate(${Math.min(
                hover.x + 8,
                Math.max(4, size.width - 138)
              )}, ${Math.max(hover.y - 30, 4)})`}
            >
              <rect width="130" height="34" rx="4" fill="rgba(15,23,42,0.92)" stroke="rgba(148,163,184,0.3)" />
              <text x="8" y="14" className="fill-slate-200">
                {hover.point.category} · {hover.point.value.toFixed(2)}
              </text>
              <text x="8" y="27" className="fill-slate-400">
                {formatTime(hover.point.timestamp)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
