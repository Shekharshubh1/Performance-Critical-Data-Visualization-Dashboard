'use client';

import { useMemo } from 'react';
import { aggregate, AGGREGATION_MS } from '@/lib/canvasUtils';
import { dataPerf } from '@/lib/performanceUtils';
import type { AggregationInterval, DataPoint } from '@/lib/types';

/**
 * Aggregation memoized on (data identity, interval). Data arrives in a new
 * array on every append, so this recomputes at stream rate — which is fine,
 * aggregation is a single linear pass (measured in PERFORMANCE.md). The pass
 * duration is recorded for the HUD's "data proc" metric.
 */
export function useMemoizedAggregation(data: DataPoint[], interval: AggregationInterval): DataPoint[] {
  return useMemo(() => {
    if (interval === 'raw') return data;
    const t0 = performance.now();
    const result = aggregate(data, interval as Exclude<AggregationInterval, 'raw'>);
    dataPerf.aggregationMs = performance.now() - t0;
    return result;
  }, [data, interval]);
}

export { AGGREGATION_MS };
