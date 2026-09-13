'use client';

import { useEffect, useRef } from 'react';
import { DEFAULT_INTERVAL_MS, DEFAULT_TICK_POINTS, createStreamState, nextPoints } from '@/lib/dataGenerator';
import type { StreamState } from '@/lib/dataGenerator';
import type { DataPoint } from '@/lib/types';

const STALE_TAIL_MS = 5000;

export interface DataStreamOptions {
  running: boolean;
  intervalMs?: number;
  pointsPerTick?: number;
  stress?: boolean;
  /** Latest points at stream start; seeds per-category value continuity. */
  tail?: DataPoint[];
  onBatch: (points: DataPoint[]) => void;
}

/**
 * Simulates a live feed: every `intervalMs` a small batch of new points is
 * generated off the React render path and handed to `onBatch` (which typically
 * dispatches into the DataProvider reducer). The sliding window is trimmed by
 * the provider so memory stays flat.
 */
export function useDataStream({
  running,
  intervalMs = DEFAULT_INTERVAL_MS,
  pointsPerTick = DEFAULT_TICK_POINTS,
  stress = false,
  tail,
  onBatch,
}: DataStreamOptions) {
  // keep latest callbacks/options in refs so the interval is never torn down/recreated
  const onBatchRef = useRef(onBatch);
  onBatchRef.current = onBatch;
  const cfg = useRef({ intervalMs, pointsPerTick, stress });
  cfg.current = { intervalMs, pointsPerTick, stress };
  const tailRef = useRef(tail);
  tailRef.current = tail;
  const streamRef = useRef<StreamState | null>(null);

  useEffect(() => {
    if (!running) return;
    const tickMs = cfg.current.stress ? Math.max(16, cfg.current.intervalMs / 4) : cfg.current.intervalMs;
    const id = setInterval(() => {
      const { intervalMs, pointsPerTick, stress } = cfg.current;
      if (!streamRef.current) {
        streamRef.current = createStreamState(tailRef.current);
        const { lastTs } = streamRef.current;
        // Stale prerendered tail (page built earlier): anchor the stream at
        // "now" — the provider shifts the window across the gap on first append.
        if (lastTs && Date.now() - lastTs > STALE_TAIL_MS) streamRef.current.lastTs = 0;
      }
      const n = stress ? pointsPerTick * 5 : pointsPerTick;
      onBatchRef.current(nextPoints(streamRef.current, n, intervalMs));
    }, tickMs);
    return () => clearInterval(id);
  }, [running]);
}
