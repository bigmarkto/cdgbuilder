import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COLLECTIONS, COLLECTION_LABELS, type CollectionId } from '@/lib/types';
import { collectionSummary, loadEntity } from '@/lib/data';
import { EntityView } from '@/components/EntityView';

export function generateStaticParams() {
  const params: Array<{ section: string; slug: string }> = [];
  for (const section of COLLECTIONS) {
    for (const item of collectionSummary(section)) {
      params.push({ section, slug: item.id });
    }
  }
  return params;
}

export default function EntityPage({ params }: { params: { section: string; slug: string } }) {
  const section = params.section as CollectionId;
  if (!COLLECTIONS.includes(section)) notFound();

  const entity = loadEntity(section, params.slug);
  if (!entity) notFound();

  return (
    <div>
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/wiki" className="hover:text-ember-400">Wiki</Link>
        <span className="mx-2">/</span>
        <Link href={`/wiki/${section}`} className="hover:text-ember-400">
          {COLLECTION_LABELS[section]}
        </Link>
      </nav>
      <EntityView entity={entity as Parameters<typeof EntityView>[0]['entity']} />
    </div>
  );
}
