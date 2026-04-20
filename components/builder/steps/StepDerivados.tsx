'use client';

import type { DataContext } from '@/engine/context';
import { computeDerived } from '@/engine/derived';
import { useBuilderStore } from '@/lib/store';

export function StepDerivados({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const d = computeDerived(ctx, character);
  const entries: Array<[string, string | number, string]> = [
    ['HP máximo', d.HP_MAX, 'CON × 5 + 10'],
    ['DP', d.DP, '10 + AGI (+ armadura)'],
    ['Iniciativa', `+${d.INICIATIVA}`, 'AGI + PER'],
    ['Per. passiva', d.PER_PASSIVA, '10 + PER'],
    ['Movimento', `${d.MOVIMENTO}m`, 'racial'],
    ['Dado de Vida', d.hitDie ?? '—', 'racial'],
    ['Pool Energia Cósmica', d.POOL_ENERGIA_COSMICA, 'Maior atributo + nível'],
    ['Usos de Energia', d.USOS_ENERGIA, 'RES × 3'],
    ['Mana Arcana', d.MANA_ARCANA, '(INT + FOC) × 4 + nível × 2'],
    ['Mana Divina', d.MANA_DIVINA, '(FOC + PRE) × 4 + nível × 2'],
    ['Foco Corpo', d.FOCO_CORPO, '(max(POT,AGI) + RES) × 3 + nível × 2'],
    ['Foco Primal', d.FOCO_PRIMAL, '(PER + RES) × 3 + nível × 2'],
    ['Mana Magitech', d.MANA_MAGITECH, '(ENG + INT) × 3 + nível × 2'],
    ['Carga', d.CARGA, 'POT × 10'],
    ['Grimório', d.GRIMORIO, 'INT'],
    ['Espaços de Conjuração', d.ESPACOS_CONJURACAO, 'INT × 2']
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-300">
        Calculado automaticamente a partir dos atributos e raça. Só para conferência.
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(([label, value, formula]) => (
          <li key={label} className="rounded border border-ink-700 bg-ink-900/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">{label}</p>
            <p className="font-mono text-xl text-ember-400 leading-tight">{value}</p>
            <p className="text-[11px] text-ink-400 font-mono">{formula}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
