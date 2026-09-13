'use client';

import { useDataWindow } from '@/components/providers/DataProvider';
import { useVirtualization } from '@/hooks/useVirtualization';
import { formatTime } from '@/lib/canvasUtils';
import { CATEGORY_COLORS } from '@/lib/types';
import type { DataPoint } from '@/lib/types';

const ROW_HEIGHT = 28;

/** Newest-first virtualized table; only the visible window of rows renders. */
export default function DataTable() {
  const { rangeData } = useDataWindow();
  const total = rangeData.length;

  // newest-first by index math — no per-tick copy/reverse of the whole window
  const rowAt = (i: number) => rangeData[total - 1 - i];

  const { startIndex, endIndex, totalHeight, offsetY, onScroll } = useVirtualization(total, {
    rowHeight: ROW_HEIGHT,
    overscan: 8,
  });

  const visible: DataPoint[] = [];
  for (let i = startIndex; i < endIndex; i++) visible.push(rowAt(i));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-800/80">
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_1fr_1fr] border-b border-slate-800 bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Timestamp</span>
        <span>Category</span>
        <span className="text-right">Value</span>
      </div>
      <div className="scroll-slim flex-1 overflow-auto" onScroll={onScroll}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visible.map((p, i) => (
              <div
                key={`${p.timestamp}-${startIndex + i}`}
                className={`grid grid-cols-[1fr_1fr_1fr] items-center px-3 tabular-nums hover:bg-sky-500/5 ${(startIndex + i) % 2 ? "bg-slate-950/40" : ""}`}
                style={{ height: ROW_HEIGHT }}
              >
                <span className="text-xs text-slate-400">{formatTime(p.timestamp)}</span>
                <span className="flex items-center gap-1.5 text-xs capitalize text-slate-300">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[p.category] ?? '#64748b' }}
                  />
                  {p.category}
                </span>
                <span className="text-right text-xs text-slate-200">{p.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800/80 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-500">
        {total.toLocaleString()} rows · rendering {visible.length} (virtualized)
      </div>
    </div>
  );
}
