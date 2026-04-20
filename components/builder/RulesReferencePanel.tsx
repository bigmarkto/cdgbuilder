'use client';

import { useMemo, useState } from 'react';
import type { DataContext } from '@/engine/context';
import {
  listConditions,
  conditionEffects,
  maxStage,
  isStaged,
  listCoverTiers,
  coverEffect,
  fallDamage,
  type ConditionRecord
} from '@/engine/rules';

/**
 * Painel de referência — consolidado do pacote Vale Desperto v2.0 em 3 seções:
 *   - Condições (busca + visualização com estágios)
 *   - Cobertura (picker de tier)
 *   - Queda (calculadora de dano)
 *
 * Tudo client-side puro. Nenhuma mutação no character — apenas leitura
 * dos JSONs em `ctx.rules`.
 */
export function RulesReferencePanel({ ctx }: { ctx: DataContext }) {
  const rules = ctx.rules;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'condicoes' | 'cobertura' | 'queda'>(
    rules?.conditions ? 'condicoes' : rules?.cover ? 'cobertura' : 'queda'
  );

  if (!rules || (!rules.conditions && !rules.cover && !rules.fall)) return null;

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 text-sm print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-ink-800/50"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
          Referência rápida
        </span>
        <span className="font-mono text-xs text-ember-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="border-t border-ink-500">
          <div className="flex border-b border-ink-600 text-xs">
            {rules.conditions && (
              <TabButton active={tab === 'condicoes'} onClick={() => setTab('condicoes')}>
                Condições
              </TabButton>
            )}
            {rules.cover && (
              <TabButton active={tab === 'cobertura'} onClick={() => setTab('cobertura')}>
                Cobertura
              </TabButton>
            )}
            {rules.fall && (
              <TabButton active={tab === 'queda'} onClick={() => setTab('queda')}>
                Queda
              </TabButton>
            )}
          </div>
          <div className="p-3">
            {tab === 'condicoes' && rules.conditions && (
              <ConditionsTab table={rules.conditions} />
            )}
            {tab === 'cobertura' && rules.cover && <CoverTab table={rules.cover} />}
            {tab === 'queda' && rules.fall && <FallTab table={rules.fall} />}
          </div>
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 border-r border-ink-600 last:border-r-0 transition-colors',
        active ? 'text-ember-400 bg-ink-800/60' : 'text-ink-300 hover:text-ink-100'
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/* ---------- Condições ---------- */

function ConditionsTab({ table }: { table: NonNullable<DataContext['rules']>['conditions'] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ConditionRecord | null>(null);
  const [stage, setStage] = useState(1);

  const all = useMemo(() => (table ? listConditions(table) : []), [table]);
  const filtered = useMemo(() => {
    if (!query) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
    );
  }, [all, query]);

  const staged = selected ? isStaged(selected) : false;
  const effects = selected ? conditionEffects(selected, staged ? stage : undefined) : [];
  const maxS = selected ? maxStage(selected) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar condição…"
          className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 placeholder:text-ink-500"
        />
        <ul className="max-h-72 overflow-y-auto space-y-0.5">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(c);
                  setStage(1);
                }}
                className={[
                  'w-full text-left px-2 py-1 text-xs rounded transition-colors',
                  selected?.id === c.id
                    ? 'bg-ember-400/10 text-ember-300'
                    : 'text-ink-200 hover:bg-ink-800/60'
                ].join(' ')}
              >
                {c.name}
                {isStaged(c) && (
                  <span className="ml-1 font-mono text-[10px] text-ink-400">
                    (×{maxStage(c)})
                  </span>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="text-xs text-ink-400 italic px-2 py-1">Nenhuma condição encontrada.</li>
          )}
        </ul>
      </div>

      <div className="rounded border border-ink-600 bg-ink-900/60 p-2 min-h-[12rem]">
        {!selected && (
          <p className="text-xs text-ink-400 italic">Selecione uma condição para ver efeitos.</p>
        )}
        {selected && (
          <div className="space-y-2">
            <div>
              <p className="font-serif text-ink-50 text-base">{selected.name}</p>
              {selected.description && (
                <p className="text-xs text-ink-300 mt-0.5">{selected.description}</p>
              )}
              {selected.duration && (
                <p className="text-[11px] text-ink-400 italic mt-0.5">
                  <strong>Duração:</strong> {selected.duration}
                </p>
              )}
            </div>

            {staged && maxS > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">
                  Estágio: {stage} / {maxS}
                </p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: maxS }, (_, i) => i + 1).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStage(s)}
                      className={[
                        'flex-1 px-2 py-0.5 text-xs rounded border transition-colors',
                        stage === s
                          ? 'border-ember-400 text-ember-400 bg-ember-400/10'
                          : 'border-ink-700 text-ink-300 hover:text-ink-100'
                      ].join(' ')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {selected.stages && (
                  <p className="text-[11px] text-ink-200 mt-1 font-serif">
                    {selected.stages.find((st) => st.stage === stage)?.name ?? ''}
                  </p>
                )}
              </div>
            )}

            {effects.length > 0 && (
              <ul className="text-xs text-ink-200 space-y-0.5 border-t border-ink-700 pt-2">
                {effects.map((e, i) => (
                  <li key={i}>
                    • {(e.text as string) ?? (e.type as string) ?? JSON.stringify(e)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Cobertura ---------- */

function CoverTab({ table }: { table: NonNullable<DataContext['rules']>['cover'] }) {
  const tiers = useMemo(() => (table ? listCoverTiers(table) : []), [table]);
  const [selectedId, setSelectedId] = useState<string>(tiers[0]?.id ?? '');
  const selected = tiers.find((t) => t.id === selectedId) ?? null;
  const eff = coverEffect(selected);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tiers.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={[
              'px-2 py-1 rounded border text-xs transition-colors',
              selectedId === t.id
                ? 'border-ember-400 text-ember-400 bg-ember-400/10'
                : 'border-ink-700 text-ink-200 hover:text-ink-100'
            ].join(' ')}
          >
            {t.name}
          </button>
        ))}
      </div>
      {selected && (
        <div className="rounded border border-ink-600 bg-ink-900/60 p-2 text-xs space-y-1">
          {selected.description && <p className="text-ink-200">{selected.description}</p>}
          <ul className="grid grid-cols-3 gap-1 font-mono">
            <li className="rounded bg-ink-800/80 px-2 py-1 flex justify-between">
              <span className="text-ink-400">DP</span>
              <span className="text-ember-400">
                {eff.blocksLineOfSight ? '∞' : `+${eff.dpBonus}`}
              </span>
            </li>
            <li className="rounded bg-ink-800/80 px-2 py-1 flex justify-between">
              <span className="text-ink-400">Reflexos</span>
              <span className="text-ember-400">
                {eff.blocksLineOfSight ? '∞' : `+${eff.reflexBonus}`}
              </span>
            </li>
            <li className="rounded bg-ink-800/80 px-2 py-1 flex justify-between">
              <span className="text-ink-400">LoS</span>
              <span className="text-ember-400">
                {eff.blocksLineOfSight ? 'bloq.' : 'ok'}
              </span>
            </li>
          </ul>
          {selected.examples && selected.examples.length > 0 && (
            <p className="text-[11px] text-ink-400 italic">
              Ex.: {selected.examples.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Queda ---------- */

function FallTab({ table }: { table: NonNullable<DataContext['rules']>['fall'] }) {
  const [meters, setMeters] = useState(10);
  const [surfaceId, setSurfaceId] = useState<string>('rigida');
  const [reaction, setReaction] = useState<'none' | 'acrobacia' | 'reflexos'>('none');

  if (!table) return null;

  const metersAfterReactions = reaction === 'reflexos' ? Math.max(0, meters - 3) : meters;
  const abilityMultiplier = reaction === 'acrobacia' ? 0.5 : 1;

  const result = fallDamage(table, meters, {
    metersAfterReactions,
    surfaceId,
    abilityMultiplier
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Altura: {meters}m
          </span>
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={meters}
            onChange={(e) => setMeters(parseInt(e.target.value, 10))}
            className="w-full accent-ember-400"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Superfície</span>
          <select
            value={surfaceId}
            onChange={(e) => setSurfaceId(e.target.value)}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100"
          >
            {(table.surfaceModifiers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (×{s.multiplier})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">Reação</p>
        <div className="flex gap-1">
          {(['none', 'acrobacia', 'reflexos'] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setReaction(r)}
              className={[
                'flex-1 px-2 py-1 rounded border text-xs transition-colors',
                reaction === r
                  ? 'border-ember-400 text-ember-400 bg-ember-400/10'
                  : 'border-ink-700 text-ink-200 hover:text-ink-100'
              ].join(' ')}
            >
              {r === 'none' ? 'Nenhuma' : r === 'acrobacia' ? 'Acrobacia ½' : 'Reflexos −3m'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded border border-ink-600 bg-ink-900/60 p-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-ink-300">Faixa:</span>
          <span className="font-mono text-ink-100">
            {result.row.minMeters}–{result.row.maxMeters ?? '∞'}m
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-300">Dano base:</span>
          <span className="font-mono text-ink-100">{result.baseDice}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-300">Dano final:</span>
          <span className="font-mono text-ember-400 text-base">
            {result.finalDice} <span className="text-[10px] text-ink-400">{result.damageType}</span>
          </span>
        </div>
        {result.note && <p className="text-[11px] text-ink-400 italic">{result.note}</p>}
      </div>
    </div>
  );
}
