'use client';

import type { DataContext } from '@/engine/context';
import { sizeInfo } from '@/engine/rules';

/**
 * Card compacto com dados de tamanho do personagem derivados de `race.size`
 * cruzado com `ctx.rules.sizes`. Somente leitura — `race.size` é a fonte
 * de verdade (definido em data/races/*.json).
 */
export function SizeInfo({
  ctx,
  raceSizeId
}: {
  ctx: DataContext;
  raceSizeId: string | null | undefined;
}) {
  const table = ctx.rules?.sizes;
  if (!table || !raceSizeId) return null;
  const info = sizeInfo(table, raceSizeId);
  if (!info) return null;

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 p-3 text-sm space-y-1 print:border-ink-100">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] sheet-muted">Tamanho</p>
        <p className="font-serif sheet-heading">{info.name}</p>
      </div>
      <ul className="grid grid-cols-3 gap-1 text-[11px] font-mono sheet-body">
        <li className="flex justify-between border border-ink-500 rounded px-1.5 py-0.5">
          <span className="sheet-muted">Espaço</span>
          <span className="sheet-accent">{info.spaceMeters}m</span>
        </li>
        <li className="flex justify-between border border-ink-500 rounded px-1.5 py-0.5">
          <span className="sheet-muted">Alcance</span>
          <span className="sheet-accent">{info.reachMeters}m</span>
        </li>
        <li className="flex justify-between border border-ink-500 rounded px-1.5 py-0.5">
          <span className="sheet-muted">Carga ×</span>
          <span className="sheet-accent">{info.carryMult}</span>
        </li>
        <li className="flex justify-between border border-ink-500 rounded px-1.5 py-0.5">
          <span className="sheet-muted">Ataque</span>
          <span className="sheet-accent">{formatMod(info.attackMod)}</span>
        </li>
        <li className="flex justify-between border border-ink-500 rounded px-1.5 py-0.5">
          <span className="sheet-muted">Furtiv.</span>
          <span className="sheet-accent">{formatMod(info.stealthMod)}</span>
        </li>
        <li className="flex justify-between border border-ink-500 rounded px-1.5 py-0.5">
          <span className="sheet-muted">Ordem</span>
          <span className="sheet-accent">{formatMod(info.order)}</span>
        </li>
      </ul>
      <p className="text-[10px] sheet-muted italic">
        Ataque/Furtiv. são diferenciais por categoria vs. alvo Médio. Aplicar de fato: ±1 por
        categoria de diferença entre atacante e alvo, clamp ±3.
      </p>
    </section>
  );
}

function formatMod(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : String(n);
}
