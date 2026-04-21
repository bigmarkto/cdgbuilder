/**
 * CommunityNotes — bloco injetado ao final das páginas canonical do wiki.
 *
 * Três estados:
 *   1. Existe Page community com canonicalRef=<ref> e currentRevision
 *      → renderiza o conteúdo + link pra página completa.
 *   2. Não existe, mas usuário tem role EDITOR+ → mostra CTA "Adicionar
 *      notas da comunidade" linkando pra /wiki/c/new?canonicalRef=<ref>.
 *   3. Não existe e usuário não pode editar → retorna null (invisível).
 *
 * Faz duas queries Prisma (page + current user) em paralelo via Promise.all.
 */
import Link from 'next/link';
import { getCommunityPageByCanonicalRef, displayAuthor } from '@/lib/wiki/pageRepo';
import { renderDoc } from '@/lib/wiki/renderDoc';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';

export async function CommunityNotes({ canonicalRef }: { canonicalRef: string }) {
  const [page, member] = await Promise.all([
    getCommunityPageByCanonicalRef(canonicalRef),
    getCurrentMember()
  ]);
  const canEdit = member ? hasAtLeast(member.role, 'EDITOR') : false;

  // Sem página: só mostra CTA pra quem pode editar, senão nada.
  if (!page) {
    if (!canEdit) return null;
    return (
      <section className="mt-10 pt-6 border-t border-dashed border-ink-700">
        <div className="card border-dashed bg-ink-900/30">
          <p className="text-sm text-ink-300 mb-2">
            Ainda não há notas da comunidade para esta página. Que tal começar?
          </p>
          <Link
            href={`/wiki/c/new?canonicalRef=${encodeURIComponent(canonicalRef)}`}
            className="inline-block px-3 py-1.5 rounded bg-ember-500 text-ink-950 text-sm font-medium hover:bg-ember-400"
          >
            + Adicionar notas
          </Link>
        </div>
      </section>
    );
  }

  const rev = page.currentRevision!;
  const html = renderDoc(rev.body);

  return (
    <section className="mt-10 pt-6 border-t border-dashed border-ink-700">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-ink-50">Notas da comunidade</h2>
        <div className="flex gap-3 text-xs">
          {canEdit && !page.locked && (
            <Link
              href={`/wiki/c/${page.slug}/edit`}
              className="text-ember-400 hover:underline"
            >
              editar
            </Link>
          )}
          <Link
            href={`/wiki/c/${page.slug}`}
            className="text-ember-400 hover:underline"
          >
            ver página completa →
          </Link>
        </div>
      </header>

      <p className="text-xs text-ink-400 mb-4">
        Escrito por {displayAuthor(rev.author)}
        {' · '}
        atualizado em{' '}
        {rev.createdAt.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })}
      </p>

      <div
        className="wiki-content prose-ink"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
