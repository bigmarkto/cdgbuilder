import type { AttrId } from '@/lib/types';
import type { Character } from './character';
import { ATTR_IDS } from './character';
import { type DataContext, findRace, pointBuyRules, racialAttributeBonus } from './context';
import { collectModifiers } from './modifiers';
import { type EffectModifier, resolveNumber } from './effects';

export interface AttributeBreakdown {
  id: AttrId;
  base: number;
  racial: number;
  /** Soma dos mods pós-racial (talentos, traits, etc). */
  effects: number;
  total: number;
  /** Mods que contribuíram (fonte + op + valor) — útil para tooltips. */
  contributors: EffectModifier[];
}

export function computeAttributes(ctx: DataContext, character: Character): Record<AttrId, AttributeBreakdown> {
  const race = findRace(ctx, character.raceId);
  const racial = racialAttributeBonus(race);
  const mods = collectModifiers(ctx, character);
  const out = {} as Record<AttrId, AttributeBreakdown>;
  for (const id of ATTR_IDS) {
    const base = character.attributesBase[id] ?? 0;
    const r = racial[id] ?? 0;
    const baseline = base + r;
    const resolved = resolveNumber(baseline, mods, `attr.${id}`);
    out[id] = {
      id,
      base,
      racial: r,
      effects: resolved.value - baseline,
      total: resolved.value,
      contributors: resolved.contributors
    };
  }
  return out;
}

export function pointBuySpent(character: Character): number {
  return ATTR_IDS.reduce((sum, id) => sum + (character.attributesBase[id] ?? 0), 0);
}

export interface PointBuyStatus {
  total: number;
  spent: number;
  remaining: number;
  valid: boolean;
  violations: string[];
}

export function pointBuyStatus(ctx: DataContext, character: Character): PointBuyStatus {
  const rules = pointBuyRules(ctx);
  const total = rules.totalPoints ?? 18;
  const spent = pointBuySpent(character);
  const remaining = total - spent;
  const violations: string[] = [];

  if (remaining < 0) violations.push(`Excedeu em ${-remaining} pts.`);
  for (const id of ATTR_IDS) {
    const v = character.attributesBase[id] ?? 0;
    if (v < (rules.minPerAttribute ?? 0)) {
      violations.push(`${id} abaixo do mínimo (${rules.minPerAttribute ?? 0}).`);
    }
    if (v > (rules.maxPerAttributeBase ?? 6)) {
      violations.push(`${id} excede o máximo base (${rules.maxPerAttributeBase ?? 6}).`);
    }
  }

  // Absolute cap (base + racial) at level 1
  const breakdown = computeAttributes(ctx, character);
  const absMax = rules.maxAbsoluteLevel1;
  if (absMax != null && character.level === 1) {
    for (const id of ATTR_IDS) {
      if (breakdown[id].total > absMax) {
        violations.push(`${id} total ${breakdown[id].total} excede o máximo absoluto no nível 1 (${absMax}).`);
      }
    }
  }

  return {
    total,
    spent,
    remaining,
    valid: remaining === 0 && violations.length === 0,
    violations
  };
}

export function maxPrincipalAttribute(ctx: DataContext, character: Character): { id: AttrId; value: number } {
  const breakdown = computeAttributes(ctx, character);
  let best: AttrId = 'CON';
  for (const id of ATTR_IDS) if (breakdown[id].total > breakdown[best].total) best = id;
  return { id: best, value: breakdown[best].total };
}
