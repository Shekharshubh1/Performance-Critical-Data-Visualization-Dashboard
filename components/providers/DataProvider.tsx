'use client';

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useTransition,
  useCallback,
  type ReactNode,
} from 'react';
import { DEFAULT_INTERVAL_MS, DEFAULT_MAX_POINTS, DEFAULT_TICK_POINTS, generateDataset } from '@/lib/dataGenerator';
import { CATEGORIES } from '@/lib/types';
import type { AggregationInterval, DataPoint, TimeRange } from '@/lib/types';

export type TimeRangePreset = '30s' | '1m' | '5m' | 'all';

interface DashboardState {
  data: DataPoint[];
  running: boolean;
  intervalMs: number;
  pointsPerTick: number;
  maxPoints: number;
  stress: boolean;
  visibleCategories: Record<string, boolean>;
  aggregation: AggregationInterval;
  timeRangePreset: TimeRangePreset;
  /** line/scatter zoom viewport (absolute timestamps), null = fit */
  viewport: TimeRange | null;
  version: number;
}

type Action =
  | { type: 'append'; points: DataPoint[] }
  | { type: 'set'; data: DataPoint[] }
  | { type: 'fill' }
  | { type: 'toggle-running' }
  | { type: 'set-running'; running: boolean }
  | { type: 'set-load'; pointsPerTick: number; maxPoints: number }
  | { type: 'set-interval'; intervalMs: number }
  | { type: 'set-stress'; stress: boolean }
  | { type: 'toggle-category'; category: string }
  | { type: 'set-aggregation'; aggregation: AggregationInterval }
  | { type: 'set-time-range'; preset: TimeRangePreset }
  | { type: 'set-viewport'; viewport: TimeRange | null };

const TRIM_HEADROOM = 1.05;

/**
 * Sliding-window trim, amortized: copying a 100k+ array on every 100ms tick
 * would dominate the frame budget and churn GC, so we only trim once the
 * window exceeds the cap by 5% (≈20× fewer copies).
 */
function trimSlidingWindow(data: DataPoint[], maxPoints: number): DataPoint[] {
  if (data.length < maxPoints * TRIM_HEADROOM) return data;
  return data.slice(data.length - maxPoints);
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'append': {
      if (action.points.length === 0) return state;
      let data = state.data;
      const pts = action.points;
      const last = data[data.length - 1];
      if (last) {
        // The static prerender bakes build-time timestamps and a paused stream
        // leaves a hole. Shift the whole window forward so the live feed
        // continues seamlessly from "now" instead of drawing across a dead zone.
        const gap = pts[0].timestamp - last.timestamp;
        if (gap > state.intervalMs * 20) {
          data = data.map((p) => ({ ...p, timestamp: p.timestamp + gap }));
        }
      }
      return { ...state, data: trimSlidingWindow(data.concat(pts), state.maxPoints), version: state.version + 1 };
    }
    case 'set':
      return { ...state, data: action.data, version: state.version + 1 };
    case 'fill': {
      // stress-test helper: regenerate the window as one dense dataset ending
      // at the current stream position, so large-N performance (50k/100k+) can
      // be demonstrated without waiting minutes. The live feed continues
      // seamlessly from the same tail timestamp.
      const last = state.data[state.data.length - 1];
      if (state.data.length >= state.maxPoints || !last) return state;
      const data = generateDataset({
        count: state.maxPoints,
        endTs: last.timestamp,
        intervalMs: state.intervalMs,
      });
      return { ...state, data, version: state.version + 1 };
    }
    case 'toggle-running':
      return { ...state, running: !state.running };
    case 'set-running':
      return { ...state, running: action.running };
    case 'set-load': {
      // shrinking the cap takes effect immediately, not on the next append
      const data =
        state.data.length > action.maxPoints
          ? state.data.slice(state.data.length - action.maxPoints)
          : state.data;
      return { ...state, pointsPerTick: action.pointsPerTick, maxPoints: action.maxPoints, data };
    }
    case 'set-interval':
      return { ...state, intervalMs: action.intervalMs };
    case 'set-stress':
      return { ...state, stress: action.stress };
    case 'toggle-category':
      return {
        ...state,
        visibleCategories: { ...state.visibleCategories, [action.category]: !state.visibleCategories[action.category] },
      };
    case 'set-aggregation':
      return { ...state, aggregation: action.aggregation };
    case 'set-time-range':
      return { ...state, timeRangePreset: action.preset, viewport: null };
    case 'set-viewport':
      return { ...state, viewport: action.viewport, version: state.version + 1 };
    default:
      return state;
  }
}

/**
 * Two contexts, split by update frequency, so the 10Hz data stream never
 * re-renders components that only read settings (FilterPanel, the shell,
 * TimeRangeSelector). Charts subscribe to both — they must re-render per tick
 * to trigger their dirty-driven canvas redraw.
 */
export interface DataStreamValue {
  /** category-filtered, raw chronological order */
  filteredData: DataPoint[];
  /** filtered data constrained to the selected time range */
  rangeData: DataPoint[];
  /** full window size (before category filtering) */
  totalCount: number;
}

export interface SettingsValue {
  running: boolean;
  intervalMs: number;
  pointsPerTick: number;
  maxPoints: number;
  stress: boolean;
  visibleCategories: Record<string, boolean>;
  aggregation: AggregationInterval;
  timeRangePreset: TimeRangePreset;
  viewport: TimeRange | null;
  /** last points of the initial dataset; seeds per-category stream continuity */
  initialTail: DataPoint[];
  appendBatch: (points: DataPoint[]) => void;
  dispatch: React.Dispatch<Action>;
  isPending: boolean;
}

const DataStreamContext = createContext<DataStreamValue | null>(null);
const SettingsContext = createContext<SettingsValue | null>(null);

const PRESET_MS: Record<TimeRangePreset, number> = {
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
  all: Infinity,
};

export function DataProvider({
  initialData,
  children,
}: {
  initialData: DataPoint[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    data: initialData,
    running: true,
    intervalMs: DEFAULT_INTERVAL_MS,
    pointsPerTick: DEFAULT_TICK_POINTS,
    maxPoints: DEFAULT_MAX_POINTS,
    stress: false,
    visibleCategories: Object.fromEntries(CATEGORIES.map((c) => [c, true])),
    aggregation: 'raw',
    timeRangePreset: 'all',
    viewport: null,
    version: 0,
  } satisfies DashboardState);

  const [isPending, startTransition] = useTransition();

  const initialTail = useMemo(() => initialData.slice(-8), [initialData]);

  const appendBatch = useCallback((points: DataPoint[]) => {
    dispatch({ type: 'append', points });
  }, []);

  const filteredData = useMemo<DataPoint[]>(() => {
    // common case: everything visible — skip the O(n) filter entirely and
    // reuse the window array identity (avoids a fresh 100k array per tick)
    if (CATEGORIES.every((c) => state.visibleCategories[c] !== false)) return state.data;
    return state.data.filter((p) => state.visibleCategories[p.category] !== false);
  }, [state.data, state.visibleCategories]);

  const rangeData = useMemo(() => {
    if (state.timeRangePreset === 'all') return filteredData;
    const span = PRESET_MS[state.timeRangePreset];
    const end = filteredData.length ? filteredData[filteredData.length - 1].timestamp : Date.now();
    const cutoff = end - span;
    // data is chronological; find first index past cutoff (linear from end is fine
    // because the live tail dominates the scan)
    let start = filteredData.length;
    while (start > 0 && filteredData[start - 1].timestamp >= cutoff) start--;
    return start === 0 ? filteredData : filteredData.slice(start);
  }, [filteredData, state.timeRangePreset]);

  // aggregation / time-range switches are wrapped in a transition so heavy
  // recomputes never block input
  const transitionalDispatch = useCallback(
    (action: Action) => {
      if (action.type === 'set-aggregation' || action.type === 'set-time-range' || action.type === 'fill') {
        startTransition(() => dispatch(action));
      } else {
        dispatch(action);
      }
    },
    []
  );

  const dataValue = useMemo<DataStreamValue>(
    () => ({ filteredData, rangeData, totalCount: state.data.length }),
    [filteredData, rangeData, state.data.length]
  );

  const settingsValue = useMemo<SettingsValue>(
    () => ({
      running: state.running,
      intervalMs: state.intervalMs,
      pointsPerTick: state.pointsPerTick,
      maxPoints: state.maxPoints,
      stress: state.stress,
      visibleCategories: state.visibleCategories,
      aggregation: state.aggregation,
      timeRangePreset: state.timeRangePreset,
      viewport: state.viewport,
      initialTail,
      appendBatch,
      dispatch: transitionalDispatch,
      isPending,
    }),
    [
      state.running,
      state.intervalMs,
      state.pointsPerTick,
      state.maxPoints,
      state.stress,
      state.visibleCategories,
      state.aggregation,
      state.timeRangePreset,
      state.viewport,
      initialTail,
      appendBatch,
      transitionalDispatch,
      isPending,
    ]
  );

  return (
    <DataStreamContext.Provider value={dataValue}>
      <SettingsContext.Provider value={settingsValue}>{children}</SettingsContext.Provider>
    </DataStreamContext.Provider>
  );
}

/** High-frequency data window: changes at the stream rate (~10Hz). */
export function useDataWindow(): DataStreamValue {
  const ctx = useContext(DataStreamContext);
  if (!ctx) throw new Error('useDataWindow must be used inside <DataProvider>');
  return ctx;
}

/** Low-frequency settings + dispatch: changes only on user interaction. */
export function useDashboardSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useDashboardSettings must be used inside <DataProvider>');
  return ctx;
}
