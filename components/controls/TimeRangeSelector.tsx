'use client';

import { memo } from 'react';
import { useDashboardSettings, type TimeRangePreset } from '@/components/providers/DataProvider';
import type { AggregationInterval } from '@/lib/types';

const PRESETS: TimeRangePreset[] = ['30s', '1m', '5m', 'all'];
const AGGREGATIONS: AggregationInterval[] = ['raw', '1min', '5min', '1hour'];

function TimeRangeSelectorInner() {
  const { aggregation, timeRangePreset, dispatch } = useDashboardSettings();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Range</span>
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => dispatch({ type: 'set-time-range', preset: p })}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              timeRangePreset === p
                ? 'bg-sky-600 text-white'
                : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {p === 'all' ? 'All' : p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Aggregate</span>
        {AGGREGATIONS.map((a) => (
          <button
            key={a}
            onClick={() => dispatch({ type: 'set-aggregation', aggregation: a })}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              aggregation === a
                ? 'bg-sky-600 text-white'
                : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {a === 'raw' ? 'Raw' : a}
          </button>
        ))}
      </div>
    </div>
  );
}

export const TimeRangeSelector = memo(TimeRangeSelectorInner);
export default TimeRangeSelector;
