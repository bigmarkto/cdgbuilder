// Cálculo dos valores derivados. As fórmulas vêm do data/meta/derived.json
// (que é documento autoritativo), mas são implementadas aqui em código
// para não precisar de eval. Quando o JSON mudar, atualizar aqui também.
//
// Sprint D: após cada fórmula base, passa pelo pipeline de `EffectModifier`
// usando `resolveNumber` sobre o target `derived.<KEY>`. Talentos, traits
// raciais e fraquezas com mods estruturados (ex: HP_MAX +5, DP +1, speed +3)
// passam a refletir no resultado.

import type { AttrId, Vertente } from '@/lib/types';
import type { Character } from './character';
import { computeAttributes, maxPrincipalAttribute } from './attributes';
import { type DataContext, findRace, racialBaseSpeed, racialHitDie } from './context';
import { type EffectModifier, resolveNumber } from './effects';
import { collectModifiers } from './modifiers';

export interface DerivedValues {
  HP_MAX: number;
  DP: number;
  INICIATIVA: number; // bônus aplicado ao d20
  POOL_ENERGIA_COSMICA: number;
  USOS_ENERGIA: number;
  MANA_ARCANA: number;
  MANA_DIVINA: number;
  FOCO_CORPO: number;
  FOCO_PRIMAL: number;
  MANA_MAGITECH: number;
  CARGA: number;
  MOVIMENTO: number;
  PER_PASSIVA: number;
  GRIMORIO: number;
  ESPACOS_CONJURACAO: number;
  hitDie: string | null;
  /** Mods que moldaram os números finais — por target. Útil para tooltips. */
  contributors?: Partial<Record<keyof DerivedValues, EffectModifier[]>>;
}

export function computeDerived(ctx: DataContext, character: Character): DerivedValues {
  const attrs = computeAttributes(ctx, character);
  const race = findRace(ctx, character.raceId);
  const level = Math.max(1, character.level);
  const mods = collectModifiers(ctx, character);

  const A = (id: AttrId) => attrs[id].total;
  const maxPrincipal = maxPrincipalForPool(ctx, character);
  const contributors: Partial<Record<keyof DerivedValues, EffectModifier[]>> = {};

  /** Aplica o pipeline sobre uma fórmula numérica. Guarda contributors. */
  const R = (key: keyof DerivedValues, formula: number): number => {
    const res = resolveNumber(formula, mods, `derived.${key}`);
    if (res.contributors.length > 0) contributors[key] = res.contributors;
    return res.value;
  };

  // Movimento tem target próprio 'speed' em muitos traits de raça (ex: Zenita).
  const speedRes = resolveNumber(racialBaseSpeed(ctx, race), mods, 'speed');
  if (speedRes.contributors.length > 0) contributors.MOVIMENTO = speedRes.contributors;
  const movimento = R('MOVIMENTO', speedRes.value);

  return {
    HP_MAX: R('HP_MAX', A('CON') * 5 + 10),
    DP: R('DP', 10 + A('AGI')),
    INICIATIVA: R('INICIATIVA', A('AGI') + A('PER')),
    POOL_ENERGIA_COSMICA: R('POOL_ENERGIA_COSMICA', maxPrincipal + level),
    USOS_ENERGIA: R('USOS_ENERGIA', A('RES') * 3),
    MANA_ARCANA: R('MANA_ARCANA', (A('INT') + A('FOC')) * 4 + level * 2),
    MANA_DIVINA: R('MANA_DIVINA', (A('FOC') + A('PRE')) * 4 + level * 2),
    FOCO_CORPO: R('FOCO_CORPO', (Math.max(A('POT'), A('AGI')) + A('RES')) * 3 + level * 2),
    FOCO_PRIMAL: R('FOCO_PRIMAL', (A('PER') + A('RES')) * 3 + level * 2),
    MANA_MAGITECH: R('MANA_MAGITECH', (A('ENG') + A('INT')) * 3 + level * 2),
    CARGA: R('CARGA', A('POT') * 10),
    MOVIMENTO: movimento,
    PER_PASSIVA: R('PER_PASSIVA', 10 + A('PER')),
    GRIMORIO: R('GRIMORIO', A('INT')),
    ESPACOS_CONJURACAO: R('ESPACOS_CONJURACAO', A('INT') * 2),
    hitDie: racialHitDie(race),
    contributors
  };
}

/**
 * Maior atributo principal para o Pool Cósmico.
 *
 * Regra (data/vertentes/system.json): usa o MAIOR atributo principal entre as
 * vertentes em que o personagem tem proficiência >0. Se nenhuma vertente ativa,
 * fallback para `maxPrincipalAttribute` (maior atributo total do personagem).
 */
function maxPrincipalForPool(ctx: DataContext, character: Character): number {
  const vertAttrs = activeVertenteAttributes(ctx, character);
  if (vertAttrs.length === 0) return maxPrincipalAttribute(ctx, character).value;

  const attrs = computeAttributes(ctx, character);
  let best = 0;
  for (const id of vertAttrs) {
    const v = attrs[id]?.total ?? 0;
    if (v > best) best = v;
  }
  return best;
}

/** Atributos principais das vertentes em que o personagem tem rank >0. */
function activeVertenteAttributes(ctx: DataContext, character: Character): AttrId[] {
  const set = new Set<AttrId>();
  for (const v of ctx.vertentes ?? []) {
    const rank = (character.proficiencies ?? {})[v.id] ?? 0;
    if (rank <= 0) continue;
    const attrs = (v as Vertente & { governingAttributes?: AttrId[] }).governingAttributes;
    for (const attr of attrs ?? []) set.add(attr);
  }
  return [...set];
}
