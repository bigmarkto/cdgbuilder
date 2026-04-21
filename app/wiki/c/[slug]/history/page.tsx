/**
 * /wiki/c/[slug]/history — lista de revisões de uma página community.
 *
 * Só visualização. Rollback/diff visual vem na Fase 4.
 * A revisão atual é marcada visualmente; clicando em qualquer uma leva
 * pra /wiki/c/[slug]/history/[revisionId] que mostra o conteúdo daquela versão.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCommunityPageBySlug, listRevisions, displayAuthor } from '@/lib/wiki/pageRepo';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'publicada', cls: 'text-ember-400' },
  DRAFT: { label: 'rascunho', cls: 'text-ink-400' },
  REVERTED: { label: 'revertida', cls: 'text-blood-400' },
  HIDDEN: { label: 'oculta', cls: 'text-blood-500' }
};

export default async function HistoryPage({
  params
}: {
  params: { slug: string };
}) {
  const page = await getCommunityPageBySlug(params.slug);
  if (!page) notFound();

  const revisions = await listRevisions(page.id);
  const currentId = page.currentRevision?.id;

  return (
    <div>
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/wiki" className="hover:text-ember-400">
          Wiki
        </Link>
        <span className="mx-2">/</span>
        <Link href="/wiki/c" className="hover:text-ember-400">
          Comunidade
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/wiki/c/${page.slug}`} className="hover:text-ember-400">
          {page.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">histórico</span>
      </nav>

      <h1 className="font-serif text-2xl text-ink-50 mb-4">
        Histórico — <span className="text-ink-200">{page.title}</span>
      </h1>

      <p className="text-xs text-ink-400 mb-6">
        {revisions.length} revisão{revisions.length === 1 ? '' : 'ões'} registrada
        {revisions.length === 1 ? '' : 's'}.
      </p>

      <ol className="space-y-2">
        {revisions.map((rev) => {
          const isCurrent = rev.id === currentId;
          const status = STATUS_LABELS[rev.status] ?? { label: rev.status.toLowerCase(), cls: 'text-ink-400' };
          return (
            <li key={rev.id}>
              <Link
                href={`/wiki/c/${page.slug}/history/${rev.id}`}
                className={`card block ${isCurrent ? 'border-ember-500' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-200 text-sm">
                    {rev.summary || <em className="text-ink-400">sem resumo</em>}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider ${status.cls}`}>
                    {isCurrent ? 'atual' : status.label}
                  </span>
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  por {displayAuthor(rev.author)}
                  {' · '}
                  {rev.createdAt.toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
