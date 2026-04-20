'use client';

import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';

export function StepRaca({ ctx }: { ctx: DataContext }) {
  const raceId = useBuilderStore((s) => s.character.raceId);
  const subtypeId = useBuilderStore((s) => s.character.subtypeId);
  const setRace = useBuilderStore((s) => s.setRace);
  const setSubtype = useBuilderStore((s) => s.setSubtype);

  const selected = ctx.races.find((r) => r.id === raceId) ?? null;

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ctx.races.map((r) => {
          const active = r.id === raceId;
          return (
            <li key={r.id}>
              <button
                onClick={() => setRace(r.id, null)}
                className={`w-full text-left rounded border p-2.5 transition-colors ${
                  active
                    ? 'border-ember-400 bg-ember-400/10'
                    : 'border-ink-700 bg-ink-800/60 hover:border-ink-500'
                }`}
              >
                <p className="font-serif text-ink-50">{r.name}</p>
                <p className="text-[11px] text-ink-300 uppercase tracking-wider">
                  {formatBonus(r.attributeBonus?.values)} · {r.hitDie ?? '—'}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <section className="rounded border border-ink-700 bg-ink-900/60 p-4 space-y-3">
          <header>
            <h3 className="font-serif text-xl text-ember-400">{selected.name}</h3>
            {selected.description && (
              <p className="text-sm text-ink-200 mt-1">{selected.description}</p>
            )}
          </header>

          {selected.traits && selected.traits.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">Traços</p>
              <ul className="text-sm text-ink-100 space-y-1">
                {selected.traits.map((t) => (
                  <li key={t.id}>
                    <span className="text-ink-50 font-medium">{t.name}:</span>{' '}
                    <span className="text-ink-200">{t.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.weaknesses && selected.weaknesses.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-blood-400 mb-1">Fraquezas</p>
              <ul className="text-sm text-ink-100 space-y-1">
                {selected.weaknesses.map((w) => (
                  <li key={w.id}>
                    <span className="text-ink-50 font-medium">{w.name}:</span>{' '}
                    <span className="text-ink-200">{w.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.subtypes && selected.subtypes.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">Subtipo</p>
              <div className="flex flex-wrap gap-2">
                {selected.subtypes.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSubtype(subtypeId === st.id ? null : st.id)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      subtypeId === st.id
                        ? 'border-ember-400 text-ember-400 bg-ember-400/10'
                        : 'border-ink-600 text-ink-200 hover:border-ink-400'
                    }`}
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function formatBonus(values: Partial<Record<string, number>> | undefined): string {
  if (!values) return 'sem bônus';
  const entries = Object.entries(values).filter(([, v]) => typeof v === 'number') as Array<[string, number]>;
  if (entries.length === 0) return 'sem bônus';
  return entries.map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ');
}
