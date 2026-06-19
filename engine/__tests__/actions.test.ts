import { describe, expect, it } from 'vitest';
import { computeActionBudget, actionTypeInfo, ACTION_TYPES } from '../actions';
import { makeCtx, makeChar, ACOES } from './_fixtures';

describe('computeActionBudget', () => {
  it('devolve o orçamento base 1/1/1/1 sem mods', () => {
    const ctx = makeCtx();
    const char = makeChar({ POT: 3 });
    const budget = computeActionBudget(ctx, char);
    expect(budget).toEqual({ standard: 1, move: 1, bonus: 1, reaction: 1 });
  });

  it('cobre todos os tipos de ação declarados', () => {
    const ctx = makeCtx();
    const budget = computeActionBudget(ctx, makeChar({}));
    for (const t of ACTION_TYPES) {
      expect(budget[t]).toBeGreaterThanOrEqual(0);
    }
  });

  it('usa fallback 1/1/1/1 quando a tabela não tem baseBudget', () => {
    const ctx = makeCtx({ rules: { acoes: { id: 'x' } } });
    const budget = computeActionBudget(ctx, makeChar({}));
    expect(budget).toEqual({ standard: 1, move: 1, bonus: 1, reaction: 1 });
  });

  it('respeita baseBudget customizado da tabela', () => {
    const ctx = makeCtx({
      rules: { acoes: { id: 'x', baseBudget: { standard: 2, move: 1, bonus: 0, reaction: 1 } } }
    });
    const budget = computeActionBudget(ctx, makeChar({}));
    expect(budget.standard).toBe(2);
    expect(budget.bonus).toBe(0);
  });

  it('nunca devolve valor negativo', () => {
    const ctx = makeCtx({
      rules: { acoes: { id: 'x', baseBudget: { standard: -5, move: 1, bonus: 1, reaction: 1 } } }
    });
    const budget = computeActionBudget(ctx, makeChar({}));
    expect(budget.standard).toBe(0);
  });
});

describe('actionTypeInfo', () => {
  it('encontra o tipo pela id', () => {
    const table = { ...ACOES, types: [{ id: 'standard' as const, name: 'Padrão', description: '...', affectsOthers: true }] };
    expect(actionTypeInfo(table, 'standard')?.name).toBe('Padrão');
  });

  it('devolve null pra tipo ausente', () => {
    expect(actionTypeInfo(ACOES, 'standard')).toBeNull();
  });
});
