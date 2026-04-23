/**
 * /wiki/c/[slug]/compare?a=<revId>&b=<revId> — diff textual entre duas
 * revisões da mesma página.
 *
 * Aceita os params em qualquer ordem cronológica; internamente ordena
 * pra garantir que A = mais antiga, B = mais nova (convenção do diff:
 * "del" é o que saiu, "add" é o que entrou).
 *
 * Sem auth — qualquer leitor pode comparar. Os botões de restaurar só
 * aparecem pra EDITOR+ e a action re-verifica no server.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getCommunityPageBySlug,
  getRevisionById,
  displayAuthor
} from '@/lib/wiki/pageRepo';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';
import { docToLines } from '@/lib/wiki/docToLines';
import { diffLines, groupDiffChunks, diffStats } from '@/lib/wiki/diff';
import { RevisionDiff } from '@/components/wiki/RevisionDiff';
import { RevertButton } from '@/components/wiki/RevertButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

function formatDate(d: Date) {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function ComparePage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams: { a?: string; b?: string };
}) {
  const page = await getCommunityPageBySlug(params.slug);
  if (!page) notFound();

  const aId = searchParams.a?.trim();
  const bId = searchParams.b?.trim();

  // Sem params suficientes → volta pro histórico; não 404 pra não ser grosseiro.
  if (!aId || !bId) {
    return (
      <div>
        <Breadcrumbs slug={page.slug} title={page.title} />
        <p className="text-sm text-ink-300">
          Faltou escolher duas revisões pra comparar.{' '}
          <Link href={`/wiki/c/${page.slug}/history`} className="text-ember-400 hover:underline">
            Voltar ao histórico
          </Link>
        </p>
      </div>
    );
  }

  if (aId === bId) {
    return (
      <div>
        <Breadcrumbs slug={page.slug} title={page.title} />
        <p className="text-sm text-blood-300">
          Você selecionou a mesma revisão nos dois lados.{' '}
          <Link href={`/wiki/c/${page.slug}/history`} className="text-ember-400 hover:underline">
            Voltar ao histórico
          </Link>
        </p>
      </div>
    );
  }

  const [rawA, rawB, member] = await Promise.all([
    getRevisionById(aId),
    getRevisionById(bId),
    getCurrentMember()
  ]);

  if (
    !rawA ||
    !rawB ||
    rawA.page.slug !== params.slug ||
    rawB.page.slug !== params.slug ||
    rawA.page.deletedAt ||
    rawB.page.deletedAt
  ) {
    notFound();
  }

  // Ordena cronologicamente: older = A, newer = B. Diff fica intuitivo
  // (remoções mostram o que estava antes, adições mostram o que entrou).
  const older = rawA.createdAt <= rawB.createdAt ? rawA : rawB;
  const newer = older === rawA ? rawB : rawA;

  const linesA = docToLines(older.body);
  const linesB = docToLines(newer.body);
  const chunks = diffLines(linesA, linesB);
  const groups = groupDiffChunks(chunks);
  const stats = diffStats(chunks);

  const canEdit = member ? hasAtLeast(member.role, 'EDITOR') : false;
  const canEditLocked = page.locked
    ? Boolean(member && hasAtLeast(member.role, 'MODERATOR'))
    : true;
  const canRevert = canEdit && canEditLocked;

  const currentId = page.currentRevision?.id;
  const olderIsCurrent = older.id === currentId;
  const newerIsCurrent = newer.id === currentId;

  return (
    <div>
      <Breadcrumbs slug={page.slug} title={page.title} />

      <h1 className="font-serif text-2xl text-ink-50 mb-2">
        Comparar revisões — <span className="text-ink-200">{page.title}</span>
      </h1>
      <p className="text-xs text-ink-400 mb-6">
        <span className="text-emerald-400">+{stats.added}</span> linhas adicionadas
        {' · '}
        <span className="text-blood-400">−{stats.removed}</span> linhas removidas
        {' · '}
        <span>{stats.same}</span> sem mudança
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <RevisionCard
          label="A — versão mais antiga"
          rev={older}
          slug={page.slug}
          pageId={page.id}
          isCurrent={olderIsCurrent}
          canRevert={canRevert && !olderIsCurrent}
          accent="blood"
        />
        <RevisionCard
          label="B — versão mais nova"
          rev={newer}
          slug={page.slug}
          pageId={page.id}
          isCurrent={newerIsCurrent}
          canRevert={canRevert && !newerIsCurrent}
          accent="emerald"
        />
      </div>

      <RevisionDiff groups={groups} />

      <div className="mt-6 flex justify-between items-center text-xs text-ink-400">
        <Link
          href={`/wiki/c/${page.slug}/history`}
          className="hover:text-ember-400"
        >
          ← Voltar ao histórico
        </Link>
        <Link
          href={`/wiki/c/${page.slug}`}
          className="hover:text-ember-400"
        >
          Ver versão atual →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Breadcrumbs({ slug, title }: { slug: string; title: string }) {
  return (
    <nav className="text-xs text-ink-400 mb-4">
      <Link href="/wiki" className="hover:text-ember-400">
        Wiki
      </Link>
      <span className="mx-2">/</span>
      <Link href="/wiki/c" className="hover:text-ember-400">
        Comunidade
      </Link>
      <span className="mx-2">/</span>
      <Link href={`/wiki/c/${slug}`} className="hover:text-ember-400">
        {title}
      </Link>
      <span className="mx-2">/</span>
      <Link href={`/wiki/c/${slug}/history`} className="hover:text-ember-400">
        histórico
      </Link>
      <span className="mx-2">/</span>
      <span className="text-ink-300">comparar</span>
    </nav>
  );
}

interface RevisionCardProps {
  label: string;
  rev: {
    id: string;
    summary: string | null;
    createdAt: Date;
    author: { handle: string | null; name: string | null };
  };
  slug: string;
  pageId: string;
  isCurrent: boolean;
  canRevert: boolean;
  accent: 'emerald' | 'blood';
}

function RevisionCard({
  label,
  rev,
  slug,
  pageId,
  isCurrent,
  canRevert,
  accent
}: RevisionCardProps) {
  const borderAccent = accent === 'emerald' ? 'border-l-emerald-500' : 'border-l-blood-500';
  return (
    <div className={`card border-l-4 ${borderAccent}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-ink-400">
          {label}
        </span>
        {isCurrent && (
          <span className="text-[10px] uppercase tracking-wider text-ember-400">
            atual
          </span>
        )}
      </div>
      <p className="text-sm text-ink-200 mb-1">
        {rev.summary || <em className="text-ink-400">sem resumo</em>}
      </p>
      <p className="text-xs text-ink-400 mb-3">
        por {displayAuthor(rev.author)} · {formatDate(rev.createdAt)}
      </p>
      <div className="flex items-center gap-3 text-xs">
        <Link
          href={`/wiki/c/${slug}/history/${rev.id}`}
          className="text-ember-400 hover:underline"
        >
          ver conteúdo completo →
        </Link>
        {canRevert && (
          <RevertButton
            pageId={pageId}
            revisionId={rev.id}
            slug={slug}
            variant="ghost"
            label="restaurar esta"
          />
        )}
      </div>
    </div>
  );
}
