'use client';

import type { DataContext } from '@/engine/context';
import { originalPowerRanks } from '@/engine/context';
import { computeXP, originalPowerRankCost } from '@/engine/xp';
import { useBuilderStore } from '@/lib/store';
import { Field, TextArea, TextInput } from '../fields';

function newAbilityId(): string {
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    const c = (globalThis as unknown as { crypto: Crypto }).crypto;
    if (c && 'randomUUID' in c) return 'opa_' + c.randomUUID().slice(0, 8);
  }
  return 'opa_' + Math.random().toString(36).slice(2, 10);
}

const TRIGGERS = ['Trauma', 'Herança', 'Exposição', 'Emocional', 'Inato', 'Pacto', 'Mutação', 'Morte'];
const COSTS = ['HP', 'Mana', 'Foco', 'Energia', 'Sanidade', 'Corrupção', 'Condição', 'Misto'];

export function StepPoderOriginal({ ctx }: { ctx: DataContext }) {
  const op = useBuilderStore((s) => s.character.originalPower);
  const character = useBuilderStore((s) => s.character);
  const setOriginalPower = useBuilderStore((s) => s.setOriginalPower);
  const addAbility = useBuilderStore((s) => s.addOriginalPowerAbility);
  const updateAbility = useBuilderStore((s) => s.updateOriginalPowerAbility);
  const removeAbility = useBuilderStore((s) => s.removeOriginalPowerAbility);
  const ranks = originalPowerRanks(ctx);
  const xp = computeXP(ctx, character);
  const abilities = op?.abilities ?? [];

  const p = op ?? {
    concept: '',
    trigger: '',
    costSource: '',
    effect: '',
    condition: '',
    weakness: '',
    rank: 1
  };

  const currentRank = ranks.find((r) => r.rank === p.rank);
  const checklist = [
    { ok: p.concept.trim().length > 0, label: 'Conceito em 1 frase' },
    { ok: p.trigger.trim().length > 0, label: 'Gatilho escolhido' },
    { ok: p.costSource.trim().length > 0, label: 'Fonte de custo definida' },
    { ok: p.effect.trim().length > 0, label: 'Efeito descrito' },
    { ok: p.condition.trim().length > 0, label: 'Pelo menos 1 condição' },
    { ok: p.weakness.trim().length > 0, label: 'Pelo menos 1 fraqueza' }
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <section className="rounded border border-ink-700 bg-ink-900/60 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Rank do Poder</p>
        <div className="flex flex-wrap gap-1">
          {ranks.map((r) => {
            const active = p.rank === r.rank;
            const levelOK = character.level >= r.levelMin;
            const cost = originalPowerRankCost(ctx, r.rank);
            const curCost = p.rank ? originalPowerRankCost(ctx, p.rank) : 0;
            const deltaIfBuy = cost - curCost;
            const affordable = deltaIfBuy <= xp.remaining;
            const disabled = !active && (!levelOK || (cost > 0 && !affordable));
            return (
              <button
                key={r.rank}
                onClick={() => setOriginalPower({ rank: r.rank })}
                disabled={disabled}
                className={`text-left rounded border px-2 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-ember-400 bg-ember-400/10 text-ember-400'
                    : 'border-ink-700 text-ink-200 enabled:hover:bg-ink-800 disabled:opacity-40'
                }`}
                title={!levelOK ? `Requer nível ${r.levelMin}` : ''}
              >
                <span className="font-mono">R{r.rank}</span>
                <span className="ml-1">{r.name}</span>
                <span className="block text-[10px] text-ink-400">
                  nv {r.levelMin} · {cost === 0 ? 'grátis' : `${cost} XP`}
                </span>
              </button>
            );
          })}
        </div>
        {currentRank && (
          <p className="text-xs text-ink-300">
            <span className="text-ink-400">Atual:</span> {currentRank.name} —{' '}
            {currentRank.effects ?? ''} · {currentRank.usesPerLongRest ?? '?'} usos/descanso longo.
          </p>
        )}
      </section>

      <Field label="Conceito (1 frase)" hint="Ex: 'Controlo metal com a mente.'">
        <TextInput value={p.concept} onChange={(v) => setOriginalPower({ concept: v })} />
      </Field>

      <Field
        label="Gatilho"
        hint="Por que o poder existe? Use um dos presets ou escreva livre."
      >
        <div className="flex flex-wrap gap-1 mb-1.5">
          {TRIGGERS.map((t) => (
            <Chip
              key={t}
              active={p.trigger === t}
              onClick={() => setOriginalPower({ trigger: t })}
            >
              {t}
            </Chip>
          ))}
        </div>
        <TextInput value={p.trigger} onChange={(v) => setOriginalPower({ trigger: v })} />
      </Field>

      <Field label="Fonte de Custo" hint="O que o uso do poder gasta?">
        <div className="flex flex-wrap gap-1 mb-1.5">
          {COSTS.map((c) => (
            <Chip
              key={c}
              active={p.costSource === c}
              onClick={() => setOriginalPower({ costSource: c })}
            >
              {c}
            </Chip>
          ))}
        </div>
        <TextInput value={p.costSource} onChange={(v) => setOriginalPower({ costSource: v })} />
      </Field>

      <Field label="Efeito" hint={currentRank?.effects ?? 'Descreva o que o poder faz no rank atual.'}>
        <TextArea value={p.effect} onChange={(v) => setOriginalPower({ effect: v })} rows={3} />
      </Field>

      <Field
        label="Condição de uso"
        hint="Min 1. Ativação, gatilho emocional, contato, linha de visão, material."
      >
        <TextInput value={p.condition} onChange={(v) => setOriginalPower({ condition: v })} />
      </Field>

      <Field
        label="Fraqueza"
        hint="Min 1. Elemento oposto, material específico, autolesão, detectável."
      >
        <TextInput value={p.weakness} onChange={(v) => setOriginalPower({ weakness: v })} />
      </Field>

      <section className="rounded border border-ink-700 bg-ink-900/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Habilidades Extras
          </p>
          <button
            type="button"
            onClick={() =>
              addAbility({
                id: newAbilityId(),
                name: '',
                description: '',
                unlockedAt: currentRank ? `Rank ${currentRank.rank}` : ''
              })
            }
            className="text-[11px] px-2 py-0.5 rounded border border-ember-400/60 text-ember-400 hover:bg-ember-400/10"
          >
            + adicionar slot
          </button>
        </div>
        <p className="text-[11px] text-ink-400">
          Use slots para habilidades desbloqueadas em marcos (Rank 2+, Cicatrizes de
          Ascensão, evoluções narrativas). Aparecem na ficha final.
        </p>
        {abilities.length === 0 ? (
          <p className="text-xs text-ink-500 italic">Nenhum slot extra ainda.</p>
        ) : (
          <ul className="space-y-2">
            {abilities.map((a) => (
              <li
                key={a.id}
                className="rounded border border-ink-700 bg-ink-800/40 p-2 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-ink-900 border border-ink-700 text-ink-100 text-xs rounded px-2 py-1"
                    placeholder="Nome"
                    value={a.name}
                    onChange={(e) => updateAbility(a.id, { name: e.target.value })}
                  />
                  <input
                    className="w-32 bg-ink-900 border border-ink-700 text-ink-100 text-xs rounded px-2 py-1"
                    placeholder="Desbloqueio"
                    value={a.unlockedAt ?? ''}
                    onChange={(e) => updateAbility(a.id, { unlockedAt: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeAbility(a.id)}
                    className="text-[11px] px-2 py-0.5 rounded border border-blood-400/60 text-blood-400 hover:bg-blood-400/10"
                    aria-label="remover"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  className="w-full bg-ink-900 border border-ink-700 text-ink-100 text-xs rounded px-2 py-1"
                  rows={2}
                  placeholder="Descrição do efeito, custo adicional, gatilho, condição."
                  value={a.description}
                  onChange={(e) => updateAbility(a.id, { description: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-ink-700 bg-ink-900/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2">Checklist</p>
        <ul className="text-xs space-y-0.5">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span
                className={`inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] font-mono ${
                  c.ok ? 'bg-ember-400 text-ink-900' : 'border border-ink-600 text-ink-400'
                }`}
              >
                {c.ok ? '✓' : '·'}
              </span>
              <span className={c.ok ? 'text-ink-200' : 'text-ink-400'}>{c.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Chip({
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
      className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
        active
          ? 'border-ember-400 text-ember-400 bg-ember-400/10'
          : 'border-ink-700 text-ink-300 hover:bg-ink-800'
      }`}
    >
      {children}
    </button>
  );
}
