import { describe, expect, it } from 'vitest';
import {
  findCoverTier,
  coverEffect,
  bestCover,
  listCoverTiers,
  type CoverTable,
  type CoverTier
} from '../cover';

const T: CoverTable = {
  id: 'cobertura',
  tiers: [
    { id: 'nenhuma', name: 'Nenhuma', dpBonus: 0, reflexBonus: 0 },
    { id: 'leve', name: 'Leve', dpBonus: 1, reflexBonus: 1 },
    { id: 'padrao', name: 'Padrão', dpBonus: 2, reflexBonus: 2 },
    { id: 'superior', name: 'Superior', dpBonus: 4, reflexBonus: 4 },
    {
      id: 'total',
      name: 'Total',
      dpBonus: null,
      reflexBonus: null,
      blocksLineOfSight: true
    }
  ]
};

describe('findCoverTier', () => {
  it('acha por id', () => {
    expect(findCoverTier(T, 'padrao')?.dpBonus).toBe(2);
  });

  it('retorna null para id vazio ou inválido', () => {
    expect(findCoverTier(T, '')).toBeNull();
    expect(findCoverTier(T, 'inexistente')).toBeNull();
  });
});

describe('coverEffect', () => {
  it('tier null → efeito neutro', () => {
    expect(coverEffect(null)).toEqual({
      dpBonus: 0,
      reflexBonus: 0,
      blocksLineOfSight: false
    });
  });

  it('tier numérico → passa valores crus', () => {
    const eff = coverEffect(findCoverTier(T, 'superior'));
    expect(eff.dpBonus).toBe(4);
    expect(eff.reflexBonus).toBe(4);
    expect(eff.blocksLineOfSight).toBe(false);
  });

  it('tier total → zera bônus mas seta blocksLineOfSight', () => {
    const eff = coverEffect(findCoverTier(T, 'total'));
    expect(eff.dpBonus).toBe(0);
    expect(eff.reflexBonus).toBe(0);
    expect(eff.blocksLineOfSight).toBe(true);
  });
});

describe('bestCover', () => {
  it('array vazio → null', () => {
    expect(bestCover([])).toBeNull();
  });

  it('um tier só → ele mesmo', () => {
    const t = findCoverTier(T, 'leve')!;
    expect(bestCover([t])?.id).toBe('leve');
  });

  it('pega maior dpBonus quando todos numéricos', () => {
    const tiers = [
      findCoverTier(T, 'leve')!,
      findCoverTier(T, 'padrao')!,
      findCoverTier(T, 'superior')!
    ];
    expect(bestCover(tiers)?.id).toBe('superior');
  });

  it('total vence todos os numéricos', () => {
    const tiers = [
      findCoverTier(T, 'superior')!,
      findCoverTier(T, 'total')!
    ];
    expect(bestCover(tiers)?.id).toBe('total');
  });

  it('total vs total (par): mantém primeiro (reduce preserva base em empate)', () => {
    const total: CoverTier = findCoverTier(T, 'total')!;
    const result = bestCover([total, total]);
    expect(result?.id).toBe('total');
  });
});

describe('listCoverTiers', () => {
  it('ordena do menor bônus pro maior, com total por último', () => {
    const list = listCoverTiers(T);
    const ids = list.map((t) => t.id);
    expect(ids[0]).toBe('nenhuma');
    expect(ids[ids.length - 1]).toBe('total');
    expect(ids).toEqual(['nenhuma', 'leve', 'padrao', 'superior', 'total']);
  });
});
