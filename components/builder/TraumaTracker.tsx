'use client';

import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';
import { traumaStage, atBreakingPoint } from '@/engine/rules';

/**
 * Trilha de Trauma (Vale Desperto v2.0). Widget compacto com 5 pips (0..4)
 * + descrição dos efeitos do estágio atual. Escreve direto no store via
 * `setTrauma`/`adjustTrauma`.
 *
 * Renderiza `null` silenciosamente se `ctx.rules.trauma` não estiver carregado.
 */
export function TraumaTracker({ ctx }: { ctx: DataContext }) {
  const trauma = useBuilderStore((s) => s.character.trauma ?? 0);
  const setTrauma = useBuilderStore((s) => s.setTrauma);
  const adjustTrauma = useBuilderStore((s) => s.adjustTrauma);

  const table = ctx.rules?.trauma;
  if (!table) return null;

  const stage = traumaStage(table, trauma);
  const broken = atBreakingPoint(table, trauma);
  const max = Math.max(...table.track.map((s) => s.level));

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 p-3 text-sm space-y-2 print:hidden">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Trauma</p>
          <p className="font-serif text-base text-ink-50">{stage.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustTrauma(-1)}
            disabled={trauma <= 0}
            className="w-6 h-6 rounded border border-ink-700 text-ink-300 disabled:opacity-30 hover:text-ink-100"
            aria-label="Reduzir trauma"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => adjustTrauma(1)}
            disabled={trauma >= max}
            className="w-6 h-6 rounded border border-blood-400/60 text-blood-400 disabled:opacity-30 hover:bg-blood-400/10"
            aria-label="Aumentar trauma"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: max + 1 }, (_, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setTrauma(i)}
            aria-label={`Definir trauma nível ${i}`}
            className={[
              'h-2.5 flex-1 rounded transition-colors',
              i === 0
                ? 'bg-ink-700'
                : i <= trauma
                ? i >= max
                  ? 'bg-blood-400'
                  : 'bg-blood-400/70'
                : 'bg-ink-700',
              'hover:opacity-80 cursor-pointer'
            ].join(' ')}
          />
        ))}
      </div>

      {stage.effects && stage.effects.length > 0 && (
        <ul className="text-xs text-ink-200 space-y-0.5 pt-1">
          {stage.effects.map((e, i) => (
            <li key={i}>
              • {(e.text as string) ?? (e.type as string) ?? JSON.stringify(e)}
            </li>
          ))}
        </ul>
      )}

      {broken && (
        <p className="text-xs text-blood-300 italic border-t border-blood-400/30 pt-1">
          Próximo gatilho força rolagem na Tabela de Cicatrizes Psíquicas.
        </p>
      )}
    </section>
  );
}
