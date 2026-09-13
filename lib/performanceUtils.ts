/**
 * Minimal rAF scheduler: batches render requests so multiple charts
 * on screen share a single animation frame callback each frame.
 */
type FrameCallback = (now: number) => void;

const callbacks = new Set<FrameCallback>();
let rafPending = false;
const frameTimes: number[] = [];
let onFrame: ((fps: number, frameTime: number) => void) | null = null;

export function setFrameObserver(fn: ((fps: number, frameTime: number) => void) | null) {
  onFrame = fn;
}

function loop(now: number) {
  rafPending = false;
  const t0 = performance.now();
  for (const cb of callbacks) cb(now);
  const dt = performance.now() - t0;

  frameTimes.push(now);
  while (frameTimes.length > 0 && now - frameTimes[0] > 1000) frameTimes.shift();
  const fps = frameTimes.length > 1 ? (frameTimes.length - 1) : 0;
  onFrame?.(fps, dt);

  // exactly one rAF in flight at any time, regardless of subscribe/unsubscribe races
  if (callbacks.size > 0 && !rafPending) {
    rafPending = true;
    requestAnimationFrame(loop);
  }
}

export function scheduleFrame(cb: FrameCallback): () => void {
  callbacks.add(cb);
  if (!rafPending && typeof window !== 'undefined') {
    rafPending = true;
    requestAnimationFrame(loop);
  }
  return () => {
    callbacks.delete(cb);
  };
}

/** Throttles a function to at most once per `ms`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: unknown[] | null = null;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      (fn as (...a: unknown[]) => void)(...args);
    } else {
      pending = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          if (pending) (fn as (...a: unknown[]) => void)(...pending);
          pending = null;
        }, ms - (now - last));
      }
    }
  }) as unknown as T;
}

/** Returns true roughly once per `ms` — for cheap in-loop checks. */
export function everyNth(ms: number): () => boolean {
  let last = 0;
  return () => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      return true;
    }
    return false;
  };
}

/**
 * Live data-processing timings (ms), written by the hot paths that perform
 * O(window) work and read by the performance HUD at its 2Hz sample rate.
 */
export const dataPerf = {
  /** last aggregation pass (1min/5min/1hour modes) */
  aggregationMs: 0,
  /** last LOD downsampling pass across charts */
  lodMs: 0,
};
