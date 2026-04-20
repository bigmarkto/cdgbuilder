import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COLLECTIONS, COLLECTION_LABELS, COLLECTION_BLURBS, type CollectionId } from '@/lib/types';
import { collectionSummary } from '@/lib/data';

export function generateStaticParams() {
  return COLLECTIONS.map((section) => ({ section }));
}

export default function SectionPage({ params }: { params: { section: string } }) {
  const section = params.section as CollectionId;
  if (!COLLECTIONS.includes(section)) notFound();

  const items = collectionSummary(section);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-ember-400 mb-1">Wiki</p>
      <h1 className="font-serif text-3xl text-ink-50 mb-2">{COLLECTION_LABELS[section]}</h1>
      <p className="text-ink-200 mb-6">{COLLECTION_BLURBS[section]}</p>
      {items.length === 0 ? (
        <p className="text-ink-300 italic">Sem entradas nesta seção ainda.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/wiki/${section}/${item.id}`} className="card">
                <div className="card-title">{item.name}</div>
                {item.description && (
                  <p className="text-sm text-ink-200 mt-1 line-clamp-3">
                    {truncate(item.description, 180)}
                  </p>
                )}
                {item.source && (
                  <p className="card-meta mt-2">{item.source}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, '') + '…';
}
