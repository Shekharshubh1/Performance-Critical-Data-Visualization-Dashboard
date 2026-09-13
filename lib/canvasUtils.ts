import type { DataPoint, AggregationInterval } from './types';

export const AGGREGATION_MS: Record<Exclude<AggregationInterval, 'raw'>, number> = {
  '1min': 60_000,
  '5min': 300_000,
  '1hour': 3_600_000,
};

export interface Scale {
  /** value -> pixel */
  x: (t: number) => number;
  y: (v: number) => number;
}

export function makeScale(
  d: { x0: number; x1: number; y0: number; y1: number },
  r: { left: number; right: number; top: number; bottom: number }
): Scale {
  const sx = (r.right - r.left) / (d.x1 - d.x0 || 1);
  const sy = (r.bottom - r.top) / (d.y1 - d.y0 || 1);
  return {
    x: (t: number) => r.left + (t - d.x0) * sx,
    y: (v: number) => r.bottom - (v - d.y0) * sy,
  };
}

/** Configures a canvas for device pixel ratio and returns its 2d context. */
export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Binary search: index of last point with timestamp <= t (-1 if none). */
export function findIndexBefore(data: DataPoint[], t: number): number {
  let lo = 0;
  let hi = data.length - 1;
  let res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].timestamp <= t) {
      res = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return res;
}

/**
 * Level-of-detail downsampling: when there are more points than pixels,
 * reduce to per-pixel bins keeping per-bin min AND max so the shape (spikes
 * included) is preserved. `i0`/`i1` bound the scan so callers never have to
 * slice-copy the visible window.
 */
export function downsampleLOD(
  data: DataPoint[],
  start: number,
  end: number,
  targetBins: number,
  i0 = 0,
  i1 = data.length - 1
): DataPoint[] {
  if (i1 - i0 + 1 <= targetBins || targetBins < 2) return data.slice(i0, i1 + 1);
  const binMs = (end - start) / targetBins;
  // keep both min & max per bin for line fidelity
  const mins: (DataPoint | null)[] = new Array(targetBins).fill(null);
  const maxs: (DataPoint | null)[] = new Array(targetBins).fill(null);
  for (let i = i0; i <= i1; i++) {
    const p = data[i];
    if (p.timestamp < start || p.timestamp > end) continue;
    const bin = Math.min(targetBins - 1, Math.max(0, Math.floor((p.timestamp - start) / binMs)));
    const mn = mins[bin];
    const mx = maxs[bin];
    if (!mn || p.value < mn.value) mins[bin] = p;
    if (!mx || p.value > mx.value) maxs[bin] = p;
  }
  const out: DataPoint[] = [];
  for (let b = 0; b < targetBins; b++) {
    const mn = mins[b];
    const mx = maxs[b];
    if (!mn && !mx) continue;
    if (mn === mx || !mx) out.push(mn!);
    else if (!mn) out.push(mx);
    else {
      out.push(mn);
      out.push(mx);
    }
  }
  return out;
}

/** Groups points into fixed time buckets, aggregating each bucket's value. */
export function aggregate(
  data: DataPoint[],
  interval: Exclude<AggregationInterval, 'raw'>,
  mode: 'avg' | 'sum' = 'avg'
): DataPoint[] {
  const ms = AGGREGATION_MS[interval];
  const out: DataPoint[] = [];
  let bucketStart = NaN;
  let sum = 0;
  let n = 0;
  for (const p of data) {
    const b = Math.floor(p.timestamp / ms) * ms;
    if (b !== bucketStart) {
      if (n > 0) {
        out.push({ timestamp: bucketStart, value: mode === 'avg' ? sum / n : sum, category: 'agg' });
      }
      bucketStart = b;
      sum = 0;
      n = 0;
    }
    sum += p.value;
    n++;
  }
  if (n > 0) out.push({ timestamp: bucketStart, value: mode === 'avg' ? sum / n : sum, category: 'agg' });
  return out;
}

export interface NiceTicksResult {
  ticks: number[];
  min: number;
  max: number;
}

/** "Nice" axis ticks for a value range. */
export function niceTicks(min: number, max: number, count = 5): NiceTicksResult {
  if (!isFinite(min) || !isFinite(max) || min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = (span / count) / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const niceStep = step * mult;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + niceStep * 0.5; t += niceStep) ticks.push(t);
  return { ticks, min: niceMin, max: niceMax };
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatBytes(mb: number): string {
  return `${mb.toFixed(1)} MB`;
}
