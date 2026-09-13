'use client';

import { memo } from 'react';
import { useDashboardSettings } from '@/components/providers/DataProvider';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/types';

/**
 * Category visibility filter + stream load controls (points per tick,
 * window size, stress mode). Memoized: it re-renders only on its own state.
 */
function FilterPanelInner() {
  const { running, pointsPerTick, maxPoints, stress, visibleCategories, dispatch } = useDashboardSettings();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Categories</h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => dispatch({ type: 'toggle-category', category: c })}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs capitalize transition-colors ${
                visibleCategories[c]
                  ? 'border-slate-600 bg-slate-800 text-slate-200'
                  : 'border-slate-800/60 bg-transparent text-slate-500 hover:text-slate-400'
              }`}
              aria-pressed={visibleCategories[c]}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: visibleCategories[c] ? CATEGORY_COLORS[c] : '#475569' }}
              />
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Load</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <button
            onClick={() =>
              dispatch({
                type: 'set-load',
                pointsPerTick: Math.max(1, Math.floor(pointsPerTick / 2)),
                maxPoints: maxPoints,
              })
            }
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            − points/tick
          </button>
          <span className="tabular-nums">{pointsPerTick}/tick</span>
          <button
            onClick={() =>
              dispatch({
                type: 'set-load',
                pointsPerTick: Math.min(512, pointsPerTick * 2),
                maxPoints: maxPoints,
              })
            }
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            + points/tick
          </button>
          <button
            onClick={() =>
              dispatch({
                type: 'set-load',
                pointsPerTick: pointsPerTick,
                maxPoints: Math.max(1_000, Math.floor(maxPoints / 2)),
              })
            }
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            window: {(maxPoints / 1000).toFixed(0)}k →{' '}
            {(Math.max(1_000, Math.floor(maxPoints / 2)) / 1000).toFixed(0)}k
          </button>
          <button
            onClick={() =>
              dispatch({
                type: 'set-load',
                pointsPerTick: pointsPerTick,
                maxPoints: Math.min(200_000, maxPoints * 2),
              })
            }
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            window: {(maxPoints / 1000).toFixed(0)}k → {(Math.min(200_000, maxPoints * 2) / 1000).toFixed(0)}k
          </button>
          <button
            onClick={() => dispatch({ type: 'fill' })}
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            fill window now
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: 'set-stress', stress: !stress })}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            stress
              ? 'bg-rose-600/90 text-white shadow-sm shadow-rose-900/40 hover:bg-rose-500 active:scale-[0.97]'
              : 'border border-slate-700/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70 focus-visible:outline focus-visible:ring-1 focus-visible:ring-sky-500/60'
          }`}
        >
          {stress ? 'Stress test ON' : 'Enable stress test'}
        </button>
        <button
          onClick={() => dispatch({ type: 'toggle-running' })}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          {running ? 'Pause stream' : 'Resume stream'}
        </button>
      </div>
      {stress && (
        <p className="text-[11px] text-rose-300">
          Stress mode: 5× points per tick at 4× frequency — watch the FPS counter.
        </p>
      )}
    </div>
  );
}

export const FilterPanel = memo(FilterPanelInner);
export default FilterPanel;
