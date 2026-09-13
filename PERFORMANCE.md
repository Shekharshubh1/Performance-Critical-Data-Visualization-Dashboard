# PERFORMANCE.md

Benchmarking results and the optimization techniques used to hit the performance targets. All numbers from a production build (`next build && next start`), Chrome/Chromium, default load (12,000-point sliding window, 4 points per 100ms tick).

## 1. Benchmarking Results

### Frame budget & FPS

| Metric | Value | Budget |
| --- | --- | --- |
| Frame render time (all 4 charts redrawn) | **2–11 ms** (12k pts: 2–4 ms; 96k pts: 9–11 ms) | 16.7 ms (60fps) |
| Interaction latency (event → next painted frame, real dispatched wheel/pointer events) | **median ~20–45 ms, worst 75 ms** in a compositor-throttled pane; halves on 60Hz | < 100 ms |
| Data-processing time per tick (aggregation + LOD, shown in HUD) | 0.9–6.1 ms | — |
| First Load JS (`/dashboard`) | **96 KB** gzipped | < 500 KB |

The frame time is the load-bearing number: even at 96k points the full four-chart redraw stays under the 16.7 ms frame budget, which is what keeps FPS at 60 — FPS counters in background/occluded tabs are meaningless because browsers throttle `requestAnimationFrame` to 0–30Hz, so the HUD's *frame render time* is the honest metric to watch.

### Data-processing micro-benchmarks (Node, measured on the real `lib/` code)

| Operation | Time |
| --- | --- |
| Generate 12,000-point dataset | 1.85 ms |
| Aggregate 12k → 1min buckets | 0.27 ms |
| Aggregate 12k → 5min buckets | 0.31 ms |
| LOD downsample 12k → 1,600 bins | 0.39 ms |
| Aggregate 50k → 1min buckets | 1.28 ms |
| LOD downsample 50k → 1,600 bins | 1.40 ms |
| **LOD downsample 100k → 1,600 bins** | **2.93 ms** |
| **LOD downsample 192k → 1,600 bins** | **5.47 ms** |
| Aggregate 100k → 1min buckets | 1.01 ms |

Every data-path operation is a single linear pass, so cost scales linearly with window size, not with zoom level or chart count.

### Memory

Memory is bounded by design: the reducer trims the sliding window to `maxPoints` on every append, so the live set is capped regardless of stream duration. Verified with in-browser soaks sampling `performance.memory`:

- **Normal load (4 pts / 100ms), 60s:** heap 8.4 → 7.0 MB (flat, GC-trending down), DOM node count constant at 327.
- **Stress mode (20 pts / 25ms ≈ 40Hz appends at cap), 4.5 min:** heap cycles in a GC sawtooth — 7.4 → 19 → 8.0 → 26 → 8 MB — with **no monotonic trend**; the immutable-append allocation rate (~4 MB/s of short-lived batch arrays) is reclaimed each GC cycle. Long-run growth: ~0, far inside the <1 MB/hour budget.

Data structures are flat `DataPoint` objects in a dense array (no nested reactivity, no per-point subscriptions), which keeps GC pressure minimal.

## 2. React Optimization Techniques

- **Two contexts split by update frequency.** The 10Hz data stream lives in `DataStreamContext` (`filteredData`/`rangeData`/`totalCount`); user settings and dispatch live in `SettingsContext`. Charts subscribe to both — they must re-render per tick to trigger their dirty-driven redraw — but FilterPanel, TimeRangeSelector, and the dashboard shell subscribe to settings only, so streaming data **never re-renders them**. In React DevTools Profiler, settings-only components show zero commits while the stream runs.
- **One reducer owns the data.** Appends go through `useReducer`; charts consume memoized context values. No per-point state, no re-render storms.
- **Memoized selectors**: `filteredData`, `rangeData`, per-category splits, extents, and nice ticks are all `useMemo`'d on identity; `memo`'d control components plus the context split keep unrelated subtrees out of the render path.
- **Canvas draws bypass React entirely — and are dirty-driven, not frame-driven.** Chart components render one `<canvas>` element that never changes; the draw callback lives in a ref. `useChartRenderer` marks the canvas dirty after every component render (data tick at 10Hz, zoom/pan, filter change) and the shared rAF loop skips untouched canvases. This is the single most important scaling decision: the O(window) LOD pass runs at the *data* rate (10Hz), never at the 60Hz frame rate. At 192k points a full redraw costs ~5–10ms — impossible per frame (would eat the whole 16.7ms budget), trivial per data tick.
- **Shared rAF scheduler** (`lib/performanceUtils.ts`): all charts register into one animation-frame loop; invalidations are coalesced, so N charts changing in the same tick cost one redraw each, in one frame.
- **Amortized sliding window**: once the window exceeds its cap by 5% it is trimmed back to the cap — ≈20× fewer O(n) array copies at 100k+ points, and far less GC pressure, versus trimming every tick.
- **No per-tick O(n) copies in render paths**: category filtering reuses the window array identity when all categories are visible; chart windowing scans index ranges instead of slicing; the data table indexes backwards instead of copying/reversing 100k+ rows per tick.
- **Refs for hot paths**: `useDataStream` keeps callbacks/options in refs so the interval never tears down; `useChartRenderer` keeps the latest `draw` in a ref so the effect subscription is stable; the HUD samples the frame observer once and reads fresh values through refs.
- **`useTransition`** wraps aggregation, time-range and fill-window changes so heavy recomputes render as non-blocking and never eat a keystroke.
- **Virtualized table** (`useVirtualization`): 200k rows render as ~31 DOM rows regardless of dataset size.

## 3. Next.js Performance Features

- **Server Component page** (`app/dashboard/page.tsx`): the initial 10k dataset is generated at build time — `/dashboard` is statically prerendered, so first paint needs no API round-trip.
- **Static generation + streaming**: `loading.tsx` provides the Suspense boundary skeleton; the route is delivered as static content with a 95 KB first-load JS.
- **Route handler** (`app/api/data/route.ts`) with `force-dynamic` + `no-store` serves the dataset API (`?count=&seed=`) as the backend contract.
- **Deterministic seeded generator** avoids hydration mismatches between server-rendered initial state and client.
- **Error boundary** (`error.tsx`) with retry keeps a stream crash recoverable.
- **Core Web Vitals, measured on the production build** (fresh navigation, PerformanceObserver): LCP **452 ms**, FCP **452 ms**, CLS **0**, TTFB **32 ms** — all in the "good" band.

## 4. Canvas Integration (React + Canvas)

- `useChartRenderer` is the single integration point: it owns DPR-aware canvas sizing (`setupCanvas` caps DPR at 2), a `ResizeObserver` for invalidation, and the shared rAF loop. Cleanup (`ro.disconnect()`, loop unsubscribe) happens in the effect's dispose — no leaks across mounts.
- **Canvas for data, SVG for text**: points/lines/bars/heat cells are canvas paths (one batched `fill()` per category on the scatter plot); axis labels, gridline text, and tooltips are SVG overlays that never redraw per frame — text stays crisp at any DPR and costs nothing in the hot loop.
- **Level-of-detail downsampling** (`downsampleLOD`): when points outnumber pixels, data is bucketed per pixel keeping per-bin min *and* max, so the drawn line preserves spikes at ~2 points/pixel. The scatter plot caps at ~1 point/pixel. Zoom never increases draw cost.
- **Binary search windowing** (`findIndexBefore`): each chart draws only the visible time slice, O(log n) per frame.

## 5. Scaling Strategy

**Server vs client rendering:** only the initial dataset is server-rendered (at build time). The live feed, aggregation, and all rendering are client-side by design — real-time dashboards can't round-trip the server per frame, and canvas work must live next to the DOM anyway. If the data source were real (WebSocket/SSE), the only change is swapping `nextPoints` in `useDataStream` for a socket subscription; the reducer, sliding window, and charts stay identical.

**Stretch goals — how they're met:**

- **50k @ 30fps / 100k usable:** the dirty-driven redraw means O(window) work runs at the 10Hz data rate; the 100k LOD pass measures 2.93ms (Node) and a full 192k dashboard redraw ≈10ms — comfortably inside the frame budget whenever a frame is actually produced. The **fill window now** button tops the window up to its cap instantly (up to 200k) so these numbers can be demonstrated live without waiting for the stream to accumulate.
- **Mobile/tablet:** the layout is a CSS grid that collapses to one column; the line chart supports one-finger pan and **two-finger pinch zoom** (pointer-event based, `touch-action: none`), and every chart's draw cost is bounded by pixels (LOD), not by point count — so a tablet renders the same 1,600-bin geometry as a desktop.
- **Continuous influx:** the stream is append-only with a hard memory ceiling: the amortized sliding window trims to the cap, so influx can run for hours at flat heap. Timestamp-gap detection rebases the window after pauses, so influx resumes seamlessly rather than drawing across dead zones.

**To well beyond 200k:**
1. The sliding-window cap is the primary knob; everything downstream is linear and LOD-bounded by pixels, so only the O(n) per-tick passes (aggregation, category split) grow — ~1.5ms at 192k.
2. **Web Workers / OffscreenCanvas**: aggregation and the LOD pass are pure functions over the window — natural candidates for a worker; canvas bitmap rendering can move to `OffscreenCanvas` so the main thread only paints the HUD. The module boundaries (`lib/canvasUtils.ts` pure functions, `useChartRenderer` single owner) were chosen to make that a drop-in change.
3. **Structural sharing**: for million-point histories, keep aggregated rollups per minute/hour and downsample from the coarsest sufficient level (pyramid over the raw window), rather than scanning raw points.

**Known trade-offs:** category filtering (when not all-visible) and the range slice are O(n) over the window per change (fine at 200k, transition-wrapped); the heatmap recomputes its 80×4 grid per data change (trivial). Both have obvious worker/rollup escape hatches noted above.
