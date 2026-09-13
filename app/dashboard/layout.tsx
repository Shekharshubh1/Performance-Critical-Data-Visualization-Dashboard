export const metadata = {
  title: 'Performance Dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950">{children}</div>;
}
