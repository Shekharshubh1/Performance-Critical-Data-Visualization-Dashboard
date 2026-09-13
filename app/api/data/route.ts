import { NextResponse } from 'next/server';
import { generateDataset, summarize } from '@/lib/dataGenerator';
import type { DataPoint } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/data?count=10000&window=all
 * Returns a generated dataset plus summary stats. Used for manual API checks
 * and as the contract a real backend would implement.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const count = Math.min(100_000, Math.max(1, Number(url.searchParams.get('count') ?? 10_000)));
  const seed = Number(url.searchParams.get('seed') ?? Date.now() % 100000);

  const data: DataPoint[] = generateDataset({ count, seed });
  return NextResponse.json(
    { summary: summarize(data), count: data.length, data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
