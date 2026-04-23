/**
 * /wiki/c/[slug]/history — lista de revisões de uma página community,
 * com seleção A/B pra comparar e botão de restaurar (EDITOR+).
 *
 * Form GET nativo submete pra /compare?a=<id>&b=<id>. Não precisa JS:
 * radios + submit HTML padrão. Pré-seleciona A = penúltima, B = atual
 * pra o primeiro clique já produzir diff útil.
 *
 * Botão "restaurar" é client component (<RevertButton>) porque precisa
 * de useTransition + confirm() + navegação após sucesso. Aparece só
 * pra EDITOR+ e só em revisões que NÃO são a atual.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCommunityPageBySlug, listRevisions, displayAuthor } from '@/lib/wiki/pageRepo';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';
import { RevertButton } from '@/components/wiki/RevertButton';

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

  const [revisions, member] = await Promise.all([
    listRevisions(page.id),
    getCurrentMember()
  ]);
  const currentId = page.currentRevision?.id;
  const canEdit = member ? hasAtLeast(member.role, 'EDITOR') : false;
  const canEditLocked = page.locked
    ? Boolean(member && hasAtLeast(member.role, 'MODERATOR'))
    : true;
  const canRevert = canEdit && canEditLocked;

  // Pré-seleção: B = atual (primeira do array, ordem desc), A = anterior.
  // Se só existe 1 revisão, a seção de compare nem aparece.
  const defaultB = revisions[0]?.id ?? '';
  const defaultA = revisions[1]?.id ?? '';
  const canCompare = revisions.length >= 2;

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
        {canCompare && ' Selecione A (antiga) e B (nova) e clique em Comparar.'}
      </p>

      <form
        action={`/wiki/c/${page.slug}/compare`}
        method="GET"
        className="space-y-2"
      >
        {canCompare && (
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded bg-ink-900/40 border border-ink-700">
            <span className="text-xs text-ink-400 uppercase tracking-wider">
              Comparar revisões
            </span>
            <button
              type="submit"
              className="px-3 py-1 rounded bg-ember-500 text-ink-950 text-xs font-medium hover:bg-ember-400"
            >
              Comparar selecionadas →
            </button>
          </div>
        )}

        <ol className="space-y-2">
          {revisions.map((rev) => {
            const isCurrent = rev.id === currentId;
            const status = STATUS_LABELS[rev.status] ?? { label: rev.status.toLowerCase(), cls: 'text-ink-400' };
            return (
              <li
                key={rev.id}
                className={`card flex items-start gap-3 ${isCurrent ? 'border-ember-500' : ''}`}
              >
                {canCompare && (
                  <div className="flex flex-col gap-1 pt-1 flex-shrink-0 w-10">
                    <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-400 cursor-pointer">
                      <input
                        type="radio"
                        name="a"
                        value={rev.id}
                        defaultChecked={rev.id === defaultA}
                        className="accent-blood-500"
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-400 cursor-pointer">
                      <input
                        type="radio"
                        name="b"
                        value={rev.id}
                        defaultChecked={rev.id === defaultB}
                        className="accent-emerald-500"
                      />
                      B
                    </label>
                  </div>
                )}

                <Link
                  href={`/wiki/c/${page.slug}/history/${rev.id}`}
                  className="flex-1 min-w-0 hover:text-ember-400"
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

                {canRevert && !isCurrent && (
                  <div className="flex-shrink-0">
                    <RevertButton
                      pageId={page.id}
                      revisionId={rev.id}
                      slug={page.slug}
                      variant="ghost"
                      label="restaurar"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </form>
    </div>
  );
}
