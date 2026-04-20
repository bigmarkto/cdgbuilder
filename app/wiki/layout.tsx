import { COLLECTIONS } from '@/lib/types';
import { collectionSummary } from '@/lib/data';
import { WikiSidebar } from '@/components/WikiSidebar';

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  const counts = Object.fromEntries(
    COLLECTIONS.map((c) => [c, collectionSummary(c).length] as const)
  ) as Record<(typeof COLLECTIONS)[number], number>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      <WikiSidebar counts={counts} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
