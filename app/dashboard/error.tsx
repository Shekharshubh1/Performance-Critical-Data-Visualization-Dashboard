'use client';

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
      <h2 className="text-lg font-semibold text-slate-100">Something went wrong</h2>
      <p className="max-w-md text-sm text-slate-400">
        The dashboard hit an unexpected error while rendering. You can retry — the data stream will resume
        from the current window.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Try again
      </button>
    </div>
  );
}
