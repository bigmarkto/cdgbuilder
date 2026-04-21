/**
 * /wiki/c/new — criação de uma nova página community.
 *
 * Protegido por requireRole('EDITOR') antes de renderizar o form.
 * Query param `?canonicalRef=<section>/<id>` pré-preenche o campo — vem
 * do botão "Adicionar notas" mostrado em páginas canonical sem community
 * ainda (ver CommunityNotes empty state).
 */
import Link from 'next/link';
import { requireRole } from '@/lib/wiki/permissions';
import { PageForm } from '@/components/wiki/PageForm';
import { parseCanonicalRef } from '@/lib/wiki/canonicalRef';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nova página — CDG Wiki',
  robots: { index: false, follow: false }
};

export default async function NewPage({
  searchParams
}: {
  searchParams: { canonicalRef?: string };
}) {
  await requireRole('EDITOR');

  // Valida canonicalRef do query param — se inválido, ignora.
  const rawRef = searchParams.canonicalRef?.trim() ?? '';
  const parsedRef = rawRef ? parseCanonicalRef(rawRef) : null;
  const initialCanonicalRef = parsedRef ? `${parsedRef.section}/${parsedRef.id}` : null;

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
        <span className="text-ink-300">nova página</span>
      </nav>

      <h1 className="font-serif text-2xl text-ink-50 mb-1">Nova página</h1>
      <p className="text-xs text-ink-400 mb-6">
        Seu texto será publicado imediatamente e ficará editável pela comunidade.
        Toda edição gera uma revisão no histórico.
      </p>

      <PageForm
        mode="create"
        initial={
          initialCanonicalRef
            ? {
                title: '',
                slug: '',
                kind: 'ARTICLE',
                canonicalRef: initialCanonicalRef,
                body: null
              }
            : undefined
        }
      />
    </div>
  );
}
