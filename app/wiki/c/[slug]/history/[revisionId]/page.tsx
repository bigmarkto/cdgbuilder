/**
 * /wiki/c/[slug]/history/[revisionId] — visualiza uma revisão específica.
 *
 * É basicamente o reader principal, mas com:
 *   • banner avisando que não é a versão atual
 *   • sem link de "editar"
 *   • metadata noindex (não queremos Google indexando revisões antigas)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRevisionById, getCommunityPageBySlug, displayAuthor } from '@/lib/wiki/pageRepo';
import { renderDoc } from '@/lib/wiki/renderDoc';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';
import { RevertButton } from '@/components/wiki/RevertButton';
import { RevisionModButton } from '@/components/wiki/RevisionModButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function RevisionView({
  params
}: {
  params: { slug: string; revisionId: string };
}) {
  const [rev, pageFull, member] = await Promise.all([
    getRevisionById(params.revisionId),
    // Precisamos de page.locked pra decidir se o rollback é permitido.
    getCommunityPageBySlug(params.slug),
    getCurrentMember()
  ]);
  if (!rev) notFound();
  // Verifica que a revisão realmente pertence à página do slug (proteção
  // contra IDs colados de páginas alheias).
  if (rev.page.slug !== params.slug) notFound();
  if (rev.page.deletedAt) notFound();

  const isCurrent = rev.page.currentRevisionId === rev.id;
  const isHidden = rev.status === 'HIDDEN';
  const canEdit = member ? hasAtLeast(member.role, 'EDITOR') : false;
  const canEditLocked = pageFull?.locked
    ? Boolean(member && hasAtLeast(member.role, 'MODERATOR'))
    : true;
  const canRevert = canEdit && canEditLocked && !isCurrent && !isHidden;
  const canModerate = member ? hasAtLeast(member.role, 'MODERATOR') : false;
  const html = renderDoc(rev.body);

  return (
    <article>
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/wiki" className="hover:text-ember-400">
          Wiki
        </Link>
        <span className="mx-2">/</span>
        <Link href="/wiki/c" className="hover:text-ember-400">
          Comunidade
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/wiki/c/${rev.page.slug}`} className="hover:text-ember-400">
          {rev.page.title}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/wiki/c/${rev.page.slug}/history`}
          className="hover:text-ember-400"
        >
          histórico
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">rev</span>
      </nav>

      {!isCurrent && !isHidden && (
        <div className="mb-4 px-3 py-2 rounded border border-ink-600 bg-ink-900/50 text-ink-300 text-sm flex items-center justify-between gap-3">
          <span>
            Você está vendo uma revisão antiga desta página.{' '}
            <Link
              href={`/wiki/c/${rev.page.slug}`}
              className="text-ember-400 hover:underline"
            >
              Ir pra versão atual →
            </Link>
          </span>
          {canRevert && (
            <RevertButton
              pageId={rev.page.id}
              revisionId={rev.id}
              slug={rev.page.slug}
              variant="primary"
              label="Restaurar esta versão"
            />
          )}
        </div>
      )}

      {isHidden && (
        <div className="mb-4 px-3 py-2 rounded border border-blood-500 bg-blood-500/10 text-blood-200 text-sm flex items-center justify-between gap-3">
          <span>Esta revisão foi ocultada pela moderação.</span>
          {canModerate && (
            <RevisionModButton revisionId={rev.id} hidden={true} />
          )}
        </div>
      )}

      <header className="mb-6 pb-4 border-b border-ink-700">
        <h1 className="font-serif text-2xl text-ink-50">{rev.page.title}</h1>
        <p className="mt-2 text-xs text-ink-400">
          Revisão por {displayAuthor(rev.author)}
          {' · '}
          {rev.createdAt.toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
          {rev.summary && (
            <>
              {' · '}
              <em className="text-ink-300">“{rev.summary}”</em>
            </>
          )}
        </p>
      </header>

      <div
        className="wiki-content prose-ink"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {canModerate && !isHidden && (
        <footer className="mt-8 pt-4 border-t border-ink-800 flex items-center justify-end">
          <RevisionModButton revisionId={rev.id} hidden={false} />
        </footer>
      )}
    </article>
  );
}
