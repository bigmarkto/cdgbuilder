// Action economy — orçamento de ações por rodada.
//
// Modelo (data/rules/acoes.json): cada personagem tem por padrão
//   1 Padrão + 1 Movimento + 1 Bônus + 1 Reação por rodada.
// Builds podem conceder ações extras via modificadores nos targets
//   action.standard / action.move / action.bonus / action.reaction.
//
// Módulo PURO: recebe a tabela + os mods já coletados e devolve o orçamento.
// A engine não rastreia o estado de combate (quantas já foram gastas) — isso
// é responsabilidade da UI (tracker na ficha). Aqui só calculamos o teto.

import type { Character } from './character';
import type { DataContext } from './context';
import { collectModifiers } from './modifiers';
import { resolveNumber } from './effects';

export type ActionType = 'standard' | 'move' | 'bonus' | 'reaction';

export const ACTION_TYPES: ActionType[] = ['standard', 'move', 'bonus', 'reaction'];

export interface ActionBudget {
  standard: number;
  move: number;
  bonus: number;
  reaction: number;
}

export interface ActionTypeInfo {
  id: ActionType;
  name: string;
  description: string;
  affectsOthers: boolean;
}

export interface ActionsTable {
  id: string;
  name?: string;
  baseBudget?: Partial<ActionBudget>;
  types?: ActionTypeInfo[];
  rules?: string[];
  cooldownModel?: {
    description?: string;
    field?: string;
    unit?: string;
    notes?: string[];
  };
}

const DEFAULT_BUDGET: ActionBudget = { standard: 1, move: 1, bonus: 1, reaction: 1 };

/** Orçamento base lido da tabela, com fallback pro padrão 1/1/1/1. */
function baseBudget(table?: ActionsTable): ActionBudget {
  const b = table?.baseBudget ?? {};
  return {
    standard: b.standard ?? DEFAULT_BUDGET.standard,
    move: b.move ?? DEFAULT_BUDGET.move,
    bonus: b.bonus ?? DEFAULT_BUDGET.bonus,
    reaction: b.reaction ?? DEFAULT_BUDGET.reaction
  };
}

/**
 * Calcula o orçamento de ações por rodada do personagem, aplicando
 * modificadores de build (talentos/traços que concedem ações extras).
 *
 * Cada tipo é resolvido pelo pipeline de mods no target `action.<tipo>`.
 * Resultado nunca fica abaixo de 0.
 */
export function computeActionBudget(
  ctx: DataContext,
  character: Character,
  table?: ActionsTable
): ActionBudget {
  const base = baseBudget(table ?? ctx.rules?.acoes);
  const mods = collectModifiers(ctx, character);

  const out = {} as ActionBudget;
  for (const t of ACTION_TYPES) {
    const resolved = resolveNumber(base[t], mods, `action.${t}`);
    out[t] = Math.max(0, resolved.value);
  }
  return out;
}

/** Info de um tipo de ação (rótulo/descrição) a partir da tabela. */
export function actionTypeInfo(
  table: ActionsTable | undefined,
  type: ActionType
): ActionTypeInfo | null {
  return table?.types?.find((t) => t.id === type) ?? null;
}
