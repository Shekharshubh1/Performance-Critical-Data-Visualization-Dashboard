'use client';

import { useEffect, useRef, useState } from 'react';
import { setFrameObserver } from '@/lib/performanceUtils';
import type { PerformanceMetrics } from '@/lib/types';

interface MemoryInfo {
  usedJSHeapSize: number;
}

/**
 * Samples FPS + JS heap usage. Metrics update at 2Hz so the HUD itself
 * never contributes to render pressure.
 */
export function usePerformanceMonitor(pointCount: number, dataProcessingTime: number) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryUsage: 0,
    renderTime: 0,
    dataProcessingTime: 0,
    pointCount,
  });

  // latest values via refs: the frame observer subscribes exactly once, so
  // per-tick data changes never resubscribe it
  const latest = useRef({ pointCount, dataProcessingTime });
  latest.current = { pointCount, dataProcessingTime };

  useEffect(() => {
    let last = 0;
    setFrameObserver((fps, frameTime) => {
      const now = Date.now();
      if (now - last < 500) return;
      last = now;
      const mem = (performance as Performance & { memory?: MemoryInfo }).memory;
      setMetrics({
        fps,
        memoryUsage: mem ? mem.usedJSHeapSize / 1048576 : 0,
        renderTime: frameTime,
        dataProcessingTime: latest.current.dataProcessingTime,
        pointCount: latest.current.pointCount,
      });
    });
    return () => setFrameObserver(null);
  }, []);

  return metrics;
}
