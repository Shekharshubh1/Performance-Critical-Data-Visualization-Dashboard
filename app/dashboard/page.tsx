import { DataProvider } from '@/components/providers/DataProvider';
import DashboardShell from '@/components/DashboardShell';
import { generateDataset } from '@/lib/dataGenerator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Performance Dashboard',
};

// Initial dataset is static at build time: the page shell is prerendered and
// streams instantly, while the live feed is a pure client concern.
export default function DashboardPage() {
  const initialData = generateDataset({ count: 10_000 });
  return (
    <DataProvider initialData={initialData}>
      <DashboardShell />
    </DataProvider>
  );
}
