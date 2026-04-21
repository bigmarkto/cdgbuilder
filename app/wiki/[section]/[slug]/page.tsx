import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COLLECTIONS, COLLECTION_LABELS, type CollectionId } from '@/lib/types';
import { collectionSummary, loadEntity } from '@/lib/data';
import { EntityView } from '@/components/EntityView';
import { CommunityNotes } from '@/components/wiki/CommunityNotes';

export function generateStaticParams() {
  const params: Array<{ section: string; slug: string }> = [];
  for (const section of COLLECTIONS) {
    for (const item of collectionSummary(section)) {
      params.push({ section, slug: item.id });
    }
  }
  return params;
}

// Não force-static: a página precisa ir no banco buscar Community Notes.
// O shell da canonical entity é puro JSON (rápido); só o bloco community
// exige dynamic. generateStaticParams + dynamic = 'force-dynamic' é válido
// no Next 14 — ele gera params mas re-renderiza a cada request.
export const dynamic = 'force-dynamic';

export default function EntityPage({ params }: { params: { section: string; slug: string } }) {
  const section = params.section as CollectionId;
  if (!COLLECTIONS.includes(section)) notFound();

  const entity = loadEntity(section, params.slug);
  if (!entity) notFound();

  const canonicalRef = `${section}/${params.slug}`;

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
      {/* Server component assíncrono — se não houver página community correspondente,
          retorna null silenciosamente. */}
      <CommunityNotes canonicalRef={canonicalRef} />
    </div>
  );
}
