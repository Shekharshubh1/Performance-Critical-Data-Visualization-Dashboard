import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-100">Performance Dashboard Assignment</h1>
      <p className="max-w-lg text-sm text-slate-400">
        Real-time dashboard rendering 10,000+ data points with Canvas + SVG hybrid charts, built from
        scratch with Next.js App Router.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
      >
        Open dashboard →
      </Link>
    </main>
  );
}
