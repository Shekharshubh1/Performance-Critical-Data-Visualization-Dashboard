export interface DataPoint {
  timestamp: number;
  value: number;
  category: string;
  metadata?: Record<string, unknown>;
}

export type ChartType = 'line' | 'bar' | 'scatter' | 'heatmap';

export interface ChartConfig {
  type: ChartType;
  dataKey: string;
  color: string;
  visible: boolean;
}

export type AggregationInterval = 'raw' | '1min' | '5min' | '1hour';

export interface TimeRange {
  start: number;
  end: number;
}

export type Viewport = TimeRange;

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number; // MB, 0 when unavailable
  renderTime: number; // ms, last frame
  dataProcessingTime: number; // ms, last aggregation
  pointCount: number;
}

export interface DatasetSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
}

export const CATEGORIES = ['alpha', 'beta', 'gamma', 'delta'] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  alpha: '#38bdf8',
  beta: '#f472b6',
  gamma: '#a3e635',
  delta: '#fbbf24',
};
