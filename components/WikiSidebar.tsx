import Link from 'next/link';
import { COLLECTIONS, COLLECTION_LABELS, type CollectionId } from '@/lib/types';

export function WikiSidebar({ section, counts }: { section?: CollectionId; counts: Record<CollectionId, number> }) {
  return (
    <aside className="w-full md:w-56 shrink-0 md:sticky md:top-20 self-start">
      <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-ink-400 mb-2">Seções</p>
      <ul className="space-y-0.5">
        {COLLECTIONS.map((c) => (
          <li key={c}>
            <Link
              href={`/wiki/${c}`}
              className={[
                'sidebar-link flex justify-between',
                section === c ? 'sidebar-link-active' : ''
              ].join(' ')}
            >
              <span>{COLLECTION_LABELS[c]}</span>
              <span className="text-[10px] text-ink-400">{counts[c]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
