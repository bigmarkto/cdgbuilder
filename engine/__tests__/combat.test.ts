import { describe, expect, it } from 'vitest';
import { computeAttack } from '../combat';
import { makeCtx, makeChar } from './_fixtures';

describe('computeAttack — corpo-a-corpo (POT)', () => {
  it('soma POT + bônus de rank no acerto e POT cheio no dano', () => {
    // POT 4, luta-armada rank 3 (bônus +4).
    const ctx = makeCtx();
    const char = makeChar({ POT: 4 }, { 'luta-armada': 3 });
    const atk = computeAttack(ctx, char, { categoryId: 'corpo', weaponDice: '1d8' });
    expect(atk.toHitBonus).toBe(4 + 4); // POT + rank
    expect(atk.damageBonus).toBe(4); // floor(POT x 1)
    expect(atk.toHitText).toBe('d20 +8');
    expect(atk.damageText).toBe('1d8 +4');
  });

  it('rank 0 (Nenhum) aplica -4 no acerto', () => {
    const ctx = makeCtx();
    const char = makeChar({ POT: 5 }, {}); // sem proficiência
    const atk = computeAttack(ctx, char, { categoryId: 'corpo', weaponDice: '1d10' });
    expect(atk.toHitBonus).toBe(5 - 4); // POT + rank0(-4)
    expect(atk.proficiencyRank).toBe(0);
  });
});

describe('computeAttack — à distância (AGI meio dano)', () => {
  it('usa AGI no acerto e metade do AGI no dano', () => {
    // AGI 5, atirar rank 2 (+2). dano = floor(5 x 0.5) = 2.
    const ctx = makeCtx();
    const char = makeChar({ AGI: 5 }, { atirar: 2 });
    const atk = computeAttack(ctx, char, { categoryId: 'distancia', weaponDice: '1d8' });
    expect(atk.toHitBonus).toBe(5 + 2);
    expect(atk.damageBonus).toBe(2); // floor(5 * 0.5)
  });
});

describe('computeAttack — acuidade (AGI cheio)', () => {
  it('dá a builds de AGI dano cheio', () => {
    const ctx = makeCtx();
    const char = makeChar({ AGI: 6 }, { 'luta-armada': 1 });
    const atk = computeAttack(ctx, char, { categoryId: 'acuidade', weaponDice: '1d6' });
    expect(atk.damageBonus).toBe(6); // floor(6 x 1)
    expect(atk.toHitAttr).toBe('AGI');
  });
});

describe('computeAttack — bônus de arma', () => {
  it('soma weaponToHitBonus e weaponDamageBonus', () => {
    const ctx = makeCtx();
    const char = makeChar({ POT: 3 }, { 'luta-armada': 2 });
    const atk = computeAttack(ctx, char, {
      categoryId: 'corpo',
      weaponDice: '1d8',
      weaponToHitBonus: 1,
      weaponDamageBonus: 2
    });
    expect(atk.toHitBonus).toBe(3 + 2 + 1); // POT + rank + arma
    expect(atk.damageBonus).toBe(3 + 2); // POT + arma
  });
});

describe('computeAttack — desarmado usa baseDamage', () => {
  it('cai pra 1d4 quando weaponDice é omitido', () => {
    const ctx = makeCtx();
    const char = makeChar({ POT: 2 }, {});
    const atk = computeAttack(ctx, char, { categoryId: 'desarmado' });
    expect(atk.weaponDice).toBe('1d4');
  });
});

describe('computeAttack — categoria desconhecida', () => {
  it('devolve resultado neutro sem quebrar', () => {
    const ctx = makeCtx();
    const atk = computeAttack(ctx, makeChar({ POT: 5 }), { categoryId: 'inexistente' });
    expect(atk.toHitBonus).toBe(0);
    expect(atk.damageBonus).toBe(0);
  });
});
