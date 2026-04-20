'use client';

import { useMemo, useState } from 'react';
import type { DataContext } from '@/engine/context';
import {
  effectiveMaxRank,
  proficiencyBudgetStatus,
  subProficiencyMaxRank,
  subProficiencyPrereqMet,
  subProficiencyStatus
} from '@/engine/proficiencies';
import { computeXP, subProficiencyRankCost } from '@/engine/xp';
import type { Character } from '@/engine/character';
import type { ProficiencyRecord } from '@/lib/types';
import { useBuilderStore } from '@/lib/store';

type Tab = 'basicas' | 'subs';

export function StepProficiencias({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const setProficiency = useBuilderStore((s) => s.setProficiency);
  const setSubProficiency = useBuilderStore((s) => s.setSubProficiency);

  const [tab, setTab] = useState<Tab>('basicas');

  const status = proficiencyBudgetStatus(ctx, character);
  const maxRank = effectiveMaxRank(ctx, character);
  const subMax = subProficiencyMaxRank(ctx, character);
  const xp = computeXP(ctx, character);

  const profs = useMemo<ProficiencyRecord[]>(
    () => (ctx.proficiencies.proficiencies ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [ctx]
  );
  const subs = useMemo<ProficiencyRecord[]>(
    () => (ctx.proficiencies.subProficiencies ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [ctx]
  );

  const parentLookup = useMemo(() => {
    const idx = new Map<string, string | null>();
    for (const s of subs) idx.set(s.id, s.parent ?? null);
    return (id: string) => idx.get(id) ?? null;
  }, [subs]);
  const subCheck = subProficiencyStatus(ctx, character, parentLookup);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 border-b border-ink-700">
        <TabButton active={tab === 'basicas'} onClick={() => setTab('basicas')}>
          Básicas
        </TabButton>
        <TabButton active={tab === 'subs'} onClick={() => setTab('subs')}>
          Sub-Proficiências
        </TabButton>
      </div>

      {tab === 'basicas' ? (
        <BasicasTab
          ctx={ctx}
          profs={profs}
          status={status}
          maxRank={maxRank}
          character={character}
          onChange={(id, v) => setProficiency(id, v)}
        />
      ) : (
        <SubsTab
          ctx={ctx}
          subs={subs}
          profs={profs}
          maxRank={subMax}
          xpRemaining={xp.remaining}
          violations={subCheck.violations}
          character={character}
          onChange={(id, v) => setSubProficiency(id, v)}
        />
      )}
    </div>
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
      onClick={onClick}
      className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? 'border-ember-400 text-ember-400'
          : 'border-transparent text-ink-300 hover:text-ink-100'
      }`}
    >
      {children}
    </button>
  );
}

// ---------- Básicas ----------

function BasicasTab({
  ctx,
  profs,
  status,
  maxRank,
  character,
  onChange
}: {
  ctx: DataContext;
  profs: ProficiencyRecord[];
  status: { spent: number; total: number; remaining: number };
  maxRank: number;
  character: { proficiencies: Record<string, number> };
  onChange: (id: string, rank: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const [attrFilter, setAttrFilter] = useState<string>('all');

  const filtered = profs.filter((p) => {
    if (attrFilter !== 'all' && String(p.attribute ?? '').indexOf(attrFilter) === -1) return false;
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-300">Pontos:</span>
          <span className="font-mono text-ember-400">
            {status.spent} / {status.total}
          </span>
          <span
            className={`font-mono ${
              status.remaining === 0
                ? 'text-ink-300'
                : status.remaining < 0
                  ? 'text-blood-400'
                  : 'text-ember-400'
            }`}
          >
            ({status.remaining >= 0 ? `${status.remaining} restantes` : `${-status.remaining} excedidos`})
          </span>
          <span className="text-xs text-ink-400">Rank máx: {maxRank}</span>
        </div>
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar…"
            className="rounded bg-ink-900 border border-ink-600 px-2 py-1 text-sm text-ink-50 w-40"
          />
          <select
            value={attrFilter}
            onChange={(e) => setAttrFilter(e.target.value)}
            className="rounded bg-ink-900 border border-ink-600 px-2 py-1 text-sm text-ink-200"
          >
            <option value="all">Todos atributos</option>
            {(ctx.proficiencies.attributes ?? []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </header>

      <ul className="divide-y divide-ink-800 rounded border border-ink-700 bg-ink-900/60 max-h-[60vh] overflow-y-auto">
        {filtered.map((p) => {
          const rank = character.proficiencies[p.id] ?? 0;
          return (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-50 leading-tight">
                  {p.name}{' '}
                  {p.attribute && (
                    <span className="text-[10px] text-ink-400 font-mono">({p.attribute})</span>
                  )}
                </p>
                {p.description && (
                  <p className="text-xs text-ink-300 truncate">{p.description}</p>
                )}
              </div>
              <RankPicker
                rank={rank}
                max={maxRank}
                canIncrement={rank < maxRank && status.remaining > 0}
                onChange={(v) => onChange(p.id, v)}
              />
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-ink-400 text-center">Nenhuma proficiência.</li>
        )}
      </ul>
    </div>
  );
}

// ---------- Subs ----------

function SubsTab({
  ctx,
  subs,
  profs,
  maxRank,
  xpRemaining,
  violations,
  character,
  onChange
}: {
  ctx: DataContext;
  subs: ProficiencyRecord[];
  profs: ProficiencyRecord[];
  maxRank: number;
  xpRemaining: number;
  violations: string[];
  character: Character;
  onChange: (id: string, rank: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  const profNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profs) m.set(p.id, p.name);
    return m;
  }, [profs]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of subs) {
      const cat = typeof s.category === 'string' ? s.category : typeof s.source === 'string' ? s.source : null;
      if (cat) set.add(cat);
    }
    return [...set].sort();
  }, [subs]);

  const filtered = subs.filter((s) => {
    const cat = typeof s.category === 'string' ? s.category : typeof s.source === 'string' ? s.source : '';
    if (catFilter !== 'all' && cat !== catFilter) return false;
    if (filter && !s.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const levelLocked = maxRank === 0;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-300">XP restante:</span>
          <span
            className={`font-mono ${
              xpRemaining < 0 ? 'text-blood-400' : xpRemaining === 0 ? 'text-ink-300' : 'text-ember-400'
            }`}
          >
            {xpRemaining}
          </span>
          <span className="text-xs text-ink-400">Rank máx (por nível): {maxRank}</span>
        </div>
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar…"
            className="rounded bg-ink-900 border border-ink-600 px-2 py-1 text-sm text-ink-50 w-40"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded bg-ink-900 border border-ink-600 px-2 py-1 text-sm text-ink-200"
          >
            <option value="all">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </header>

      {levelLocked && (
        <p className="text-xs text-ink-400 border border-ink-700 rounded px-3 py-2 bg-ink-900/40">
          Sub-Proficiências abrem no Nível 2. Aumente o nível do personagem para destravar.
        </p>
      )}

      {violations.length > 0 && (
        <ul className="text-xs text-blood-400 space-y-0.5">
          {violations.map((v, i) => (
            <li key={i}>• {v}</li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-ink-800 rounded border border-ink-700 bg-ink-900/60 max-h-[60vh] overflow-y-auto">
        {filtered.map((s) => {
          const rank = character.subProficiencies[s.id] ?? 0;
          const parent = s.parent ?? null;
          const parentName = parent ? profNameById.get(parent) ?? parent : null;
          const parentRank = parent ? character.proficiencies[parent] ?? 0 : 0;
          const nextRank = rank + 1;
          const prereqOK = subProficiencyPrereqMet(character, parent, nextRank);
          const cost = subProficiencyRankCost(ctx, nextRank);
          const canIncrement =
            !levelLocked &&
            rank < maxRank &&
            prereqOK &&
            xpRemaining - cost >= 0;

          return (
            <li key={s.id} className="px-3 py-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-50 leading-tight">
                    {s.name}{' '}
                    {s.attribute && (
                      <span className="text-[10px] text-ink-400 font-mono">({s.attribute})</span>
                    )}
                  </p>
                  {parent && (
                    <p className="text-[11px] text-ink-400">
                      Requer: {parentName} R{nextRank}+
                      <span className={parentRank >= nextRank ? 'text-ember-400 ml-1' : 'text-blood-400 ml-1'}>
                        (atual {parentRank})
                      </span>
                    </p>
                  )}
                  {s.description && (
                    <p className="text-xs text-ink-300 truncate">{s.description}</p>
                  )}
                </div>
                <div className="text-right text-[10px] text-ink-400 font-mono shrink-0">
                  {rank < maxRank && cost > 0 && (
                    <span>R{nextRank}: {cost} XP</span>
                  )}
                </div>
                <RankPicker
                  rank={rank}
                  max={Math.max(maxRank, rank)}
                  canIncrement={canIncrement}
                  onChange={(v) => onChange(s.id, v)}
                />
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-ink-400 text-center">Nenhuma sub-proficiência.</li>
        )}
      </ul>
    </div>
  );
}

// ---------- RankPicker ----------

function RankPicker({
  rank,
  max,
  canIncrement,
  onChange
}: {
  rank: number;
  max: number;
  canIncrement: boolean;
  onChange: (r: number) => void;
}) {
  const cells = Array.from({ length: Math.max(max, rank) + 1 }, (_, i) => i);
  return (
    <div className="flex items-center gap-1">
      {cells.map((i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          disabled={i > rank && !canIncrement}
          className={`w-6 h-6 rounded border text-[10px] font-mono transition-colors ${
            i === 0
              ? 'border-ink-700 text-ink-500 hover:bg-ink-800'
              : i <= rank
                ? 'border-ember-400 bg-ember-400/20 text-ember-400'
                : 'border-ink-600 text-ink-300 enabled:hover:bg-ink-800 disabled:opacity-30'
          }`}
        >
          {i === 0 ? '–' : i}
        </button>
      ))}
    </div>
  );
}
