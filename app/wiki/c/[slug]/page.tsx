/**
 * /wiki/c/[slug] — leitor de página community.
 *
 * Renderiza o currentRevision.body (JSON ProseMirror) via renderDoc(), que
 * devolve HTML já sanitizado. Usamos dangerouslySetInnerHTML porque o
 * renderer é a única fonte de HTML e já aplicou escape + allowlist.
 *
 * Metadata dinâmico: title/description extraídos do próprio doc para OG tags.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCommunityPageBySlug, displayAuthor } from '@/lib/wiki/pageRepo';
import { renderDoc, extractPlaintext } from '@/lib/wiki/renderDoc';
import { getCurrentMember } from '@/lib/wiki/permissions';
import { hasAtLeast } from '@/lib/wiki/permissions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getCommunityPageBySlug(params.slug);
  if (!page) return { title: 'Página não encontrada — CDG Wiki' };
  const description = extractPlaintext(page.currentRevision?.body, 160);
  return {
    title: `${page.title} — CDG Wiki`,
    description: description || 'Página da comunidade CDG.'
  };
}

export default async function CommunityPageReader({
  params
}: {
  params: { slug: string };
}) {
  const [page, member] = await Promise.all([
    getCommunityPageBySlug(params.slug),
    getCurrentMember()
  ]);
  if (!page) notFound();

  const html = renderDoc(page.currentRevision?.body);
  const rev = page.currentRevision!;
  const canonicalLink = page.canonicalRef ? `/wiki/${page.canonicalRef}` : null;
  const canEdit = member ? hasAtLeast(member.role, 'EDITOR') : false;
  const canEditLocked = page.locked ? member && hasAtLeast(member.role, 'MODERATOR') : true;

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
        <span className="text-ink-300">{page.slug}</span>
      </nav>

      <header className="mb-6 pb-4 border-b border-ink-700">
        <h1 className="font-serif text-3xl text-ink-50">{page.title}</h1>
        <div className="mt-2 text-xs text-ink-400 flex flex-wrap gap-x-3 gap-y-1">
          <span>por {displayAuthor(rev.author)}</span>
          <span>
            atualizado em{' '}
            {rev.createdAt.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}
          </span>
          {page.locked && (
            <span className="text-blood-400" title={`Trancado pela moderação`}>
              trancado
            </span>
          )}
          {canonicalLink && (
            <span>
              extende{' '}
              <Link href={canonicalLink} className="text-ember-400 hover:underline">
                {page.canonicalRef}
              </Link>
            </span>
          )}
          <div className="ml-auto flex gap-3">
            {canEdit && canEditLocked && (
              <Link
                href={`/wiki/c/${page.slug}/edit`}
                className="text-ember-400 hover:underline"
              >
                editar
              </Link>
            )}
            <Link
              href={`/wiki/c/${page.slug}/history`}
              className="text-ink-300 hover:text-ember-400"
            >
              histórico →
            </Link>
          </div>
        </div>
      </header>

      <div
        className="wiki-content prose-ink"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <footer className="mt-10 pt-4 border-t border-ink-700 text-xs text-ink-400">
        Esta página foi escrita por um jogador. O conteúdo canônico do sistema
        está na{' '}
        <Link href="/wiki" className="text-ember-400 hover:underline">
          wiki oficial
        </Link>
        .
      </footer>
    </article>
  );
}
