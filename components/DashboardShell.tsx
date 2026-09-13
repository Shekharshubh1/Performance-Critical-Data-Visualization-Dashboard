'use client';

import { useRef } from 'react';
import { useDataStream } from '@/hooks/useDataStream';
import { useDashboardSettings } from '@/components/providers/DataProvider';
import type { DataPoint } from '@/lib/types';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import ScatterPlot from '@/components/charts/ScatterPlot';
import Heatmap from '@/components/charts/Heatmap';
import FilterPanel from '@/components/controls/FilterPanel';
import TimeRangeSelector from '@/components/controls/TimeRangeSelector';
import DataTable from '@/components/ui/DataTable';
import PerformanceMonitor from '@/components/ui/PerformanceMonitor';

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export default function DashboardShell() {
  const { running, intervalMs, pointsPerTick, stress, maxPoints, initialTail, appendBatch } = useDashboardSettings();

  // stable identity from the provider; seeds per-category stream continuity
  const tailRef = useRef<DataPoint[] | null>(null);
  if (tailRef.current === null) tailRef.current = initialTail;

  useDataStream({
    running,
    intervalMs,
    pointsPerTick,
    stress,
    tail: tailRef.current,
    onBatch: appendBatch,
  });

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Real-Time Performance Dashboard</h1>
          <p className="text-xs text-slate-500">
            Canvas + SVG hybrid · sliding window of {maxPoints.toLocaleString()} points · stream{' '}
            {running ? 'live' : 'paused'}
          </p>
        </div>
        <TimeRangeSelector />
      </header>

      <PerformanceMonitor />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Panel title="Line chart" hint="scroll = zoom · drag = pan · dblclick = reset" >
            <div className="h-64 sm:h-80">
              <LineChart />
            </div>
          </Panel>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel title="Bar chart" hint="avg value by category">
              <div className="h-48 sm:h-56">
                <BarChart />
              </div>
            </Panel>
            <Panel title="Scatter plot" hint="hover for tooltip">
              <div className="h-48 sm:h-56">
                <ScatterPlot />
              </div>
            </Panel>
          </div>
          <Panel title="Heatmap" hint="time × category intensity">
            <div className="h-40">
              <Heatmap />
            </div>
          </Panel>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <Panel title="Filters & load">
            <FilterPanel />
          </Panel>
          <Panel title="Data table" hint="virtualized, newest first" >
            <div className="h-[28rem] xl:h-[36rem]">
              <DataTable />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
