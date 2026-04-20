import Link from 'next/link';
import { COLLECTIONS, COLLECTION_LABELS, COLLECTION_BLURBS } from '@/lib/types';
import { collectionSummary } from '@/lib/data';

export default function Home() {
  const counts = Object.fromEntries(
    COLLECTIONS.map((c) => [c, collectionSummary(c).length] as const)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <section className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-ember-400 mb-2">RPG · Edição v0</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink-50 mb-3">Cicatrizes do Gatilho</h1>
        <p className="text-ink-200 max-w-2xl leading-relaxed">
          Builder de ficha e wiki interativa, construídos sobre a mesma base de dados que serve
          as regras do sistema. Cada mecânica do builder corresponde a uma página da wiki, e vice-versa.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/wiki" className="px-4 py-2 rounded border border-ember-400 text-ember-400 hover:bg-ember-400/10">
            Explorar a Wiki →
          </Link>
          <Link href="/builder" className="px-4 py-2 rounded border border-ink-600 text-ink-200 hover:bg-ink-800">
            Criar Personagem
          </Link>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl text-ink-100 mb-4">Índice do Sistema</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {COLLECTIONS.map((c) => (
            <li key={c}>
              <Link href={`/wiki/${c}`} className="card">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="card-title">{COLLECTION_LABELS[c]}</span>
                  <span className="card-meta">{counts[c]} itens</span>
                </div>
                <p className="text-sm text-ink-200 mt-1">{COLLECTION_BLURBS[c]}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
