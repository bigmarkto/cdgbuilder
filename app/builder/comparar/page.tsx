/**
 * /builder/comparar — comparador de builds (2.3).
 *
 * Server component carrega o DataContext (igual /builder/sheet) e entrega pro
 * BuildComparator, que roda no cliente lendo o roster do localStorage.
 */
import Link from 'next/link';
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
import { BuildComparator } from '@/components/builder/BuildComparator';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Comparar Builds — CDG'
};

export default function CompararPage() {
  const system = loadSystem();
  const derived = loadDerived();
  const creation = loadCreation();
  const proficiencies = loadProficiencyIndex();

  if (!system || !derived || !creation || !proficiencies) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-serif text-3xl text-ink-50 mb-2">Comparador indisponível</h1>
        <p className="text-ink-300">Dados de sistema ausentes.</p>
      </div>
    );
  }

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/builder" className="hover:text-ember-400">
          Builder
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">Comparar</span>
      </nav>

      <h1 className="font-serif text-3xl text-ink-50 mb-1">Comparar builds</h1>
      <p className="text-ink-300 text-sm mb-6">
        Coloque duas das suas fichas lado a lado. O maior valor de cada linha fica destacado.
      </p>

      <BuildComparator ctx={ctx} />
    </div>
  );
}
