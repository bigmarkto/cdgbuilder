'use client';

import type { DataContext } from '@/engine/context';
import { computeAttributes, pointBuyStatus } from '@/engine/attributes';
import { pointBuyRules } from '@/engine/context';
import { ATTR_IDS } from '@/engine/character';
import { useBuilderStore } from '@/lib/store';

export function StepAtributos({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const setAttribute = useBuilderStore((s) => s.setAttribute);
  const resetAttributes = useBuilderStore((s) => s.resetAttributes);

  const rules = pointBuyRules(ctx);
  const status = pointBuyStatus(ctx, character);
  const attrs = computeAttributes(ctx, character);
  const system = ctx.system.attributes ?? [];

  const canIncrement = (id: string) => {
    const cur = character.attributesBase[id as keyof typeof character.attributesBase] ?? 0;
    const underMax = cur < (rules.maxPerAttributeBase ?? 6);
    const hasPts = status.remaining > 0;
    return underMax && hasPts;
  };
  const canDecrement = (id: string) => {
    const cur = character.attributesBase[id as keyof typeof character.attributesBase] ?? 0;
    return cur > (rules.minPerAttribute ?? 0);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-300">Point-buy:</span>
          <span className="font-mono text-ember-400">
            {status.spent} / {status.total}
          </span>
          <span className={`font-mono ${status.remaining === 0 ? 'text-ink-300' : status.remaining < 0 ? 'text-blood-400' : 'text-ember-400'}`}>
            ({status.remaining >= 0 ? `${status.remaining} restantes` : `${-status.remaining} excedidos`})
          </span>
        </div>
        <button
          onClick={resetAttributes}
          className="text-xs px-2 py-1 rounded border border-ink-600 text-ink-200 hover:bg-ink-800"
        >
          Zerar
        </button>
      </header>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {ATTR_IDS.map((id) => {
          const meta = system.find((a) => a.id === id);
          const breakdown = attrs[id];
          return (
            <li
              key={id}
              className="rounded border border-ink-700 bg-ink-900/60 p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">{meta?.group ?? ''}</p>
                <p className="font-serif text-ink-50 leading-tight">{id}</p>
                <p className="text-xs text-ink-300 truncate">{meta?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAttribute(id, breakdown.base - 1)}
                  disabled={!canDecrement(id)}
                  className="w-7 h-7 rounded border border-ink-600 text-ink-100 enabled:hover:bg-ink-800 disabled:opacity-30"
                >
                  −
                </button>
                <div className="text-center min-w-[2.5rem]">
                  <p className="font-mono text-xl text-ember-400 leading-none">{breakdown.total}</p>
                  <p className="text-[10px] text-ink-400 font-mono">
                    {breakdown.base}
                    {breakdown.racial !== 0 && ` ${breakdown.racial >= 0 ? '+' : ''}${breakdown.racial}`}
                  </p>
                </div>
                <button
                  onClick={() => setAttribute(id, breakdown.base + 1)}
                  disabled={!canIncrement(id)}
                  className="w-7 h-7 rounded border border-ink-600 text-ink-100 enabled:hover:bg-ink-800 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-400">
        {rules.totalPoints} pontos. Base 0–{rules.maxPerAttributeBase}. Bônus raciais somam depois.
        {rules.maxAbsoluteLevel1 != null && ` Teto absoluto no nível 1: ${rules.maxAbsoluteLevel1}.`}
      </p>
    </div>
  );
}
