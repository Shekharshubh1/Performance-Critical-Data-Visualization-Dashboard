import { CATEGORIES } from './types';
import type { DataPoint, DatasetSummary } from './types';

/**
 * Deterministic pseudo-random generator so server-rendered initial data
 * matches what a client hydration pass would expect.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_INTERVAL_MS = 100;
export const DEFAULT_TICK_POINTS = 4; // points appended per 100ms tick
export const DEFAULT_MAX_POINTS = 12_000; // sliding window cap

export interface GeneratorOptions {
  count: number;
  endTs?: number;
  intervalMs?: number;
  seed?: number;
  startValue?: number;
}

/** Generates a realistic random-walk time series across categories. */
export function generateDataset({
  count,
  endTs = Date.now(),
  intervalMs = DEFAULT_INTERVAL_MS,
  seed = 42,
  startValue = 50,
}: GeneratorOptions): DataPoint[] {
  const rand = mulberry32(seed);
  const points: DataPoint[] = new Array(count);
  const values = new Map<string, number>();
  for (const c of CATEGORIES) values.set(c, startValue + rand() * 20);

  for (let i = 0; i < count; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    // random walk with mean reversion + occasional spikes
    const prev = values.get(category)!;
    const drift = (startValue - prev) * 0.01;
    const noise = (rand() - 0.5) * 2.2;
    const spike = rand() < 0.004 ? (rand() - 0.5) * 40 : 0;
    const value = Math.max(0, prev + drift + noise + spike);
    values.set(category, value);
    points[count - 1 - i] = {
      timestamp: endTs - i * intervalMs,
      value: Math.round(value * 100) / 100,
      category,
    };
  }
  return points;
}

/** Persistent stream state so per-category values continue the random walk across ticks. */
export interface StreamState {
  values: Map<string, number>;
  lastTs: number;
  rand: () => number;
}

/** Seeds each category from its latest value in `tail` (build-time prerender or previous run). */
export function createStreamState(tail: DataPoint[] | undefined): StreamState {
  const values = new Map<string, number>();
  if (tail) {
    for (let i = tail.length - 1; i >= 0 && values.size < CATEGORIES.length; i--) {
      const p = tail[i];
      if (!values.has(p.category)) values.set(p.category, p.value);
    }
  }
  for (const c of CATEGORIES) if (!values.has(c)) values.set(c, 50 + Math.random() * 20);
  return {
    values,
    lastTs: tail?.length ? tail[tail.length - 1].timestamp : 0,
    rand: mulberry32((Math.random() * 2 ** 31) >>> 0),
  };
}

/** Generates the next `n` points, continuing the walk from the stream state. */
export function nextPoints(state: StreamState, n: number, intervalMs = DEFAULT_INTERVAL_MS): DataPoint[] {
  const step = intervalMs / n;
  const out: DataPoint[] = [];
  let ts = state.lastTs === 0 ? Date.now() - intervalMs : state.lastTs;
  for (let i = 0; i < n; i++) {
    ts += step;
    const category = CATEGORIES[Math.floor(state.rand() * CATEGORIES.length)];
    const prev = state.values.get(category)!;
    const value = Math.max(0, prev + (50 - prev) * 0.01 + (state.rand() - 0.5) * 2.2);
    state.values.set(category, value);
    out.push({ timestamp: Math.round(ts), value: Math.round(value * 100) / 100, category });
  }
  state.lastTs = ts;
  return out;
}

export function summarize(data: DataPoint[]): DatasetSummary {
  if (data.length === 0) return { count: 0, min: 0, max: 0, avg: 0 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const p of data) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
    sum += p.value;
  }
  return { count: data.length, min, max, avg: sum / data.length };
}
