import { describe, expect, it } from 'vitest';
import {
  rowForMeters,
  surfaceModifier,
  multiplyDice,
  fallDamage,
  type FallTable
} from '../fall';

const T: FallTable = {
  id: 'queda',
  damageType: 'contundente',
  capDice: '20d6',
  table: [
    { id: 'trivial', minMeters: 0, maxMeters: 2, dice: '0' },
    { id: 'baixa', minMeters: 3, maxMeters: 5, dice: '1d6' },
    { id: 'moderada', minMeters: 6, maxMeters: 10, dice: '2d6' },
    { id: 'alta', minMeters: 11, maxMeters: 20, dice: '4d6' },
    { id: 'critica', minMeters: 21, maxMeters: 60, dice: '10d6' },
    { id: 'letal', minMeters: 61, maxMeters: null, dice: '20d6' }
  ],
  surfaceModifiers: [
    { id: 'macia', name: 'Macia', multiplier: 0.5 },
    { id: 'rigida', name: 'Rígida', multiplier: 1 },
    { id: 'letal', name: 'Espinhos', multiplier: 1.5 }
  ],
  reductions: []
};

describe('rowForMeters', () => {
  it('pega a faixa correta para o meio da faixa', () => {
    expect(rowForMeters(T, 7).id).toBe('moderada');
    expect(rowForMeters(T, 15).id).toBe('alta');
  });

  it('pega faixa trivial em 0m e 2m', () => {
    expect(rowForMeters(T, 0).id).toBe('trivial');
    expect(rowForMeters(T, 2).id).toBe('trivial');
  });

  it('transição exata entre faixas (3m entra em baixa)', () => {
    expect(rowForMeters(T, 3).id).toBe('baixa');
    expect(rowForMeters(T, 5).id).toBe('baixa');
    expect(rowForMeters(T, 6).id).toBe('moderada');
  });

  it('faixa terminal (maxMeters null) captura alturas extremas', () => {
    expect(rowForMeters(T, 61).id).toBe('letal');
    expect(rowForMeters(T, 500).id).toBe('letal');
    expect(rowForMeters(T, 9999).id).toBe('letal');
  });

  it('números negativos viram 0', () => {
    expect(rowForMeters(T, -5).id).toBe('trivial');
  });

  it('fracionário usa floor (3.9m → 3)', () => {
    expect(rowForMeters(T, 3.9).id).toBe('baixa');
  });
});

describe('surfaceModifier', () => {
  it('pega por id', () => {
    expect(surfaceModifier(T, 'macia')?.multiplier).toBe(0.5);
  });

  it('null/undefined/inexistente → null', () => {
    expect(surfaceModifier(T, null)).toBeNull();
    expect(surfaceModifier(T, undefined)).toBeNull();
    expect(surfaceModifier(T, 'inexistente')).toBeNull();
  });
});

describe('multiplyDice', () => {
  it('fator 1 mantém', () => {
    expect(multiplyDice('2d6', 1)).toBe('2d6');
  });

  it('fator 0.5 arredonda para cima (Math.ceil)', () => {
    expect(multiplyDice('4d6', 0.5)).toBe('2d6');
    expect(multiplyDice('3d6', 0.5)).toBe('2d6'); // ceil(1.5) = 2
    expect(multiplyDice('1d6', 0.5)).toBe('1d6'); // ceil(0.5) = 1
  });

  it('fator 1.5 cresce', () => {
    expect(multiplyDice('2d6', 1.5)).toBe('3d6');
  });

  it('"0" permanece "0"', () => {
    expect(multiplyDice('0', 10)).toBe('0');
  });

  it('string vazia → "0"', () => {
    expect(multiplyDice('', 2)).toBe('0');
  });

  it('formato inesperado → passa raw (sem quebrar)', () => {
    // Documentado: formato não-NdM é devolvido como está.
    expect(multiplyDice('2d6+3', 2)).toBe('2d6+3');
    expect(multiplyDice('flat 10', 2)).toBe('flat 10');
  });

  it('fator 0 → "0"', () => {
    expect(multiplyDice('4d6', 0)).toBe('0');
  });
});

describe('fallDamage (integração)', () => {
  it('0m de queda → dano 0', () => {
    const r = fallDamage(T, 0);
    expect(r.baseDice).toBe('0');
    expect(r.finalDice).toBe('0');
    expect(r.row.id).toBe('trivial');
  });

  it('10m em superfície rígida → 2d6', () => {
    const r = fallDamage(T, 10, { surfaceId: 'rigida' });
    expect(r.baseDice).toBe('2d6');
    expect(r.finalDice).toBe('2d6');
  });

  it('10m em superfície macia → metade (1d6)', () => {
    const r = fallDamage(T, 10, { surfaceId: 'macia' });
    expect(r.finalDice).toBe('1d6');
    expect(r.surfaceApplied?.id).toBe('macia');
  });

  it('metersAfterReactions altera a linha (−3m por reflexos)', () => {
    // original 5m = baixa; após reflexos −3m → 2m = trivial
    const r = fallDamage(T, 5, { metersAfterReactions: 2 });
    expect(r.row.id).toBe('trivial');
    expect(r.finalDice).toBe('0');
  });

  it('abilityMultiplier 0.5 combina com surface multiplier', () => {
    // 10m (2d6) × 0.5 ability × 0.5 surface = 0.25 → ceil(0.5) = 1d6
    const r = fallDamage(T, 10, { surfaceId: 'macia', abilityMultiplier: 0.5 });
    expect(r.finalDice).toBe('1d6');
    expect(r.abilityMultiplier).toBe(0.5);
  });

  it('60m em superfície de espinhos (1.5) → 15d6', () => {
    const r = fallDamage(T, 60, { surfaceId: 'letal' });
    expect(r.baseDice).toBe('10d6');
    expect(r.finalDice).toBe('15d6');
  });

  it('damageType cai pro default quando tabela não define', () => {
    const noType: FallTable = { ...T, damageType: undefined };
    const r = fallDamage(noType, 10);
    expect(r.damageType).toBe('contundente');
  });
});
