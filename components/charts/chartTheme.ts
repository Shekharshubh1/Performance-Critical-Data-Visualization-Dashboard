import type { DataPoint } from '@/lib/types';

export const MARGIN = { top: 12, right: 14, bottom: 26, left: 48 };

export function extent(data: DataPoint[], pick: (p: DataPoint) => number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of data) {
    const v = pick(p);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

export const GRID_COLOR = 'rgba(148,163,184,0.15)';
export const AXIS_COLOR = 'rgba(148,163,184,0.7)';
export const BG_COLOR = 'rgba(15,23,42,0.45)';
