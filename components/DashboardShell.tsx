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
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/70 shadow-lg shadow-black/20 transition-colors hover:border-slate-700/80">
      <header className="flex items-center gap-2.5 border-b border-slate-800/60 px-4 py-2.5">
        <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-sky-400 to-indigo-500" aria-hidden />
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
        {hint && <span className="ml-auto text-[10px] text-slate-500">{hint}</span>}
      </header>
      <div className="min-h-0 flex-1 p-3">{children}</div>
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
    <div className="relative min-h-screen">
      {/* ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_36rem_at_15%_-10%,rgba(56,189,248,0.07),transparent),radial-gradient(50rem_30rem_at_100%_0%,rgba(99,102,241,0.06),transparent)]"
      />
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:p-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 ring-1 ring-sky-500/30" aria-hidden>
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 13l4-5 3 3 4-6 5 8" />
                <path d="M2 17h16" />
              </svg>
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-slate-50 to-slate-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                Real-Time Performance Dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Canvas + SVG hybrid · sliding window of {maxPoints.toLocaleString()} points
              </p>
            </div>
            <span
              className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 ${
                stress
                  ? 'bg-rose-500/10 text-rose-300 ring-rose-500/40'
                  : running
                    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
              }`}
            >
              <span
                className={`inline-flex h-1.5 w-1.5 rounded-full ${stress ? 'bg-rose-400' : running ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />
              {stress ? 'stress' : running ? 'live' : 'paused'}
            </span>
          </div>
          <TimeRangeSelector />
        </header>

        <PerformanceMonitor />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <Panel title="Line chart" hint="scroll = zoom · drag = pan · dblclick = reset">
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
            <Panel title="Data table" hint="virtualized, newest first">
              <div className="h-[28rem] xl:h-[36rem]">
                <DataTable />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
