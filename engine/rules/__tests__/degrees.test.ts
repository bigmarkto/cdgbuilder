import { describe, expect, it } from 'vitest';
import {
  computeDegree,
  isSuccess,
  isCriticalSuccess,
  isCriticalFailure,
  type DegreesOfSuccessTable
} from '../degrees';

const T: DegreesOfSuccessTable = {
  id: 'graus',
  degrees: [
    { id: 'falha-critica', name: 'Falha Crítica', order: -2 },
    { id: 'falha', name: 'Falha', order: -1 },
    { id: 'sucesso', name: 'Sucesso', order: 1 },
    { id: 'sucesso-critico', name: 'Sucesso Crítico', order: 2 }
  ],
  naturalShift: {
    nat20: { delta: 1 },
    nat1: { delta: -1 }
  },
  margins: { criticalUpper: 10, criticalLower: -10 }
};

describe('computeDegree', () => {
  it('sucesso normal quando margem >= 0 e < upper', () => {
    const r = computeDegree(T, { natural: 10, modifier: 5, dt: 12 });
    expect(r.total).toBe(15);
    expect(r.margin).toBe(3);
    expect(r.degree.id).toBe('sucesso');
    expect(r.shifted).toBe(false);
  });

  it('falha normal quando margem < 0 e > lower', () => {
    const r = computeDegree(T, { natural: 5, modifier: 0, dt: 12 });
    expect(r.margin).toBe(-7);
    expect(r.degree.id).toBe('falha');
  });

  it('sucesso crítico quando margem >= upper (10)', () => {
    const r = computeDegree(T, { natural: 15, modifier: 10, dt: 12 });
    expect(r.margin).toBe(13);
    expect(r.degree.id).toBe('sucesso-critico');
  });

  it('falha crítica quando margem <= lower (-10)', () => {
    const r = computeDegree(T, { natural: 2, modifier: 0, dt: 15 });
    expect(r.margin).toBe(-13);
    expect(r.degree.id).toBe('falha-critica');
  });

  it('margem exata upper (10) é crítico', () => {
    const r = computeDegree(T, { natural: 10, modifier: 12, dt: 12 });
    expect(r.margin).toBe(10);
    expect(r.degree.id).toBe('sucesso-critico');
  });

  it('margem exata lower (-10) é falha crítica', () => {
    const r = computeDegree(T, { natural: 2, modifier: 0, dt: 12 });
    expect(r.margin).toBe(-10);
    expect(r.degree.id).toBe('falha-critica');
  });

  it('margem −9 (acima do lower) é só falha', () => {
    const r = computeDegree(T, { natural: 3, modifier: 0, dt: 12 });
    expect(r.margin).toBe(-9);
    expect(r.degree.id).toBe('falha');
  });

  it('margem 9 (abaixo do upper) é só sucesso', () => {
    const r = computeDegree(T, { natural: 15, modifier: 6, dt: 12 });
    expect(r.margin).toBe(9);
    expect(r.degree.id).toBe('sucesso');
  });

  it('nat20 promove um grau: falha → sucesso', () => {
    // natural 20, modifier 0, dt 25 → total 20, margin -5 = falha
    const r = computeDegree(T, { natural: 20, modifier: 0, dt: 25 });
    expect(r.baseDegree.id).toBe('falha');
    expect(r.degree.id).toBe('sucesso');
    expect(r.shifted).toBe(true);
  });

  it('nat20 em sucesso promove para crítico', () => {
    const r = computeDegree(T, { natural: 20, modifier: 0, dt: 15 });
    expect(r.baseDegree.id).toBe('sucesso');
    expect(r.degree.id).toBe('sucesso-critico');
    expect(r.shifted).toBe(true);
  });

  it('nat20 em crítico não passa do topo (clamp)', () => {
    const r = computeDegree(T, { natural: 20, modifier: 0, dt: 5 });
    expect(r.baseDegree.id).toBe('sucesso-critico');
    expect(r.degree.id).toBe('sucesso-critico');
    expect(r.shifted).toBe(false);
  });

  it('nat1 rebaixa um grau: sucesso → falha', () => {
    const r = computeDegree(T, { natural: 1, modifier: 20, dt: 15 });
    expect(r.baseDegree.id).toBe('sucesso');
    expect(r.degree.id).toBe('falha');
    expect(r.shifted).toBe(true);
  });

  it('nat1 em falha rebaixa para crítico', () => {
    // total=1, dt=5 → margin=-4 (falha, não crítica). nat1 shift → falha-crítica.
    const r = computeDegree(T, { natural: 1, modifier: 0, dt: 5 });
    expect(r.baseDegree.id).toBe('falha');
    expect(r.degree.id).toBe('falha-critica');
    expect(r.shifted).toBe(true);
  });

  it('nat1 em falha crítica não passa do fundo (clamp)', () => {
    const r = computeDegree(T, { natural: 1, modifier: 0, dt: 30 });
    expect(r.baseDegree.id).toBe('falha-critica');
    expect(r.degree.id).toBe('falha-critica');
    expect(r.shifted).toBe(false);
  });

  it('ignoreMargins bate sucesso ou falha simples sem crítico', () => {
    const r = computeDegree(T, { natural: 15, modifier: 20, dt: 12, ignoreMargins: true });
    expect(r.degree.id).toBe('sucesso');
    const r2 = computeDegree(T, { natural: 5, modifier: 0, dt: 30, ignoreMargins: true });
    expect(r2.degree.id).toBe('falha');
  });

  it('ignoreMargins respeita nat20/nat1 shift', () => {
    // ignoreMargins + nat20 em falha → sucesso
    const r = computeDegree(T, { natural: 20, modifier: 0, dt: 30, ignoreMargins: true });
    expect(r.baseDegree.id).toBe('falha');
    expect(r.degree.id).toBe('sucesso');
  });
});

describe('isSuccess / isCriticalSuccess / isCriticalFailure', () => {
  it('reconhecem todos os graus corretamente', () => {
    const critSuc = computeDegree(T, { natural: 20, modifier: 0, dt: 5 });
    const suc = computeDegree(T, { natural: 10, modifier: 5, dt: 12 });
    const fail = computeDegree(T, { natural: 5, modifier: 0, dt: 12 });
    const critFail = computeDegree(T, { natural: 1, modifier: 0, dt: 30 });

    expect(isCriticalSuccess(critSuc)).toBe(true);
    expect(isSuccess(critSuc)).toBe(true);
    expect(isSuccess(suc)).toBe(true);
    expect(isCriticalSuccess(suc)).toBe(false);
    expect(isSuccess(fail)).toBe(false);
    expect(isCriticalFailure(fail)).toBe(false);
    expect(isCriticalFailure(critFail)).toBe(true);
  });
});
