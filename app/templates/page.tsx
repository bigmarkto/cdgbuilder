/**
 * /templates — biblioteca de builds publicadas pela comunidade (2.2).
 *
 * Destaques (featured, curados por mod) primeiro, depois mais recentes.
 * Cada card leva pra /templates/[id], onde dá pra "começar a partir de".
 */
import Link from 'next/link';
import { listTemplates } from '@/lib/builder/sharedRepo';
import { loadRaces } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Biblioteca de Templates — CDG',
  description: 'Builds prontas de Cicatrizes do Gatilho pra começar do zero mais fácil.'
};

export default async function TemplatesPage() {
  const [templates, races] = await Promise.all([
    listTemplates({ take: 60 }),
    Promise.resolve(loadRaces())
  ]);
  const raceName = (id: string | null) =>
    id ? races.find((r) => r.id === id)?.name ?? id : '—';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/" className="hover:text-ember-400">
          Início
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">Templates</span>
      </nav>

      <h1 className="font-serif text-3xl text-ink-50 mb-2">Biblioteca de Templates</h1>
      <p className="text-ink-200 mb-6 max-w-2xl">
        Builds publicadas pela comunidade. Abra uma e use{' '}
        <span className="text-ember-400">Começar a partir deste template</span> pra carregá-la
        no builder como uma nova ficha sua. Quer publicar a sua? Vá ao{' '}
        <Link href="/builder/sheet" className="text-ember-400 hover:underline">
          builder
        </Link>
        .
      </p>

      {templates.length === 0 ? (
        <div className="card">
          <p className="text-ink-300 text-sm">
            Ainda não há templates publicados. Seja o primeiro — monte uma build no builder e
            publique pela seção &quot;Biblioteca&quot; na ficha.
          </p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/templates/${t.id}`} className="card block h-full">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="card-title">{t.name}</span>
                  {t.featured && (
                    <span className="text-[10px] uppercase tracking-wider text-ember-400">
                      ★ destaque
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-400 mt-0.5">
                  {raceName(t.raceId)} · Nível {t.level}
                  {t.author.handle ? ` · @${t.author.handle}` : ''}
                </p>
                {t.summary && (
                  <p className="text-sm text-ink-200 mt-1.5 line-clamp-3">{t.summary}</p>
                )}
                {t.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-1 mt-2">
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
