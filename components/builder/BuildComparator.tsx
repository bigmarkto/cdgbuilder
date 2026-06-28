'use client';

/**
 * BuildComparator — compara duas fichas do roster lado a lado (2.3).
 *
 * Client puro: lê o roster do store (localStorage), deixa escolher A e B em
 * dropdowns e roda o engine (atributos/derivados/XP) pra cada uma. Cada linha
 * destaca o maior valor — ajuda a decidir entre caminhos de build.
 */

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import type { DataContext } from '@/engine/context';
import type { Character } from '@/engine/character';
import { ATTR_IDS } from '@/engine/character';
import { computeAttributes } from '@/engine/attributes';
import { computeDerived } from '@/engine/derived';
import { computeXP } from '@/engine/xp';
import { findRace } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';

interface Metric {
  label: string;
  a: number;
  b: number;
  /** Pra valores onde maior nem sempre é "melhor" (none aqui), desabilita o destaque. */
  neutral?: boolean;
}
interface MetricGroup {
  title: string;
  metrics: Metric[];
}

function buildMetrics(ctx: DataContext, a: Character, b: Character): MetricGroup[] {
  const aa = computeAttributes(ctx, a);
  const ba = computeAttributes(ctx, b);
  const ad = computeDerived(ctx, a);
  const bd = computeDerived(ctx, b);
  const ax = computeXP(ctx, a);
  const bx = computeXP(ctx, b);

  const sysAttrs = ctx.system.attributes ?? [];
  const attrName = (id: string) => sysAttrs.find((x) => x.id === id)?.name ?? id;

  const count = (c: Character, rec?: Record<string, number>) =>
    Object.values(rec ?? {}).filter((v) => v > 0).length;

  return [
    {
      title: 'Atributos',
      metrics: ATTR_IDS.map((id) => ({
        label: attrName(id),
        a: aa[id].total,
        b: ba[id].total
      }))
    },
    {
      title: 'Combate & Derivados',
      metrics: [
        { label: 'HP', a: ad.HP_MAX, b: bd.HP_MAX },
        { label: 'DP', a: ad.DP, b: bd.DP },
        { label: 'Iniciativa', a: ad.INICIATIVA, b: bd.INICIATIVA },
        { label: 'Per. Passiva', a: ad.PER_PASSIVA, b: bd.PER_PASSIVA },
        { label: 'Movimento', a: ad.MOVIMENTO, b: bd.MOVIMENTO },
        { label: 'Carga', a: ad.CARGA, b: bd.CARGA }
      ]
    },
    {
      title: 'Recursos',
      metrics: [
        { label: 'Pool Cósmica', a: ad.POOL_ENERGIA_COSMICA, b: bd.POOL_ENERGIA_COSMICA },
        { label: 'Mana Arcana', a: ad.MANA_ARCANA, b: bd.MANA_ARCANA },
        { label: 'Mana Divina', a: ad.MANA_DIVINA, b: bd.MANA_DIVINA },
        { label: 'Mana Magitech', a: ad.MANA_MAGITECH, b: bd.MANA_MAGITECH },
        { label: 'Foco Corpo', a: ad.FOCO_CORPO, b: bd.FOCO_CORPO },
        { label: 'Foco Primal', a: ad.FOCO_PRIMAL, b: bd.FOCO_PRIMAL },
        { label: 'Usos Energia', a: ad.USOS_ENERGIA, b: bd.USOS_ENERGIA },
        { label: 'Influência', a: ad.INFLUENCIA, b: bd.INFLUENCIA },
        { label: 'Engenhocas', a: ad.ENGENHOCAS, b: bd.ENGENHOCAS }
      ]
    },
    {
      title: 'Progressão',
      metrics: [
        { label: 'Nível', a: ax.levelCurrent, b: bx.levelCurrent },
        { label: 'XP total', a: ax.total, b: bx.total },
        { label: 'XP gasto', a: ax.spent, b: bx.spent, neutral: true },
        { label: 'XP disponível', a: ax.available - ax.spent, b: bx.available - bx.spent },
        { label: 'Proficiências', a: count(a, a.proficiencies), b: count(b, b.proficiencies) },
        {
          label: 'Sub-proficiências',
          a: count(a, a.subProficiencies),
          b: count(b, b.subProficiencies)
        },
        { label: 'Talentos', a: count(a, a.talents), b: count(b, b.talents) },
        {
          label: 'Conjurações',
          a: a.conjurations?.length ?? 0,
          b: b.conjurations?.length ?? 0
        }
      ]
    }
  ];
}

export function BuildComparator({ ctx }: { ctx: DataContext }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const roster = useBuilderStore((s) => s.roster);
  const entries = useMemo(
    () =>
      Object.values(roster)
        .map((c) => ({ id: c.id, name: c.name || 'Sem nome', level: c.level, char: c }))
        .sort((x, y) => y.char.updatedAt - x.char.updatedAt),
    [roster]
  );

  const [idA, setIdA] = useState<string>('');
  const [idB, setIdB] = useState<string>('');

  // Defaults: as duas mais recentes.
  useEffect(() => {
    if (entries.length === 0) return;
    setIdA((prev) => prev || entries[0].id);
    setIdB((prev) => prev || (entries[1]?.id ?? entries[0].id));
  }, [entries]);

  if (!hydrated) {
    return <p className="text-ink-300 text-sm">Carregando fichas…</p>;
  }

  if (entries.length < 2) {
    return (
      <div className="card">
        <p className="text-ink-300 text-sm">
          Você precisa de pelo menos <strong>2 fichas</strong> salvas para comparar. Crie outra
          no{' '}
          <Link href="/builder" className="text-ember-400 hover:underline">
            builder
          </Link>{' '}
          (menu de fichas → nova).
        </p>
      </div>
    );
  }

  const charA = roster[idA];
  const charB = roster[idB];
  const groups = charA && charB ? buildMetrics(ctx, charA, charB) : [];

  const raceLabel = (c?: Character) =>
    c ? findRace(ctx, c.raceId)?.name ?? '—' : '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <Picker label="Ficha A" value={idA} onChange={setIdA} entries={entries} accent="ember" />
        <span className="text-ink-500 text-xs">vs</span>
        <Picker label="Ficha B" value={idB} onChange={setIdB} entries={entries} accent="blood" />
      </div>

      {charA && charB && (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-center text-xs text-ink-400">
            <span>
              {raceLabel(charA)} · Nv {charA.level}
            </span>
            <span />
            <span>
              {raceLabel(charB)} · Nv {charB.level}
            </span>
          </div>

          {idA === idB && (
            <p className="text-center text-xs text-ink-500 italic">
              Mesma ficha dos dois lados — escolha duas diferentes.
            </p>
          )}

          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.title}>
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink-400 border-b border-ink-700 pb-1 mb-1.5">
                  {g.title}
                </h3>
                <div className="space-y-0.5">
                  {g.metrics.map((m) => (
                    <CompareRow key={m.label} metric={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  entries,
  accent
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  entries: Array<{ id: string; name: string; level: number }>;
  accent: 'ember' | 'blood';
}) {
  const ring = accent === 'ember' ? 'focus:border-ember-400' : 'focus:border-blood-400';
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:outline-none ${ring}`}
      >
        {entries.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} (Nv {e.level})
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareRow({ metric }: { metric: Metric }) {
  const { label, a, b, neutral } = metric;
  const aWins = !neutral && a > b;
  const bWins = !neutral && b > a;
  const cell = (val: number, win: boolean) =>
    `font-mono text-sm ${win ? 'text-ember-300 font-semibold' : 'text-ink-200'}`;
  const delta = a - b;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-0.5">
      <span className={`text-right ${cell(a, aWins)}`}>{a}</span>
      <span className="text-[11px] text-ink-400 text-center min-w-[7rem] px-1">
        {label}
        {!neutral && delta !== 0 && (
          <span className="ml-1 text-[10px] text-ink-500">
            ({delta > 0 ? '+' : ''}
            {delta})
          </span>
        )}
      </span>
      <span className={`text-left ${cell(b, bWins)}`}>{b}</span>
    </div>
  );
}
