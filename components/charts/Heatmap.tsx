'use client';

import { useMemo } from 'react';
import { useDataWindow } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { useElementSize } from '@/hooks/useElementSize';
import { formatTime } from '@/lib/canvasUtils';
import { CATEGORIES } from '@/lib/types';
import { MARGIN } from './chartTheme';

const BUCKETS = 80;

/** Value density heat: time (x) × category (y), intensity = avg value. */
export default function Heatmap() {
  const { rangeData } = useDataWindow();
  const [containerRef, size] = useElementSize<HTMLDivElement>();

  const grid = useMemo(() => {
    if (rangeData.length === 0) return { t0: Date.now() - 60_000, t1: Date.now(), cells: [] as { v: number; n: number }[][] };
    const t0 = rangeData[0].timestamp;
    const t1 = rangeData[rangeData.length - 1].timestamp;
    const bucketMs = Math.max(1, (t1 - t0) / BUCKETS);
    // cells[bucket][categoryIndex] accumulates sum & count
    const cells: { v: number; n: number }[][] = Array.from({ length: BUCKETS }, () =>
      CATEGORIES.map(() => ({ v: 0, n: 0 }))
    );
    for (const p of rangeData) {
      const b = Math.min(BUCKETS - 1, Math.max(0, Math.floor((p.timestamp - t0) / bucketMs)));
      const ci = CATEGORIES.indexOf(p.category as (typeof CATEGORIES)[number]);
      if (ci >= 0) {
        const c = cells[b][ci];
        c.v += p.value;
        c.n++;
      }
    }
    return { t0, t1, cells };
  }, [rangeData]);

  const maxAvg = useMemo(() => {
    let m = 1;
    for (const col of grid.cells) for (const c of col) if (c.n > 0) m = Math.max(m, c.v / c.n);
    return m;
  }, [grid]);

  const { canvasRef } = useChartRenderer(
    ({ ctx, width, height }) => {
      const left = MARGIN.left;
      const right = width - MARGIN.right;
      const top = MARGIN.top;
      const bottom = height - MARGIN.bottom;
      const cellW = (right - left) / BUCKETS;
      const cellH = (bottom - top) / CATEGORIES.length;

      for (let b = 0; b < BUCKETS; b++) {
        for (let c = 0; c < CATEGORIES.length; c++) {
          const cell = grid.cells[b][c];
          const intensity = cell.n === 0 ? 0 : cell.v / cell.n / maxAvg;
          // dark slate -> cyan ramp
          const r = Math.round(15 + intensity * 56);
          const g = Math.round(23 + intensity * 189);
          const bl = Math.round(42 + intensity * 248);
          ctx.fillStyle = `rgb(${r},${g},${bl})`;
          ctx.fillRect(left + b * cellW, top + c * cellH, Math.ceil(cellW), Math.ceil(cellH) - 1);
        }
      }
    },

  );

  const plotH = Math.max(1, size.height - MARGIN.top - MARGIN.bottom);
  const rowH = plotH / CATEGORIES.length;

  return (
    <div ref={containerRef} className="relative h-full w-full select-none">
      <canvas ref={canvasRef} className="h-full w-full" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-[10px]">
        {size.height > 0 &&
          CATEGORIES.map((c, i) => (
            <text
              key={c}
              x={MARGIN.left - 6}
              y={MARGIN.top + rowH * (i + 0.5)}
              dy="0.32em"
              textAnchor="end"
              className="fill-slate-400 capitalize"
            >
              {c}
            </text>
          ))}
        {size.width > 0 && (
          <>
            <text x={MARGIN.left} y={size.height - 8} textAnchor="start" className="fill-slate-400">
              {formatTime(grid.t0)}
            </text>
            <text x={size.width - MARGIN.right} y={size.height - 8} textAnchor="end" className="fill-slate-400">
              {formatTime(grid.t1)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
