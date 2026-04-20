// XP Ledger — modelo de duas pistas separadas:
//
//   1) XP TOTAL (character.xp)        → determina o nível via tabela de marcos.
//   2) XP DISPONÍVEL (budget de compra) → pontos gastáveis em Sub-Prof, Poder
//      Original e Talentos. Vem de progression.xpDisponivelPorNivel[level].
//
// XP gasto em compras NÃO desconta do total (regra do livro). São poços distintos.
// Este módulo é puro: recebe ctx + character e devolve o relatório.

import type { Character } from './character';
import { type DataContext, subProficiencyRules, originalPowerRanks } from './context';
import { treeCostLookup } from './trees';

export interface XPCostBreakdown {
  subProficiencies: number;
  originalPower: number;
  talents: number;
}

export interface XPBreakdown {
  /** XP total acumulado (determina nível). */
  total: number;
  /** Nível atual derivado de `total`. Clamped ao tamanho da tabela. */
  levelCurrent: number;
  /** Marco de XP necessário para o nível atual. */
  xpForCurrentLevel: number;
  /** Marco de XP para o próximo nível (null se está no topo). */
  xpForNextLevel: number | null;
  /** Quanto falta para o próximo nível (null se topo). */
  xpToNextLevel: number | null;
  /** XP de compra disponível no nível atual (pool separado). */
  available: number;
  /** Total já comprometido em compras (sub-prof + poder + talentos). */
  spent: number;
  /** available - spent. Pode ser negativo (violação). */
  remaining: number;
  breakdown: XPCostBreakdown;
  violations: string[];
}

/**
 * Devolve o nível dado o XP total. Consome ctx.progression.levels quando
 * presente; fallback para nível 1 se tabela indisponível.
 */
export function levelForXP(ctx: DataContext, xp: number): number {
  const table = ctx.progression?.levels;
  if (!table || table.length === 0) return 1;
  let level = 1;
  for (const row of table) {
    if (xp >= row.xpRequired) level = row.level;
    else break;
  }
  return level;
}

/** Marco de XP acumulado exigido para o nível. `null` se fora da tabela. */
export function xpForLevel(ctx: DataContext, level: number): number | null {
  const table = ctx.progression?.levels;
  if (!table) return null;
  const row = table.find((r) => r.level === level);
  return row ? row.xpRequired : null;
}

/** Próxima entrada na tabela após `level`; null se topo. */
export function xpForNextLevel(ctx: DataContext, level: number): number | null {
  const table = ctx.progression?.levels;
  if (!table) return null;
  const next = table.find((r) => r.level === level + 1);
  return next ? next.xpRequired : null;
}

/**
 * Custo de subir uma sub-proficiência UMA unidade até o rank `toRank`.
 * Usa a tabela em creation.subProficiencyRules.costXP (chaves "R1".."R5").
 */
export function subProficiencyRankCost(ctx: DataContext, toRank: number): number {
  if (toRank <= 0) return 0;
  const rules = subProficiencyRules(ctx);
  const key = `R${toRank}`;
  return rules.costXP[key] ?? 0;
}

/** Custo TOTAL acumulado para colocar uma sub-prof em `rank`, somando os passos. */
export function subProficiencyTotalCost(ctx: DataContext, rank: number): number {
  let sum = 0;
  for (let r = 1; r <= rank; r++) sum += subProficiencyRankCost(ctx, r);
  return sum;
}

/** Custo XP do rank atual do Poder Original (0 no R1, conforme creation.json). */
export function originalPowerRankCost(ctx: DataContext, rank: number): number {
  const row = originalPowerRanks(ctx).find((r) => r.rank === rank);
  return row?.xp ?? 0;
}

/** Custo XP somado do Poder Original do nível atual até R1. */
export function originalPowerTotalCost(ctx: DataContext, rank: number): number {
  if (rank <= 0) return 0;
  let sum = 0;
  for (let r = 1; r <= rank; r++) sum += originalPowerRankCost(ctx, r);
  return sum;
}

/** Custo XP somado dos talentos. Lê treeAbility.cost (passado ao engine via ctx futuramente). */
export function talentsCost(character: Character, costLookup?: (id: string) => number): number {
  let sum = 0;
  for (const [id, level] of Object.entries(character.talents ?? {})) {
    const unit = costLookup ? costLookup(id) : 0;
    sum += unit * level;
  }
  return sum;
}

/** XP de compra disponível no nível atual, lido de ctx.progression.arvores.xpDisponivelPorNivel. */
export function availableXPForLevel(ctx: DataContext, level: number): number {
  const table = ctx.progression?.arvores?.xpDisponivelPorNivel;
  if (!table) return 0;
  const row = table.find((r) => r.nivel === level);
  return row?.totalXP ?? 0;
}

export interface ComputeXPOptions {
  /** Lookup de custo por talento/árvore. Se omitido, talentos contam como 0. */
  talentCostLookup?: (id: string) => number;
}

export function computeXP(
  ctx: DataContext,
  character: Character,
  opts: ComputeXPOptions = {}
): XPBreakdown {
  const total = Math.max(0, character.xp ?? 0);
  const levelCurrent = Math.max(1, Math.min(character.level ?? 1, levelForXP(ctx, total)));
  const xpCurMark = xpForLevel(ctx, levelCurrent) ?? 0;
  const xpNextMark = xpForNextLevel(ctx, levelCurrent);
  const xpToNext = xpNextMark !== null ? Math.max(0, xpNextMark - total) : null;

  let subSpent = 0;
  for (const rank of Object.values(character.subProficiencies ?? {})) {
    subSpent += subProficiencyTotalCost(ctx, rank);
  }

  const powerSpent = character.originalPower
    ? originalPowerTotalCost(ctx, character.originalPower.rank ?? 1)
    : 0;

  const talentsSpent = talentsCost(
    character,
    opts.talentCostLookup ?? (ctx.trees ? treeCostLookup(ctx) : undefined)
  );

  const breakdown: XPCostBreakdown = {
    subProficiencies: subSpent,
    originalPower: powerSpent,
    talents: talentsSpent
  };

  const spent = breakdown.subProficiencies + breakdown.originalPower + breakdown.talents;
  const available = availableXPForLevel(ctx, levelCurrent);
  const remaining = available - spent;

  const violations: string[] = [];
  if (remaining < 0) violations.push(`XP disponível excedido em ${-remaining}.`);

  return {
    total,
    levelCurrent,
    xpForCurrentLevel: xpCurMark,
    xpForNextLevel: xpNextMark,
    xpToNextLevel: xpToNext,
    available,
    spent,
    remaining,
    breakdown,
    violations
  };
}
