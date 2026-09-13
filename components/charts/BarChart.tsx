'use client';

import { useMemo } from 'react';
import { useDataWindow } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { useElementSize } from '@/hooks/useElementSize';
import { niceTicks } from '@/lib/canvasUtils';
import { CATEGORY_COLORS } from '@/lib/types';
import { GRID_COLOR, MARGIN } from './chartTheme';

/**
 * Bar chart: value averaged per category over the selected window, drawn on
 * canvas; axis labels rendered as SVG at exact pixel positions.
 */
export default function BarChart() {
  const { rangeData } = useDataWindow();
  const [containerRef, size] = useElementSize<HTMLDivElement>();

  const sums = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const p of rangeData) {
      const e = m.get(p.category) ?? { sum: 0, n: 0 };
      e.sum += p.value;
      e.n++;
      m.set(p.category, e);
    }
    return [...m.entries()].map(([category, { sum, n }]) => ({
      category,
      value: sum / Math.max(1, n),
    }));
  }, [rangeData]);

  const yTicks = useMemo(() => niceTicks(0, Math.max(1, ...sums.map((s) => s.value)), 5), [sums]);

  const { canvasRef } = useChartRenderer(
    ({ ctx, width, height }) => {
      const left = MARGIN.left;
      const right = width - MARGIN.right;
      const top = MARGIN.top;
      const bottom = height - MARGIN.bottom;
      const plotH = bottom - top;
      const sy = plotH / (yTicks.max - yTicks.min || 1);

      ctx.strokeStyle = GRID_COLOR;
      for (const t of yTicks.ticks) {
        const y = bottom - (t - yTicks.min) * sy;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }

      const n = Math.max(1, sums.length);
      const slot = (right - left) / n;
      const barW = Math.min(64, slot * 0.6);
      sums.forEach((s, i) => {
        const cx = left + slot * (i + 0.5);
        const h = ((s.value - yTicks.min) * sy);
        ctx.fillStyle = CATEGORY_COLORS[s.category] ?? '#38bdf8';
        ctx.fillRect(cx - barW / 2, bottom - h, barW, Math.max(0, h));
      });
    },

  );

  const plotH = Math.max(1, size.height - MARGIN.top - MARGIN.bottom);
  const slotW = (size.width - MARGIN.left - MARGIN.right) / Math.max(1, sums.length);

  return (
    <div ref={containerRef} className="relative h-full w-full select-none">
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
                {t.toFixed(0)}
              </text>
            );
          })}
        {size.width > 0 &&
          sums.map((s, i) => (
            <text
              key={s.category}
              x={MARGIN.left + slotW * (i + 0.5)}
              y={size.height - 8}
              textAnchor="middle"
              className="fill-slate-300 capitalize"
            >
              {s.category} · {s.value.toFixed(1)}
            </text>
          ))}
      </svg>
    </div>
  );
}
