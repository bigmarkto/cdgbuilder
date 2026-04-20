import type { Character } from './character';
import {
  type DataContext,
  proficiencyBudget,
  subProficiencyRules
} from './context';

export interface ProficiencyBudgetStatus {
  total: number;
  spent: number;
  remaining: number;
  valid: boolean;
  violations: string[];
}

/** Cada Rank custa `rank` pontos cumulativamente (R1=1, R2=2, R3=3…). */
export function proficiencySpent(character: Character): number {
  return Object.values(character.proficiencies).reduce((sum, rank) => sum + rank, 0);
}

export function proficiencyBudgetStatus(ctx: DataContext, character: Character): ProficiencyBudgetStatus {
  const rules = proficiencyBudget(ctx);
  const total = rules.initialPoints ?? 12;
  const spent = proficiencySpent(character);
  const remaining = total - spent;
  const violations: string[] = [];
  const maxRank = effectiveMaxRank(ctx, character);

  if (remaining < 0) violations.push(`Excedeu em ${-remaining} ponto(s).`);

  for (const [id, rank] of Object.entries(character.proficiencies)) {
    if (rank < 0) violations.push(`'${id}' tem rank negativo.`);
    if (rank > maxRank) {
      violations.push(`'${id}' rank ${rank} acima do máximo (${maxRank}).`);
    }
  }

  return {
    total,
    spent,
    remaining,
    valid: remaining === 0 && violations.length === 0,
    violations
  };
}

export function effectiveMaxRank(ctx: DataContext, character: Character): number {
  const rules = proficiencyBudget(ctx);
  // Criação: fixo em maxRankAtCreation (ex: 2).
  // Depois: fórmula "nível / 2 arredondado para cima", capped em 6.
  if (character.level <= 1) return rules.maxRankAtCreation ?? 2;
  const byLevel = Math.ceil(character.level / 2);
  return Math.min(6, Math.max(rules.maxRankAtCreation ?? 2, byLevel));
}

export function proficiencyRank(character: Character, id: string): number {
  return character.proficiencies[id] ?? 0;
}

// ---------- Sub-Proficiências ----------

export function subProficiencyRank(character: Character, id: string): number {
  return character.subProficiencies?.[id] ?? 0;
}

/** Rank máximo de sub-proficiência permitido pelo nível do personagem. */
export function subProficiencyMaxRank(ctx: DataContext, character: Character): number {
  const rules = subProficiencyRules(ctx);
  const level = Math.max(1, character.level);
  let best = 0;
  for (const [key, min] of Object.entries(rules.levelRequirements)) {
    const rank = parseInt(key.replace(/^R/i, ''), 10);
    if (!Number.isFinite(rank)) continue;
    if (level >= min) best = Math.max(best, rank);
  }
  return best;
}

/**
 * Valida a regra de pré-requisito "Sub Rank N requer Prof Básica Rank N+1".
 * Precisa conhecer o parentId (prof básica) da sub — passa-se como parâmetro.
 */
export function subProficiencyPrereqMet(
  character: Character,
  parentProficiencyId: string | null | undefined,
  targetRank: number
): boolean {
  if (!parentProficiencyId) return true;
  const parentRank = proficiencyRank(character, parentProficiencyId);
  return parentRank >= targetRank + 1;
}

export interface SubProficiencyCheck {
  ok: boolean;
  maxRank: number;
  violations: string[];
}

/** Checagem de consistência da coleção inteira de sub-proficiências. */
export function subProficiencyStatus(
  ctx: DataContext,
  character: Character,
  parentLookup: (subId: string) => string | null | undefined
): SubProficiencyCheck {
  const violations: string[] = [];
  const maxRank = subProficiencyMaxRank(ctx, character);

  for (const [subId, rank] of Object.entries(character.subProficiencies ?? {})) {
    if (rank <= 0) continue;
    if (rank > maxRank) {
      violations.push(`'${subId}' rank ${rank} acima do máximo por nível (${maxRank}).`);
    }
    const parent = parentLookup(subId);
    if (!subProficiencyPrereqMet(character, parent, rank)) {
      violations.push(`'${subId}' R${rank} requer '${parent}' em Rank ${rank + 1}+.`);
    }
  }

  return { ok: violations.length === 0, maxRank, violations };
}
