import { describe, expect, it } from 'vitest';
import {
  clampTraumaLevel,
  traumaStage,
  applyTrigger,
  recoverTrauma,
  atBreakingPoint,
  type TraumaTable
} from '../trauma';

const T: TraumaTable = {
  id: 'trauma',
  track: [
    { level: 0, id: 'estavel', name: 'Estável' },
    { level: 1, id: 'abalado', name: 'Abalado', effects: [{ type: 'mod', text: '-1 Vontade' }] },
    { level: 2, id: 'traumatizado', name: 'Traumatizado', effects: [{ type: 'mod', text: '-2 Vontade' }] },
    { level: 3, id: 'fragmentado', name: 'Fragmentado', effects: [{ type: 'mod', text: '-3 Vontade' }] },
    { level: 4, id: 'quebrado', name: 'Quebrado', effects: [{ type: 'terminal', text: 'Rola Cicatriz Psíquica' }] }
  ],
  triggers: [
    { id: 'morte-aliado', name: 'Morte de aliado', gain: 1, save: 'Vontade' },
    { id: 'horror-indizivel', name: 'Horror indizível', gain: 2 },
    { id: 'trivial', name: 'Gatilho leve', gain: 0 }
  ]
};

describe('clampTraumaLevel', () => {
  it('dentro da faixa permanece', () => {
    expect(clampTraumaLevel(T, 2)).toBe(2);
    expect(clampTraumaLevel(T, 0)).toBe(0);
    expect(clampTraumaLevel(T, 4)).toBe(4);
  });

  it('acima clampa no máximo', () => {
    expect(clampTraumaLevel(T, 10)).toBe(4);
  });

  it('abaixo clampa no mínimo', () => {
    expect(clampTraumaLevel(T, -5)).toBe(0);
  });

  it('fracionário usa floor', () => {
    expect(clampTraumaLevel(T, 2.9)).toBe(2);
    expect(clampTraumaLevel(T, 3.1)).toBe(3);
  });
});

describe('traumaStage', () => {
  it('retorna o estágio correto', () => {
    expect(traumaStage(T, 0).id).toBe('estavel');
    expect(traumaStage(T, 3).id).toBe('fragmentado');
    expect(traumaStage(T, 4).id).toBe('quebrado');
  });

  it('aplica clamp automaticamente', () => {
    expect(traumaStage(T, 99).id).toBe('quebrado');
    expect(traumaStage(T, -99).id).toBe('estavel');
  });
});

describe('applyTrigger', () => {
  it('gatilho sem save ganha o valor total', () => {
    const r = applyTrigger(T, 0, 'horror-indizivel', false);
    expect(r.gained).toBe(2);
    expect(r.level).toBe(2);
    expect(r.stage.id).toBe('traumatizado');
  });

  it('save reduz ganho em 1', () => {
    const r = applyTrigger(T, 0, 'horror-indizivel', true);
    expect(r.gained).toBe(1);
    expect(r.level).toBe(1);
  });

  it('save em trigger de gain 1 zera o ganho', () => {
    const r = applyTrigger(T, 0, 'morte-aliado', true);
    expect(r.gained).toBe(0);
    expect(r.level).toBe(0);
  });

  it('save em trigger de gain 0 não vira negativo (guarda Math.max 0)', () => {
    const r = applyTrigger(T, 0, 'trivial', true);
    expect(r.gained).toBe(0);
    expect(r.level).toBe(0);
  });

  it('acumula sobre o nível atual com clamp no máximo', () => {
    const r = applyTrigger(T, 3, 'horror-indizivel', false);
    expect(r.gained).toBe(2);
    expect(r.level).toBe(4);
    expect(r.stage.id).toBe('quebrado');
  });

  it('gatilho inexistente é no-op', () => {
    const r = applyTrigger(T, 2, 'inexistente', false);
    expect(r.gained).toBe(0);
    expect(r.level).toBe(2);
    expect(r.stage.id).toBe('traumatizado');
  });
});

describe('recoverTrauma', () => {
  it('reduz com clamp no mínimo', () => {
    const r = recoverTrauma(T, 3, 2);
    expect(r.level).toBe(1);
    expect(r.recovered).toBe(2);
    expect(r.stage.id).toBe('abalado');
  });

  it('recover além do mínimo não passa de 0', () => {
    const r = recoverTrauma(T, 1, 10);
    expect(r.level).toBe(0);
    expect(r.recovered).toBe(1);
  });

  it('amount negativo é ignorado (não vira aumento)', () => {
    const r = recoverTrauma(T, 2, -5);
    expect(r.level).toBe(2);
    expect(r.recovered).toBe(0);
  });
});

describe('atBreakingPoint', () => {
  it('false abaixo do máximo', () => {
    expect(atBreakingPoint(T, 3)).toBe(false);
    expect(atBreakingPoint(T, 0)).toBe(false);
  });

  it('true no máximo', () => {
    expect(atBreakingPoint(T, 4)).toBe(true);
  });

  it('true para valores acima (via clamp)', () => {
    expect(atBreakingPoint(T, 99)).toBe(true);
  });
});
