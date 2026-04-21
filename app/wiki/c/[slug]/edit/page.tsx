/**
 * /wiki/c/[slug]/edit — editar uma página community existente.
 *
 * Gate: requireRole('EDITOR'). Dentro, busca a página pela slug, carrega
 * o currentRevision.body como initial do form. Se a página está locked e
 * o usuário não é MOD+, a tela mostra aviso em vez do form.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/wiki/permissions';
import { PageForm } from '@/components/wiki/PageForm';
import { db } from '@/lib/db';
import type { DocNode } from '@/lib/wiki/doc';
import { isDoc } from '@/lib/wiki/doc';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false }
};

export default async function EditPage({ params }: { params: { slug: string } }) {
  const member = await requireRole('EDITOR');

  const page = await db.page.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      canonicalRef: true,
      locked: true,
      lockedReason: true,
      deletedAt: true,
      currentRevision: { select: { body: true } }
    }
  });
  if (!page || page.deletedAt) notFound();

  // Locked + não-staff = tela de aviso.
  const canOverrideLock = member.role === 'MODERATOR' || member.role === 'ADMIN';
  if (page.locked && !canOverrideLock) {
    return (
      <div>
        <nav className="text-xs text-ink-400 mb-4">
          <Link href="/wiki" className="hover:text-ember-400">Wiki</Link>
          <span className="mx-2">/</span>
          <Link href="/wiki/c" className="hover:text-ember-400">Comunidade</Link>
          <span className="mx-2">/</span>
          <Link href={`/wiki/c/${page.slug}`} className="hover:text-ember-400">{page.title}</Link>
        </nav>
        <div className="card border-blood-500/60">
          <h1 className="font-serif text-xl text-ink-50 mb-2">Página trancada</h1>
          <p className="text-ink-200 text-sm">
            Esta página foi trancada pela moderação e não pode ser editada no momento.
          </p>
          {page.lockedReason && (
            <p className="text-ink-300 text-sm mt-2 italic">Motivo: {page.lockedReason}</p>
          )}
        </div>
      </div>
    );
  }

  const body: DocNode | null = isDoc(page.currentRevision?.body)
    ? (page.currentRevision!.body as DocNode)
    : null;

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
        <span className="text-ink-300">editar</span>
      </nav>

      <h1 className="font-serif text-2xl text-ink-50 mb-1">Editando: {page.title}</h1>
      <p className="text-xs text-ink-400 mb-6">
        Suas mudanças criam uma nova revisão. O histórico é público e inclui seu nome.
      </p>

      <PageForm
        mode="edit"
        initial={{
          pageId: page.id,
          title: page.title,
          slug: page.slug,
          kind: page.kind,
          canonicalRef: page.canonicalRef,
          body
        }}
      />
    </div>
  );
}
