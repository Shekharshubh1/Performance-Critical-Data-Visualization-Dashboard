'use client';

import { memo } from 'react';
import { useDataWindow } from '@/components/providers/DataProvider';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { dataPerf } from '@/lib/performanceUtils';

function PerformanceMonitorInner() {
  const { rangeData, totalCount } = useDataWindow();
  const metrics = usePerformanceMonitor(totalCount, dataPerf.aggregationMs + dataPerf.lodMs);

  const fpsColor = metrics.fps >= 55 ? 'text-emerald-400' : metrics.fps >= 30 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs sm:grid-cols-5">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">FPS</div>
        <div className={`text-lg font-semibold tabular-nums ${fpsColor}`}>{metrics.fps}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Frame render</div>
        <div className="text-lg font-semibold tabular-nums text-slate-200">{metrics.renderTime.toFixed(1)} ms</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">JS heap</div>
        <div className="text-lg font-semibold tabular-nums text-slate-200">
          {metrics.memoryUsage > 0 ? `${metrics.memoryUsage.toFixed(1)} MB` : 'n/a'}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Data proc</div>
        <div className="text-lg font-semibold tabular-nums text-slate-200">
          {metrics.dataProcessingTime.toFixed(1)} ms
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Points</div>
        <div className="text-lg font-semibold tabular-nums text-slate-200">
          {rangeData.length.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export const PerformanceMonitor = memo(PerformanceMonitorInner);
export default PerformanceMonitor;
