import Link from 'next/link';
import { COLLECTIONS, COLLECTION_LABELS, COLLECTION_BLURBS } from '@/lib/types';
import { collectionSummary } from '@/lib/data';

export default function WikiIndex() {
  return (
    <div>
      <h1 className="font-serif text-3xl text-ink-50 mb-2">Wiki</h1>
      <p className="text-ink-200 mb-6">
        Cada seção abaixo lista entidades reais do sistema. Os mesmos dados alimentam o
        criador de personagem — quando uma regra muda aqui, muda lá.
      </p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {COLLECTIONS.map((c) => {
          const items = collectionSummary(c);
          return (
            <li key={c}>
              <Link href={`/wiki/${c}`} className="card">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="card-title">{COLLECTION_LABELS[c]}</span>
                  <span className="card-meta">{items.length}</span>
                </div>
                <p className="text-sm text-ink-200 mt-1">{COLLECTION_BLURBS[c]}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
