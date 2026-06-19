import { describe, expect, it } from 'vitest';
import { computeCastingCost, vertenteRank } from '../casting';
import { makeCtx, makeChar, INTENSITIES, UNTRAINED_RULES } from './_fixtures';

describe('vertenteRank', () => {
  it('lê o rank de proficiencies, 0 se ausente', () => {
    const char = makeChar({}, { braseira: 3 });
    expect(vertenteRank(char, 'braseira')).toBe(3);
    expect(vertenteRank(char, 'abissal')).toBe(0);
  });
});

describe('computeCastingCost — treinado', () => {
  it('sem sobretaxa e sem teste de controle', () => {
    // Braseira rank 2 (treinado). PRE 5 é o maior governante.
    const ctx = makeCtx();
    const char = makeChar({ PRE: 5, CON: 3, PER: 2 }, { braseira: 2 });
    const res = computeCastingCost(
      ctx,
      char,
      { vertenteId: 'braseira', baseEnergyCost: 3, intensityId: 'forte' },
      UNTRAINED_RULES,
      INTENSITIES
    );
    expect(res.trained).toBe(true);
    expect(res.surcharge).toBe(0);
    expect(res.energyCost).toBe(3);
    expect(res.controlDT).toBeNull();
    expect(res.controlTestText).toBeNull();
    expect(res.governingAttr).toBe('PRE'); // maior governante
  });
});

describe('computeCastingCost — não-treinado', () => {
  it('aplica sobretaxa por intensidade e monta o teste de controle', () => {
    // Braseira rank 0. PRE 4 maior governante. Intensidade forte: surcharge 3, DT 18.
    const ctx = makeCtx();
    const char = makeChar({ PRE: 4, CON: 2, PER: 1 }, {});
    const res = computeCastingCost(
      ctx,
      char,
      { vertenteId: 'braseira', baseEnergyCost: 3, intensityId: 'forte' },
      UNTRAINED_RULES,
      INTENSITIES
    );
    expect(res.trained).toBe(false);
    expect(res.surcharge).toBe(3); // forte
    expect(res.energyCost).toBe(6); // 3 base + 3
    expect(res.controlDT).toBe(18); // controlDT da intensidade forte
    // teste = PRE(4) + rank0(-4) = 0
    expect(res.controlTestBonus).toBe(0);
    expect(res.controlTestText).toBe('d20 +0 vs DT 18');
  });

  it('sobretaxa escala com a intensidade', () => {
    const ctx = makeCtx();
    const char = makeChar({ PRE: 3 }, {});
    const leve = computeCastingCost(ctx, char, { vertenteId: 'braseira', baseEnergyCost: 0, intensityId: 'leve' }, UNTRAINED_RULES, INTENSITIES);
    const dev = computeCastingCost(ctx, char, { vertenteId: 'braseira', baseEnergyCost: 0, intensityId: 'devastador' }, UNTRAINED_RULES, INTENSITIES);
    expect(leve.surcharge).toBe(1);
    expect(dev.surcharge).toBe(4);
  });

  it('teste de controle melhora com atributo alto mesmo sem treino', () => {
    const ctx = makeCtx();
    const baixo = makeChar({ PRE: 2 }, {});
    const alto = makeChar({ PRE: 8 }, {});
    const r1 = computeCastingCost(ctx, baixo, { vertenteId: 'braseira', baseEnergyCost: 1, intensityId: 'moderado' }, UNTRAINED_RULES, INTENSITIES);
    const r2 = computeCastingCost(ctx, alto, { vertenteId: 'braseira', baseEnergyCost: 1, intensityId: 'moderado' }, UNTRAINED_RULES, INTENSITIES);
    expect(r2.controlTestBonus!).toBeGreaterThan(r1.controlTestBonus!);
  });
});

describe('computeCastingCost — override de atributo', () => {
  it('respeita governingAttr passado explicitamente', () => {
    const ctx = makeCtx();
    const char = makeChar({ PRE: 4, CON: 7 }, { braseira: 1 });
    const res = computeCastingCost(
      ctx,
      char,
      { vertenteId: 'braseira', baseEnergyCost: 0, intensityId: 'leve', governingAttr: 'CON' },
      UNTRAINED_RULES,
      INTENSITIES
    );
    expect(res.governingAttr).toBe('CON');
  });
});
