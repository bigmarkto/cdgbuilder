/**
 * /stats — estatísticas globais anonimizadas (2.6).
 *
 * Agrega sobre tudo que foi tornado público (fichas compartilhadas + templates),
 * em contagens anônimas. Sem coletar nada às escondidas: só aparece aqui o que
 * o jogador escolheu publicar.
 *
 * Gráficos são barras CSS puras — sem dependência de lib de chart.
 */
import Link from 'next/link';
import { aggregateStats } from '@/lib/builder/sharedRepo';
import { loadRaces, loadSystem } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Estatísticas — CDG',
  description: 'Raças, níveis e atributos mais usados nas fichas públicas de Cicatrizes do Gatilho.'
};

export default async function StatsPage() {
  const stats = await aggregateStats();
  const races = loadRaces();
  const system = loadSystem();
  const attrMeta = system?.attributes ?? [];

  const raceName = (id: string | null) =>
    id ? races.find((r) => r.id === id)?.name ?? id : 'Sem raça';
  const attrName = (id: string) => attrMeta.find((a) => a.id === id)?.name ?? id;

  const maxRace = Math.max(1, ...stats.byRace.map((r) => r.count));
  const maxLevel = Math.max(1, ...stats.byLevel.map((l) => l.count));
  const maxAttr = Math.max(1, ...stats.avgAttributes.map((a) => a.avg));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/" className="hover:text-ember-400">
          Início
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">Estatísticas</span>
      </nav>

      <h1 className="font-serif text-3xl text-ink-50 mb-2">Estatísticas da comunidade</h1>
      <p className="text-ink-200 mb-1 max-w-2xl">
        Agregado anônimo de{' '}
        <strong className="text-ink-50">{stats.total}</strong>{' '}
        ficha(s) pública(s) — compartilhadas ou publicadas como template.
      </p>
      <p className="text-xs text-ink-500 mb-6">
        Só entra aqui o que foi tornado público no builder. Nada é coletado em segundo plano.
      </p>

      {stats.total === 0 ? (
        <div className="card">
          <p className="text-ink-300 text-sm">
            Ainda não há fichas públicas suficientes. Compartilhe uma ficha ou publique um
            template no{' '}
            <Link href="/builder/sheet" className="text-ember-400 hover:underline">
              builder
            </Link>{' '}
            pra alimentar as estatísticas.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <StatBlock title="Raças mais usadas">
            {stats.byRace.map((r) => (
              <Bar
                key={r.raceId ?? 'none'}
                label={raceName(r.raceId)}
                value={r.count}
                max={maxRace}
                display={`${r.count}`}
              />
            ))}
          </StatBlock>

          <StatBlock title="Distribuição de nível">
            {stats.byLevel.map((l) => (
              <Bar
                key={l.level}
                label={`Nível ${l.level}`}
                value={l.count}
                max={maxLevel}
                display={`${l.count}`}
              />
            ))}
          </StatBlock>

          <StatBlock
            title="Atributo médio (point-buy)"
            note={`Média entre ${stats.attributeSample} ficha(s) com atributos.`}
          >
            {stats.avgAttributes.map((a) => (
              <Bar
                key={a.attr}
                label={attrName(a.attr)}
                value={a.avg}
                max={maxAttr}
                display={a.avg.toFixed(1)}
              />
            ))}
          </StatBlock>
        </div>
      )}
    </div>
  );
}

function StatBlock({
  title,
  note,
  children
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-xl text-ink-50 mb-1">{title}</h2>
      {note && <p className="text-xs text-ink-500 mb-2">{note}</p>}
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Bar({
  label,
  value,
  max,
  display
}: {
  label: string;
  value: number;
  max: number;
  display: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-ink-200 text-right">{label}</span>
      <div className="flex-1 h-5 rounded bg-ink-800/60 overflow-hidden">
        <div
          className="h-full bg-ember-500/70 rounded-r transition-[width]"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <span className="w-10 shrink-0 font-mono text-xs text-ink-300">{display}</span>
    </div>
  );
}
