// Sprint C — helpers para árvores de talentos.
//
// As árvores moram em `data/trees/*.json` e seguem o shape `Tree` de
// `lib/types.ts`. Cada árvore tem `tiers[]`, e cada tier tem `abilities[]`
// com `cost` (XP) e `prerequisites[]`. O personagem guarda compras em
// `character.talents: Record<abilityId, level>` (level ≥ 1 = comprado).
//
// Este módulo é puro — consome `DataContext` + `Character` e devolve dados
// estruturados. Nenhum efeito colateral.

import type { AttrId, Prerequisite, Tree, TreeAbility, TreeTier } from '@/lib/types';
import type { Character } from './character';
import type { DataContext } from './context';
import { computeAttributes } from './attributes';

/** Árvore por id. `null` se inexistente. */
export function findTree(ctx: DataContext, id: string | null | undefined): Tree | null {
  if (!id) return null;
  return (ctx.trees ?? []).find((t) => t.id === id) ?? null;
}

/** Localiza uma habilidade por id em qualquer árvore. Retorna o contexto completo. */
export function findAbility(
  ctx: DataContext,
  abilityId: string | null | undefined
): { tree: Tree; tier: TreeTier; ability: TreeAbility } | null {
  if (!abilityId) return null;
  for (const tree of ctx.trees ?? []) {
    for (const tier of tree.tiers ?? []) {
      const ability = (tier.abilities ?? []).find((a) => a.id === abilityId);
      if (ability) return { tree, tier, ability };
    }
  }
  return null;
}

/** Custo XP de uma habilidade (fallback 0 se desconhecida). */
export function talentCost(ctx: DataContext, abilityId: string): number {
  return findAbility(ctx, abilityId)?.ability.cost ?? 0;
}

/** Lookup fechando sobre o `ctx` — injetável em `computeXP`. */
export function treeCostLookup(ctx: DataContext): (abilityId: string) => number {
  return (id) => talentCost(ctx, id);
}

/** Quantas habilidades compradas em cada tier da árvore. */
export function tierPurchaseCount(character: Character, tree: Tree, tier: TreeTier): number {
  let n = 0;
  for (const a of tier.abilities ?? []) {
    if ((character.talents ?? {})[a.id] && character.talents[a.id] > 0) n++;
  }
  return n;
}

/** Quantas habilidades compradas em cada árvore, no total. */
export function treePurchaseCount(character: Character, tree: Tree): number {
  let n = 0;
  for (const tier of tree.tiers ?? []) n += tierPurchaseCount(character, tree, tier);
  return n;
}

export interface AbilityAvailability {
  ok: boolean;
  owned: boolean;
  reasons: string[];
  cost: number;
}

/** Avalia prereqs/nível/slots para uma habilidade específica. Narra os motivos. */
export function abilityAvailability(
  ctx: DataContext,
  character: Character,
  tree: Tree,
  tier: TreeTier,
  ability: TreeAbility
): AbilityAvailability {
  const reasons: string[] = [];
  const owned = ((character.talents ?? {})[ability.id] ?? 0) > 0;
  const cost = ability.cost ?? 0;

  // 1) Nível mínimo do tier.
  if (tier.nivelMin && character.level < tier.nivelMin) {
    reasons.push(`Requer nível ${tier.nivelMin} (tier ${tier.tier}).`);
  }

  // 2) Prereqs do tier.
  for (const pr of tier.prerequisites ?? []) {
    const msg = evaluatePrerequisite(ctx, character, tree, pr);
    if (msg) reasons.push(msg);
  }

  // 3) Prereqs da habilidade.
  for (const pr of ability.prerequisites ?? []) {
    const msg = evaluatePrerequisite(ctx, character, tree, pr);
    if (msg) reasons.push(msg);
  }

  // 4) Slots do tier (apenas se a habilidade ainda não foi comprada — quem já
  //    comprou conta como ocupante do slot).
  if (!owned && typeof tier.slots === 'number' && tier.slots > 0) {
    const used = tierPurchaseCount(character, tree, tier);
    if (used >= tier.slots) {
      reasons.push(`Tier ${tier.tier} sem slots (${used}/${tier.slots}).`);
    }
  }

  return { ok: reasons.length === 0, owned, reasons, cost };
}

function evaluatePrerequisite(
  ctx: DataContext,
  character: Character,
  tree: Tree,
  pr: Prerequisite
): string | null {
  switch (pr.type) {
    case 'attribute': {
      if (!pr.attr || typeof pr.min !== 'number') return null;
      const attrs = computeAttributes(ctx, character);
      const have = attrs[pr.attr as AttrId]?.total ?? 0;
      if (have < pr.min) return `Requer ${pr.attr} ≥ ${pr.min} (atual ${have}).`;
      return null;
    }
    case 'level': {
      if (typeof pr.min !== 'number') return null;
      if (character.level < pr.min) return `Requer nível ${pr.min}.`;
      return null;
    }
    case 'proficiency': {
      if (!pr.id || typeof pr.minRank !== 'number') return null;
      const rank = (character.proficiencies ?? {})[pr.id] ?? 0;
      if (rank < pr.minRank) return `Requer proficiência '${pr.id}' R${pr.minRank}.`;
      return null;
    }
    case 'talent': {
      if (!pr.id) return null;
      if (!(character.talents ?? {})[pr.id]) return `Requer talento prévio '${pr.id}'.`;
      return null;
    }
    case 'custom': {
      // Regras em texto livre — quantidade de habilidades do tier anterior, etc.
      // Tentamos extrair números: "3+ habilidades Tier 1 de X" → conta no tree.
      const txt = pr.text ?? '';
      const m = txt.match(/(\d+)\+\s*habilidades?\s*Tier\s*(\d+)/i);
      if (m) {
        const need = Number(m[1]);
        const tierN = Number(m[2]);
        const tier = tree.tiers?.find((t) => t.tier === tierN);
        if (!tier) return null;
        const have = tierPurchaseCount(character, tree, tier);
        if (have < need) return `Requer ${need} habilidades de Tier ${tierN} (tem ${have}).`;
        return null;
      }
      // Sem heurística pronta — exibe o texto como aviso (não bloqueia).
      return null;
    }
    default:
      return null;
  }
}

/** Lista todas as abilities compradas do personagem, agrupadas por árvore. */
export function ownedTalentsByTree(
  ctx: DataContext,
  character: Character
): Array<{
  tree: Tree;
  entries: Array<{ tier: TreeTier; ability: TreeAbility; level: number }>;
}> {
  const out: Array<{
    tree: Tree;
    entries: Array<{ tier: TreeTier; ability: TreeAbility; level: number }>;
  }> = [];
  for (const tree of ctx.trees ?? []) {
    const entries: Array<{ tier: TreeTier; ability: TreeAbility; level: number }> = [];
    for (const tier of tree.tiers ?? []) {
      for (const ability of tier.abilities ?? []) {
        const lvl = (character.talents ?? {})[ability.id] ?? 0;
        if (lvl > 0) entries.push({ tier, ability, level: lvl });
      }
    }
    if (entries.length > 0) out.push({ tree, entries });
  }
  return out;
}
