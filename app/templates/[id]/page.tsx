/**
 * /templates/[id] — detalhe de um template, read-only + "começar a partir de".
 *
 * Reaproveita SharedSheet (server) pra render. Mods veem controles de destaque/
 * ocultar inline e conseguem abrir templates ocultos (includeHidden).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  loadCreation,
  loadDerived,
  loadProficiencyIndex,
  loadProgression,
  loadRaces,
  loadSystem,
  loadTrees,
  loadVertentes
} from '@/lib/data';
import type { DataContext, ProgressionTable } from '@/engine/context';
import { getSharedById } from '@/lib/builder/sharedRepo';
import { coerceCharacter } from '@/lib/builder/coerce';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';
import { SharedSheet } from '@/components/builder/SharedSheet';
import { UseTemplateButton } from '@/components/builder/UseTemplateButton';
import { TemplateModControls } from '@/components/builder/TemplateModControls';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const t = await getSharedById(params.id);
  if (!t || t.kind !== 'TEMPLATE') return { title: 'Template não encontrado — CDG' };
  return {
    title: `${t.name} — Template CDG`,
    description: t.summary ?? t.concept ?? 'Template de build de Cicatrizes do Gatilho.'
  };
}

function authorLabel(a: { handle: string | null; name: string | null }) {
  if (a.handle) return `@${a.handle}`;
  if (a.name) return a.name;
  return 'anônimo';
}

export default async function TemplateDetailPage({ params }: { params: { id: string } }) {
  const member = await getCurrentMember();
  const canModerate = member ? hasAtLeast(member.role, 'MODERATOR') : false;

  const t = await getSharedById(params.id, { includeHidden: canModerate });
  if (!t || t.kind !== 'TEMPLATE') notFound();

  const system = loadSystem();
  const derived = loadDerived();
  const creation = loadCreation();
  const proficiencies = loadProficiencyIndex();
  if (!system || !derived || !creation || !proficiencies) notFound();

  const progression = loadProgression() as ProgressionTable | null;
  const trees = loadTrees();
  const vertentes = loadVertentes();

  const ctx: DataContext = {
    system,
    derived,
    creation,
    races: loadRaces(),
    proficiencies,
    ...(progression ? { progression } : {}),
    ...(trees.length > 0 ? { trees } : {}),
    ...(vertentes.length > 0 ? { vertentes } : {})
  };

  const character = coerceCharacter(t.data);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/" className="hover:text-ember-400">
          Início
        </Link>
        <span className="mx-2">/</span>
        <Link href="/templates" className="hover:text-ember-400">
          Templates
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">{t.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs text-ink-400">
          por <span className="text-ink-200">{authorLabel(t.author)}</span>
          {t.featured && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-ember-400">
              ★ destaque
            </span>
          )}
          {t.hiddenAt && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-blood-400">
              oculto
            </span>
          )}
        </p>
        {canModerate && (
          <TemplateModControls id={t.id} featured={t.featured} hidden={t.hiddenAt !== null} />
        )}
      </div>

      {t.summary && <p className="text-ink-200 mb-3">{t.summary}</p>}
      {t.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1 mb-4">
          {t.tags.map((tag) => (
            <li
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-300 border border-ink-700"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mb-5">
        <UseTemplateButton data={t.data} />
      </div>

      <SharedSheet ctx={ctx} character={character} />
    </div>
  );
}
