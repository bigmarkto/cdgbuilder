'use client';

/**
 * CombatTracker — painel de combate na ficha (balanceamento 1.2 + 1.4 + 1.1).
 *
 * Três blocos:
 *   1. Economia de Ações — pips clicáveis (Padrão/Movimento/Bônus/Reação)
 *      a partir de computeActionBudget. "Novo turno" zera o uso e regride
 *      cooldowns.
 *   2. Cooldowns — lista de recargas nomeadas em rodadas, com tick manual e
 *      regressão automática no "Novo turno".
 *   3. Ataque rápido — escolhe categoria + dado de arma e mostra acerto/dano
 *      via computeAttack (POT/AGI conforme a categoria).
 *   4. Conjuração — escolhe Vertente + Intensidade e mostra custo de Energia
 *      (com sobretaxa se não-treinado) + DT de controle, via computeCastingCost.
 *
 * Estado de combate (pips usados, cooldowns) é EFÊMERO: vive em useState e
 * reseta ao recarregar. Não polui o Character salvo — é tracking de mesa.
 */

import { useMemo, useState } from 'react';
import type { Vertente } from '@/lib/types';
import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';
import {
  computeActionBudget,
  actionTypeInfo,
  ACTION_TYPES,
  type ActionType
} from '@/engine/actions';
import { computeAttack } from '@/engine/combat';
import { computeCastingCost } from '@/engine/casting';

const ACTION_LABELS: Record<ActionType, string> = {
  standard: 'Padrão',
  move: 'Movimento',
  bonus: 'Bônus',
  reaction: 'Reação'
};

const ACTION_COLORS: Record<ActionType, string> = {
  standard: 'bg-ember-500 border-ember-400',
  move: 'bg-ink-300 border-ink-200',
  bonus: 'bg-blood-400 border-blood-300',
  reaction: 'bg-ink-400 border-ink-300'
};

interface CooldownEntry {
  id: string;
  name: string;
  remaining: number;
}

interface VertenteSystemLike {
  intensities?: Array<{ id: string; name: string; dice?: string; controlDT?: number }>;
  untrainedCasting?: {
    trainedThreshold?: number;
    manaSurchargeByIntensity?: Record<string, number>;
  };
}

export function CombatTracker({
  ctx,
  vertentes = [],
  vertenteSystem
}: {
  ctx: DataContext;
  vertentes?: Vertente[];
  vertenteSystem?: VertenteSystemLike | null;
}) {
  const character = useBuilderStore((s) => s.character);

  const budget = useMemo(() => computeActionBudget(ctx, character), [ctx, character]);
  const acoesTable = ctx.rules?.acoes;

  // Pips usados por tipo (efêmero).
  const [used, setUsed] = useState<Record<ActionType, number>>({
    standard: 0,
    move: 0,
    bonus: 0,
    reaction: 0
  });
  const [cooldowns, setCooldowns] = useState<CooldownEntry[]>([]);

  const togglePip = (type: ActionType, index: number) => {
    setUsed((prev) => {
      // Se o pip clicado já está usado, "desusa" dele pra cima; senão usa até ele.
      const current = prev[type];
      const next = index < current ? index : index + 1;
      return { ...prev, [type]: next };
    });
  };

  const newTurn = () => {
    setUsed({ standard: 0, move: 0, bonus: 0, reaction: 0 });
    setCooldowns((prev) =>
      prev
        .map((c) => ({ ...c, remaining: c.remaining - 1 }))
        .filter((c) => c.remaining > 0)
    );
  };

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 p-3 text-sm space-y-4 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Combate</p>
          <p className="font-serif text-base text-ink-50">Rastreador de turno</p>
        </div>
        <button
          type="button"
          onClick={newTurn}
          className="px-2.5 py-1 text-[11px] rounded border border-ember-400/60 text-ember-300 hover:bg-ember-400/10"
          title="Zera as ações usadas e regride os cooldowns em 1 rodada"
        >
          ↻ Novo turno
        </button>
      </div>

      {/* 1. Economia de ações */}
      <div className="space-y-1.5">
        {ACTION_TYPES.filter((t) => budget[t] > 0).map((type) => {
          const info = actionTypeInfo(acoesTable, type);
          return (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-24 shrink-0 text-xs text-ink-200"
                title={info?.description}
              >
                {ACTION_LABELS[type]}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: budget[type] }, (_, i) => {
                  const isUsed = i < used[type];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => togglePip(type, i)}
                      aria-label={`${ACTION_LABELS[type]} ${i + 1} ${isUsed ? 'usada' : 'disponível'}`}
                      className={[
                        'w-5 h-5 rounded-sm border transition-colors',
                        isUsed
                          ? 'bg-ink-800 border-ink-700'
                          : ACTION_COLORS[type]
                      ].join(' ')}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-ink-500">
                {budget[type] - used[type]}/{budget[type]}
              </span>
            </div>
          );
        })}
      </div>

      {/* 2. Cooldowns */}
      <CooldownSection cooldowns={cooldowns} setCooldowns={setCooldowns} />

      {/* 3. Ataque rápido */}
      {ctx.rules?.combate && <AttackPanel ctx={ctx} />}

      {/* 4. Conjuração */}
      {vertenteSystem?.untrainedCasting && vertenteSystem.intensities && (
        <CastingPanel
          ctx={ctx}
          vertentes={vertentes}
          intensities={vertenteSystem.intensities}
          untrained={vertenteSystem.untrainedCasting}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------

function CooldownSection({
  cooldowns,
  setCooldowns
}: {
  cooldowns: CooldownEntry[];
  setCooldowns: React.Dispatch<React.SetStateAction<CooldownEntry[]>>;
}) {
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState(2);

  const add = () => {
    const n = name.trim();
    if (!n || rounds < 1) return;
    setCooldowns((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: n, remaining: rounds }
    ]);
    setName('');
    setRounds(2);
  };

  return (
    <div className="border-t border-ink-700 pt-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Cooldowns</p>
      {cooldowns.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {cooldowns.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-stretch rounded border border-ink-600 bg-ink-900/60"
            >
              <span className="px-2 py-0.5 text-xs text-ink-100">
                {c.name}{' '}
                <span className="font-mono text-[10px] text-ember-300">{c.remaining}r</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setCooldowns((prev) =>
                    prev
                      .map((x) => (x.id === c.id ? { ...x, remaining: x.remaining - 1 } : x))
                      .filter((x) => x.remaining > 0)
                  )
                }
                className="px-1.5 text-xs text-ink-300 hover:text-ink-100 border-l border-ink-700"
                aria-label={`Reduzir cooldown de ${c.name}`}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setCooldowns((prev) => prev.filter((x) => x.id !== c.id))}
                className="px-1.5 text-xs text-blood-300 hover:text-blood-100 border-l border-ink-700"
                aria-label={`Remover cooldown de ${c.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Habilidade em recarga…"
          className="flex-1 min-w-0 bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 placeholder:text-ink-500"
        />
        <input
          type="number"
          min={1}
          max={20}
          value={rounds}
          onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 1))}
          className="w-12 bg-ink-900 border border-ink-700 rounded px-1 py-1 text-xs text-ink-100 text-center"
          aria-label="Rodadas de recarga"
        />
        <button
          type="button"
          onClick={add}
          className="px-2 py-1 text-[11px] rounded border border-ink-600 text-ink-200 hover:border-ember-400/60 hover:text-ember-300"
        >
          + cooldown
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ataque rápido
// ---------------------------------------------------------------------------

function AttackPanel({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const cats = ctx.rules?.combate?.categories ?? [];
  const [categoryId, setCategoryId] = useState(cats[0]?.id ?? 'corpo');
  const [weaponDice, setWeaponDice] = useState('1d8');
  const [weaponBonus, setWeaponBonus] = useState(0);

  const cat = cats.find((c) => c.id === categoryId);
  const result = useMemo(
    () =>
      computeAttack(ctx, character, {
        categoryId,
        weaponDice,
        weaponToHitBonus: weaponBonus,
        weaponDamageBonus: weaponBonus
      }),
    [ctx, character, categoryId, weaponDice, weaponBonus]
  );

  return (
    <div className="border-t border-ink-700 pt-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Ataque rápido</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="bg-ink-900 border border-ink-700 rounded px-1.5 py-1 text-xs text-ink-100"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={weaponDice}
          onChange={(e) => setWeaponDice(e.target.value)}
          className="w-16 bg-ink-900 border border-ink-700 rounded px-1.5 py-1 text-xs text-ink-100 text-center"
          aria-label="Dado da arma"
          placeholder="1d8"
        />
        <label className="flex items-center gap-1 text-[10px] text-ink-400">
          arma
          <input
            type="number"
            value={weaponBonus}
            onChange={(e) => setWeaponBonus(Number(e.target.value) || 0)}
            className="w-12 bg-ink-900 border border-ink-700 rounded px-1 py-1 text-xs text-ink-100 text-center"
            aria-label="Bônus de arma"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-ink-200">
          Acerto: <span className="font-mono text-ember-300">{result.toHitText}</span>
          {result.toHitAttr && (
            <span className="text-ink-500"> ({result.toHitAttr} + rank {result.proficiencyRank})</span>
          )}
        </span>
        <span className="text-ink-200">
          Dano: <span className="font-mono text-blood-300">{result.damageText}</span>
        </span>
      </div>
      {cat?.description && <p className="text-[10px] text-ink-500 italic">{cat.description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conjuração
// ---------------------------------------------------------------------------

function CastingPanel({
  ctx,
  vertentes,
  intensities,
  untrained
}: {
  ctx: DataContext;
  vertentes: Vertente[];
  intensities: Array<{ id: string; name: string; dice?: string; controlDT?: number }>;
  untrained: { trainedThreshold?: number; manaSurchargeByIntensity?: Record<string, number> };
}) {
  const character = useBuilderStore((s) => s.character);
  const [vertenteId, setVertenteId] = useState(vertentes[0]?.id ?? '');
  const [intensityId, setIntensityId] = useState(intensities[0]?.id ?? 'leve');
  const [baseCost, setBaseCost] = useState(0);

  const result = useMemo(() => {
    if (!vertenteId) return null;
    return computeCastingCost(
      ctx,
      character,
      { vertenteId, baseEnergyCost: baseCost, intensityId },
      untrained,
      intensities
    );
  }, [ctx, character, vertenteId, intensityId, baseCost, untrained, intensities]);

  if (vertentes.length === 0) return null;

  return (
    <div className="border-t border-ink-700 pt-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Conjuração</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={vertenteId}
          onChange={(e) => setVertenteId(e.target.value)}
          className="bg-ink-900 border border-ink-700 rounded px-1.5 py-1 text-xs text-ink-100"
        >
          {vertentes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={intensityId}
          onChange={(e) => setIntensityId(e.target.value)}
          className="bg-ink-900 border border-ink-700 rounded px-1.5 py-1 text-xs text-ink-100"
        >
          {intensities.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {i.dice ? ` (${i.dice})` : ''}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[10px] text-ink-400">
          custo base
          <input
            type="number"
            min={0}
            value={baseCost}
            onChange={(e) => setBaseCost(Math.max(0, Number(e.target.value) || 0))}
            className="w-12 bg-ink-900 border border-ink-700 rounded px-1 py-1 text-xs text-ink-100 text-center"
            aria-label="Custo base (Forma + Alcance + Intensidade)"
          />
        </label>
      </div>
      {result && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {result.trained ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-ember-400/15 text-ember-300 border border-ember-400/40">
                treinado · rank {result.rank}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-blood-500/15 text-blood-300 border border-blood-400/40">
                não-treinado
              </span>
            )}
            <span className="text-ink-200">
              Energia: <span className="font-mono text-ember-300">{result.energyCost}</span>
              {result.surcharge > 0 && (
                <span className="text-blood-300"> (+{result.surcharge} sobretaxa)</span>
              )}
            </span>
          </div>
          {!result.trained && result.controlTestText && (
            <p className="text-xs text-ink-200">
              Teste de controle:{' '}
              <span className="font-mono text-blood-300">{result.controlTestText}</span>
              {result.governingAttr && (
                <span className="text-ink-500"> ({result.governingAttr})</span>
              )}
            </p>
          )}
          {!result.trained && (
            <p className="text-[10px] text-ink-500 italic">
              Falha = a conjuração fizzle e a Energia é gasta. Treine a Vertente (Rank 1+) pra
              remover sobretaxa e teste.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
