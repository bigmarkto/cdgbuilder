/**
 * /ficha/[id] — visualização pública (read-only) de uma ficha compartilhada.
 *
 * O id é o slug do SharedCharacter (kind SHARE). Carrega o DataContext do
 * sistema, coage o JSON salvo num Character e renderiza via SharedSheet
 * (server component + engine puro). Link "vivo": como é force-dynamic e
 * syncShare revalida este path, o leitor sempre pega a versão mais recente.
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
import { SharedSheet } from '@/components/builder/SharedSheet';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const shared = await getSharedById(params.id);
  if (!shared || shared.kind !== 'SHARE') {
    return { title: 'Ficha não encontrada — CDG', robots: { index: false } };
  }
  return {
    title: `${shared.name} — Ficha CDG`,
    description: shared.concept ?? 'Ficha de personagem compartilhada de Cicatrizes do Gatilho.',
    // Fichas compartilhadas são pessoais — não indexar.
    robots: { index: false, follow: false }
  };
}

function authorLabel(a: { handle: string | null; name: string | null }) {
  if (a.handle) return `@${a.handle}`;
  if (a.name) return a.name;
  return 'anônimo';
}

export default async function SharedCharacterPage({ params }: { params: { id: string } }) {
  const shared = await getSharedById(params.id);
  if (!shared || shared.kind !== 'SHARE') notFound();

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

  const character = coerceCharacter(shared.data);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/" className="hover:text-ember-400">
          Início
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">Ficha compartilhada</span>
      </nav>

      <p className="text-xs text-ink-400 mb-3">
        Compartilhada por{' '}
        <span className="text-ink-200">{authorLabel(shared.author)}</span> · atualizada em{' '}
        {shared.updatedAt.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })}
      </p>

      <SharedSheet ctx={ctx} character={character} />

      <footer className="mt-8 pt-4 border-t border-ink-700 text-center">
        <p className="text-sm text-ink-300 mb-3">
          Gostou? Monte a sua ficha de Cicatrizes do Gatilho.
        </p>
        <Link
          href="/builder"
          className="inline-block px-4 py-2 rounded border border-ember-400 text-ember-400 hover:bg-ember-400/10"
        >
          Abrir o Builder →
        </Link>
      </footer>
    </div>
  );
}
