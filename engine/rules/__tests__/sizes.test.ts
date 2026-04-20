import { describe, expect, it } from 'vitest';
import {
  sizeInfo,
  sortedSizes,
  sizeDelta,
  sizeAttackBonus,
  canGrapple,
  carryCapacity,
  type SizesTable
} from '../sizes';

const T: SizesTable = {
  id: 'tamanhos',
  sizes: [
    { id: 'miudo', name: 'Miúdo', order: -2, spaceMeters: 0.5, reachMeters: 0.5, attackMod: 2, stealthMod: 4, carryMult: 0.25 },
    { id: 'pequeno', name: 'Pequeno', order: -1, spaceMeters: 1, reachMeters: 1, attackMod: 1, stealthMod: 2, carryMult: 0.5 },
    { id: 'medio', name: 'Médio', order: 0, spaceMeters: 1.5, reachMeters: 1.5, attackMod: 0, stealthMod: 0, carryMult: 1 },
    { id: 'grande', name: 'Grande', order: 1, spaceMeters: 3, reachMeters: 3, attackMod: -1, stealthMod: -2, carryMult: 2 },
    { id: 'enorme', name: 'Enorme', order: 2, spaceMeters: 4.5, reachMeters: 4.5, attackMod: -2, stealthMod: -4, carryMult: 4 },
    { id: 'colossal', name: 'Colossal', order: 3, spaceMeters: 9, reachMeters: 9, attackMod: -3, stealthMod: -8, carryMult: 8 }
  ]
};

describe('sizeInfo', () => {
  it('acha por id', () => {
    expect(sizeInfo(T, 'medio')?.name).toBe('Médio');
  });

  it('null para id vazio ou inválido', () => {
    expect(sizeInfo(T, '')).toBeNull();
    expect(sizeInfo(T, 'inexistente')).toBeNull();
  });
});

describe('sortedSizes', () => {
  it('ordena por order crescente', () => {
    const list = sortedSizes(T);
    expect(list.map((s) => s.id)).toEqual([
      'miudo',
      'pequeno',
      'medio',
      'grande',
      'enorme',
      'colossal'
    ]);
  });

  it('não muta entrada', () => {
    const original = [...T.sizes];
    sortedSizes(T);
    expect(T.sizes).toEqual(original);
  });
});

describe('sizeDelta', () => {
  it('positivo se atacante maior', () => {
    expect(sizeDelta(T, 'grande', 'medio')).toBe(1);
    expect(sizeDelta(T, 'colossal', 'miudo')).toBe(5);
  });

  it('negativo se atacante menor', () => {
    expect(sizeDelta(T, 'pequeno', 'medio')).toBe(-1);
  });

  it('zero para mesma categoria', () => {
    expect(sizeDelta(T, 'medio', 'medio')).toBe(0);
  });

  it('null se algum id inválido', () => {
    expect(sizeDelta(T, 'blob', 'medio')).toBeNull();
    expect(sizeDelta(T, 'medio', 'blob')).toBeNull();
  });
});

describe('sizeAttackBonus', () => {
  it('bonus igual ao delta até ±3', () => {
    expect(sizeAttackBonus(T, 'grande', 'medio')).toBe(1);
    expect(sizeAttackBonus(T, 'pequeno', 'medio')).toBe(-1);
  });

  it('clamp +3 quando delta > 3', () => {
    expect(sizeAttackBonus(T, 'colossal', 'miudo')).toBe(3);
  });

  it('clamp -3 quando delta < -3', () => {
    expect(sizeAttackBonus(T, 'miudo', 'colossal')).toBe(-3);
  });

  it('0 se algum id inválido', () => {
    expect(sizeAttackBonus(T, 'blob', 'medio')).toBe(0);
  });
});

describe('canGrapple', () => {
  it('true para ≤ 1 de diferença', () => {
    expect(canGrapple(T, 'medio', 'medio')).toBe(true);
    expect(canGrapple(T, 'medio', 'grande')).toBe(true);
    expect(canGrapple(T, 'medio', 'pequeno')).toBe(true);
  });

  it('false para > 1 de diferença', () => {
    expect(canGrapple(T, 'medio', 'enorme')).toBe(false);
    expect(canGrapple(T, 'miudo', 'grande')).toBe(false);
  });

  it('false para id inválido', () => {
    expect(canGrapple(T, 'blob', 'medio')).toBe(false);
  });
});

describe('carryCapacity', () => {
  it('multiplica pelo carryMult (floor)', () => {
    expect(carryCapacity(T, 'medio', 100)).toBe(100);
    expect(carryCapacity(T, 'grande', 100)).toBe(200);
    expect(carryCapacity(T, 'pequeno', 100)).toBe(50);
    expect(carryCapacity(T, 'miudo', 100)).toBe(25);
  });

  it('aplica floor em fracionário', () => {
    expect(carryCapacity(T, 'miudo', 51)).toBe(12); // 51 * 0.25 = 12.75
  });

  it('retorna baseCarry se id inválido', () => {
    expect(carryCapacity(T, 'blob', 100)).toBe(100);
  });
});
