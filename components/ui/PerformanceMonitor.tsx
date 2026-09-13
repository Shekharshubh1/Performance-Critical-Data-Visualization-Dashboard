'use client';

import { memo } from 'react';
import { useDataWindow } from '@/components/providers/DataProvider';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { dataPerf } from '@/lib/performanceUtils';

function tone(good: boolean, warn: boolean) {
  return good ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-rose-400';
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${className ?? 'text-slate-200'}`}>{value}</div>
    </div>
  );
}

function PerformanceMonitorInner() {
  const { rangeData, totalCount } = useDataWindow();
  const metrics = usePerformanceMonitor(totalCount, dataPerf.aggregationMs + dataPerf.lodMs);

  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-lg shadow-black/20 sm:grid-cols-5">
      <Stat label="FPS" value={String(metrics.fps)} className={tone(metrics.fps >= 55, metrics.fps >= 30)} />
      <Stat
        label="Frame render"
        value={`${metrics.renderTime.toFixed(1)} ms`}
        className={tone(metrics.renderTime < 12, metrics.renderTime < 16.7)}
      />
      <Stat
        label="JS heap"
        value={metrics.memoryUsage > 0 ? `${metrics.memoryUsage.toFixed(1)} MB` : 'n/a'}
      />
      <Stat
        label="Data proc"
        value={`${metrics.dataProcessingTime.toFixed(1)} ms`}
        className={tone(metrics.dataProcessingTime < 12, metrics.dataProcessingTime < 16.7)}
      />
      <Stat label="Points" value={rangeData.length.toLocaleString()} />
    </div>
  );
}

export const PerformanceMonitor = memo(PerformanceMonitorInner);
export default PerformanceMonitor;
