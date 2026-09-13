export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500" />
        <p className="text-sm text-slate-400">Loading dashboard…</p>
      </div>
    </div>
  );
}
