'use client';

import { useMemo, useState } from 'react';
import type { DataContext } from '@/engine/context';
import type { Tree, TreeAbility, TreeTier } from '@/lib/types';
import {
  abilityAvailability,
  tierPurchaseCount,
  treePurchaseCount
} from '@/engine/trees';
import { computeXP } from '@/engine/xp';
import { useBuilderStore } from '@/lib/store';

/**
 * Sprint C — compra de talentos das árvores.
 *
 * Layout: abas horizontais por árvore (12), conteúdo mostra os tiers
 * empilhados com nível mínimo, slots e habilidades. Cada habilidade
 * exibe custo XP, prereqs resolvidos e botão comprar/vender.
 */
export function StepTalentos({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const setTalent = useBuilderStore((s) => s.setTalent);

  const trees = ctx.trees ?? [];
  const [activeTreeId, setActiveTreeId] = useState<string>(trees[0]?.id ?? '');
  const xp = computeXP(ctx, character);

  const activeTree = trees.find((t) => t.id === activeTreeId) ?? trees[0] ?? null;

  if (!activeTree) {
    return (
      <p className="text-sm text-ink-400">
        Nenhuma árvore de talentos carregada — verifique <code className="font-mono">data/trees/</code>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-ink-300">XP restante:</span>
        <span
          className={`font-mono text-sm ${
            xp.remaining < 0
              ? 'text-blood-400'
              : xp.remaining === 0
                ? 'text-ink-300'
                : 'text-ember-400'
          }`}
        >
          {xp.remaining}
        </span>
        <span className="text-ink-500">·</span>
        <span className="text-ink-300">
          Gasto em talentos: <span className="font-mono text-ember-400">{xp.breakdown.talents}</span>
        </span>
        <span className="text-ink-500">·</span>
        <span className="text-ink-300">
          Nível: <span className="font-mono text-ink-100">{xp.levelCurrent}</span>
        </span>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-ink-700 pb-2">
        {trees.map((t) => {
          const count = treePurchaseCount(character, t);
          const active = t.id === activeTree.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTreeId(t.id)}
              className={`rounded border px-2 py-1 text-xs transition-colors ${
                active
                  ? 'border-ember-400 bg-ember-400/10 text-ember-400'
                  : 'border-ink-700 text-ink-200 hover:bg-ink-800'
              }`}
            >
              {t.name}
              {count > 0 && (
                <span className="ml-1 rounded-full bg-ember-400/20 px-1 font-mono text-[10px] text-ember-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <TreePanel
        ctx={ctx}
        tree={activeTree}
        xpRemaining={xp.remaining}
        onBuy={(id) => setTalent(id, 1)}
        onSell={(id) => setTalent(id, 0)}
      />
    </div>
  );
}

function TreePanel({
  ctx,
  tree,
  xpRemaining,
  onBuy,
  onSell
}: {
  ctx: DataContext;
  tree: Tree;
  xpRemaining: number;
  onBuy: (abilityId: string) => void;
  onSell: (abilityId: string) => void;
}) {
  const character = useBuilderStore((s) => s.character);
  const attributeKey = (tree as unknown as { atributoChave?: string }).atributoChave ?? '';

  return (
    <section className="space-y-4">
      <header>
        <h3 className="font-serif text-xl text-ink-50">{tree.name}</h3>
        {attributeKey && (
          <p className="text-[11px] uppercase tracking-wider text-ink-400">
            Atributo chave: <span className="text-ember-400">{attributeKey}</span>
          </p>
        )}
        {tree.description && (
          <p className="text-xs text-ink-300 mt-1 leading-relaxed">{tree.description}</p>
        )}
      </header>

      <ul className="space-y-3">
        {(tree.tiers ?? []).map((tier) => (
          <TierBlock
            key={tier.tier}
            ctx={ctx}
            tree={tree}
            tier={tier}
            xpRemaining={xpRemaining}
            onBuy={onBuy}
            onSell={onSell}
            character={character}
          />
        ))}
      </ul>
    </section>
  );
}

function TierBlock({
  ctx,
  tree,
  tier,
  xpRemaining,
  onBuy,
  onSell,
  character
}: {
  ctx: DataContext;
  tree: Tree;
  tier: TreeTier;
  xpRemaining: number;
  onBuy: (abilityId: string) => void;
  onSell: (abilityId: string) => void;
  character: ReturnType<typeof useBuilderStore.getState>['character'];
}) {
  const used = useMemo(() => tierPurchaseCount(character, tree, tier), [character, tree, tier]);
  const tierLocked = tier.nivelMin ? character.level < tier.nivelMin : false;
  const slotsLabel =
    typeof tier.slots === 'number' ? `${used}/${tier.slots} slots` : `${used} comprados`;

  return (
    <li
      className={`rounded border ${
        tierLocked ? 'border-ink-800 bg-ink-900/30' : 'border-ink-700 bg-ink-900/60'
      } p-3`}
    >
      <header className="flex flex-wrap items-baseline gap-2 mb-2">
        <span className="font-mono text-ember-400 text-sm">T{tier.tier}</span>
        {tier.nome && <span className="font-serif text-ink-100">{tier.nome}</span>}
        <span className="text-[10px] uppercase tracking-wider text-ink-400">
          {slotsLabel}
        </span>
        {tier.nivelMin && (
          <span className="text-[10px] uppercase tracking-wider text-ink-400">
            nv mín {tier.nivelMin}
          </span>
        )}
        {tierLocked && (
          <span className="text-[10px] text-blood-400">
            destrava no nível {tier.nivelMin}
          </span>
        )}
      </header>

      {(tier.prerequisites ?? []).length > 0 && (
        <ul className="mb-2 text-[11px] text-ink-400 space-y-0.5">
          {(tier.prerequisites ?? []).map((pr, i) => (
            <li key={i}>• {pr.text ?? JSON.stringify(pr)}</li>
          ))}
        </ul>
      )}

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(tier.abilities ?? []).map((ability) => (
          <AbilityRow
            key={ability.id}
            ctx={ctx}
            tree={tree}
            tier={tier}
            ability={ability}
            xpRemaining={xpRemaining}
            onBuy={onBuy}
            onSell={onSell}
          />
        ))}
      </ul>
    </li>
  );
}

function AbilityRow({
  ctx,
  tree,
  tier,
  ability,
  xpRemaining,
  onBuy,
  onSell
}: {
  ctx: DataContext;
  tree: Tree;
  tier: TreeTier;
  ability: TreeAbility;
  xpRemaining: number;
  onBuy: (abilityId: string) => void;
  onSell: (abilityId: string) => void;
}) {
  const character = useBuilderStore((s) => s.character);
  const info = abilityAvailability(ctx, character, tree, tier, ability);
  const canAfford = xpRemaining - info.cost >= 0;
  const canBuy = !info.owned && info.ok && canAfford;

  return (
    <li
      className={`rounded border p-2 text-xs transition-colors ${
        info.owned
          ? 'border-ember-400 bg-ember-400/10'
          : 'border-ink-700 bg-ink-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-ink-50 font-medium leading-tight">{ability.name}</p>
          {ability.description && (
            <p className="text-ink-300 mt-0.5 leading-snug">{ability.description}</p>
          )}
          {info.reasons.length > 0 && !info.owned && (
            <ul className="mt-1 text-blood-400 space-y-0.5">
              {info.reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
          {!info.owned && info.ok && !canAfford && (
            <p className="mt-1 text-blood-400">• XP insuficiente (falta {info.cost - xpRemaining}).</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-mono text-[10px] text-ink-400">{info.cost} XP</span>
          {info.owned ? (
            <button
              onClick={() => onSell(ability.id)}
              className="rounded border border-blood-500/60 text-blood-400 px-2 py-0.5 text-[11px] hover:bg-blood-500/10"
              title="Reembolsar"
            >
              vender
            </button>
          ) : (
            <button
              onClick={() => onBuy(ability.id)}
              disabled={!canBuy}
              className="rounded bg-ember-400 text-ink-900 px-2 py-0.5 text-[11px] font-medium disabled:bg-ink-700 disabled:text-ink-400"
            >
              comprar
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
