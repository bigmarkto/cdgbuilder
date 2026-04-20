import { describe, expect, it } from 'vitest';
import {
  findCondition,
  conditionStage,
  conditionEffects,
  listConditions,
  isStaged,
  maxStage,
  type ConditionsTable
} from '../conditions';

const T: ConditionsTable = {
  id: 'condicoes',
  conditions: [
    {
      id: 'sangrando',
      name: 'Sangrando',
      effects: [{ type: 'dot', text: 'Sofre 1d4 por turno.' }]
    },
    {
      id: 'ferido',
      name: 'Ferido',
      effects: [{ type: 'status', text: 'Desvantagem em atributos físicos.' }],
      stages: [
        { stage: 1, name: 'leve', effects: [{ type: 'hp', text: '-2 HP máximo' }] },
        { stage: 2, name: 'grave', effects: [{ type: 'hp', text: '-4 HP máximo' }] },
        { stage: 3, name: 'crítico', effects: [{ type: 'hp', text: 'metade de HP máximo' }] }
      ]
    },
    { id: 'átono', name: 'Átono' },
    { id: 'cego', name: 'Cego' }
  ]
};

describe('findCondition', () => {
  it('acha por id exato', () => {
    expect(findCondition(T, 'sangrando')?.name).toBe('Sangrando');
  });

  it('é case-insensitive', () => {
    expect(findCondition(T, 'SANGRANDO')?.id).toBe('sangrando');
    expect(findCondition(T, 'Ferido')?.id).toBe('ferido');
  });

  it('trim whitespace', () => {
    expect(findCondition(T, '  ferido  ')?.id).toBe('ferido');
  });

  it('retorna null para id vazio ou inexistente', () => {
    expect(findCondition(T, '')).toBeNull();
    expect(findCondition(T, 'zombie')).toBeNull();
  });
});

describe('conditionStage', () => {
  const ferido = findCondition(T, 'ferido')!;
  const sangrando = findCondition(T, 'sangrando')!;

  it('retorna o estágio pedido', () => {
    expect(conditionStage(ferido, 2)?.name).toBe('grave');
  });

  it('retorna null se condição não tem estágios', () => {
    expect(conditionStage(sangrando, 1)).toBeNull();
  });

  it('retorna null para stage fora da faixa', () => {
    expect(conditionStage(ferido, 99)).toBeNull();
    expect(conditionStage(ferido, 0)).toBeNull();
  });
});

describe('conditionEffects', () => {
  const ferido = findCondition(T, 'ferido')!;
  const sangrando = findCondition(T, 'sangrando')!;

  it('sem estágios: retorna os effects base', () => {
    const fx = conditionEffects(sangrando);
    expect(fx).toHaveLength(1);
    expect(fx[0].text).toContain('1d4');
  });

  it('com estágios mas sem stage informado: só os base', () => {
    const fx = conditionEffects(ferido);
    expect(fx).toHaveLength(1);
    expect(fx[0].type).toBe('status');
  });

  it('com estágios: acumula base + estágio', () => {
    const fx = conditionEffects(ferido, 2);
    expect(fx).toHaveLength(2);
    expect(fx[0].type).toBe('status');
    expect(fx[1].text).toContain('-4 HP');
  });

  it('stage inexistente: devolve só os base (não quebra)', () => {
    const fx = conditionEffects(ferido, 99);
    expect(fx).toHaveLength(1);
  });
});

describe('listConditions', () => {
  it('ordena alfabeticamente por nome com acentos PT-BR', () => {
    const list = listConditions(T);
    const names = list.map((c) => c.name);
    expect(names[0]).toBe('Átono'); // PT-BR trata "Á" ~ "A"
    expect(names).toContain('Cego');
    expect(names.indexOf('Cego')).toBeLessThan(names.indexOf('Ferido'));
    expect(names.indexOf('Ferido')).toBeLessThan(names.indexOf('Sangrando'));
  });
});

describe('isStaged / maxStage', () => {
  const ferido = findCondition(T, 'ferido')!;
  const sangrando = findCondition(T, 'sangrando')!;

  it('isStaged reflete presença de stages', () => {
    expect(isStaged(ferido)).toBe(true);
    expect(isStaged(sangrando)).toBe(false);
  });

  it('maxStage pega o maior level', () => {
    expect(maxStage(ferido)).toBe(3);
    expect(maxStage(sangrando)).toBe(0);
  });
});
