'use client';

import { useMemo, useState } from 'react';
import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';
import {
  listConditions,
  conditionEffects,
  findCondition,
  isStaged,
  maxStage,
  type ConditionRecord
} from '@/engine/rules';

/**
 * Rastreador de condições ativas. Widget combate-utility:
 *   - chips clicáveis com as condições atualmente aplicadas
 *   - botão "+ Condição" abre um picker em popover com busca
 *   - stage pickers inline para condições escalonadas
 *   - botão "limpar" para fim de cena
 *
 * Lê do catálogo `ctx.rules.conditions` e escreve direto no store via
 * add/remove/setStage. Retorna `null` se o catálogo não estiver carregado.
 */
export function ActiveConditionsTracker({ ctx }: { ctx: DataContext }) {
  const table = ctx.rules?.conditions;
  const active = useBuilderStore((s) => s.character.activeConditions ?? []);
  const addActiveCondition = useBuilderStore((s) => s.addActiveCondition);
  const removeActiveCondition = useBuilderStore((s) => s.removeActiveCondition);
  const setActiveConditionStage = useBuilderStore((s) => s.setActiveConditionStage);
  const clearActiveConditions = useBuilderStore((s) => s.clearActiveConditions);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (!table) return null;

  const all = listConditions(table);
  const filtered = query
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.id.toLowerCase().includes(query.toLowerCase())
      )
    : all;

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 p-3 text-sm space-y-2 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Condições Ativas</p>
          <p className="font-serif text-base text-ink-50">
            {active.length === 0 ? 'Nenhuma' : `${active.length} ativa(s)`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {active.length > 0 && (
            <button
              type="button"
              onClick={() => clearActiveConditions()}
              className="px-2 py-0.5 text-[11px] rounded border border-ink-700 text-ink-300 hover:text-ink-100"
              aria-label="Limpar todas as condições"
            >
              limpar
            </button>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="px-2 py-0.5 text-[11px] rounded border border-ember-400/60 text-ember-300 hover:bg-ember-400/10"
            aria-expanded={pickerOpen}
          >
            + Condição
          </button>
        </div>
      </div>

      {active.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {active.map((a) => {
            const rec = findCondition(table, a.id);
            if (!rec) return null;
            const staged = isStaged(rec);
            const maxS = maxStage(rec);
            const effects = conditionEffects(rec, staged ? a.stage ?? 1 : undefined);
            return (
              <ActiveChip
                key={a.id}
                record={rec}
                stage={a.stage}
                staged={staged}
                maxStage={maxS}
                effects={effects}
                note={a.note}
                onSetStage={(s) => setActiveConditionStage(a.id, s)}
                onRemove={() => removeActiveCondition(a.id)}
              />
            );
          })}
        </ul>
      )}

      {pickerOpen && (
        <div className="rounded border border-ink-600 bg-ink-900/80 p-2 space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar condição…"
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 placeholder:text-ink-500"
            autoFocus
          />
          <ul className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
            {filtered.map((c) => {
              const already = active.some((a) => a.id === c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      addActiveCondition({
                        id: c.id,
                        stage: isStaged(c) ? 1 : undefined,
                        at: Date.now()
                      });
                      setPickerOpen(false);
                      setQuery('');
                    }}
                    disabled={already}
                    className={[
                      'w-full text-left px-2 py-1 text-xs rounded border transition-colors',
                      already
                        ? 'border-ink-700 text-ink-500 cursor-not-allowed'
                        : 'border-ink-700 text-ink-200 hover:border-ember-400/60 hover:text-ember-300'
                    ].join(' ')}
                  >
                    {c.name}
                    {isStaged(c) && (
                      <span className="ml-1 font-mono text-[10px] text-ink-400">
                        (×{maxStage(c)})
                      </span>
                    )}
                    {already && <span className="ml-1 text-[10px] text-ink-500">ativa</span>}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="col-span-2 text-xs text-ink-400 italic px-2 py-1">
                Nenhuma condição encontrada.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

interface ActiveChipProps {
  record: ConditionRecord;
  stage?: number;
  staged: boolean;
  maxStage: number;
  effects: ReturnType<typeof conditionEffects>;
  note?: string;
  onSetStage: (stage: number) => void;
  onRemove: () => void;
}

function ActiveChip({
  record,
  stage,
  staged,
  maxStage,
  effects,
  note,
  onSetStage,
  onRemove
}: ActiveChipProps) {
  const [expanded, setExpanded] = useState(false);
  const effectsText = useMemo(
    () =>
      effects
        .map((e) => (e.text as string) ?? (e.type as string) ?? '')
        .filter(Boolean)
        .slice(0, 3),
    [effects]
  );

  return (
    <li className="inline-block">
      <div className="inline-flex items-stretch rounded border border-blood-400/50 bg-blood-500/10">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-2 py-0.5 text-xs text-blood-200 hover:text-blood-100"
          aria-expanded={expanded}
        >
          {record.name}
          {staged && stage !== undefined && (
            <span className="ml-1 font-mono text-[10px] text-blood-300">·{stage}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="px-1.5 text-xs text-blood-300 hover:text-blood-100 border-l border-blood-400/40"
          aria-label={`Remover ${record.name}`}
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="mt-1 rounded border border-ink-600 bg-ink-900/80 p-2 text-xs text-ink-200 space-y-1 min-w-[16rem]">
          {record.description && <p className="text-ink-300">{record.description}</p>}
          {staged && maxStage > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Stage</span>
              {Array.from({ length: maxStage }, (_, i) => i + 1).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => onSetStage(s)}
                  className={[
                    'w-6 h-6 text-xs rounded border transition-colors',
                    (stage ?? 1) === s
                      ? 'border-ember-400 text-ember-400 bg-ember-400/10'
                      : 'border-ink-700 text-ink-300 hover:text-ink-100'
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {effectsText.length > 0 && (
            <ul className="space-y-0.5">
              {effectsText.map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
          )}
          {note && <p className="italic text-ink-400">{note}</p>}
        </div>
      )}
    </li>
  );
}
