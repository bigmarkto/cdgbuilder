/**
 * coerceCharacter — converte um JSON desconhecido (vindo do banco) num
 * Character válido pro engine, preenchendo defaults.
 *
 * Versão server-safe do `mergeCharacter` de lib/store.ts (que é 'use client').
 * Usada pela página pública /ficha/[id], que renderiza no servidor.
 *
 * Permissiva por design: dados vêm de um snapshot que já passou pela validação
 * de escrita (shareActions.extractMeta), então confiamos na forma geral e só
 * blindamos contra campos ausentes/tipos errados pra o engine não quebrar.
 */
import { emptyCharacter, ATTR_IDS, type Character } from '@/engine/character';

export function coerceCharacter(raw: unknown): Character {
  const base = emptyCharacter();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  const attributesBase = { ...base.attributesBase };
  if (r.attributesBase && typeof r.attributesBase === 'object') {
    const ab = r.attributesBase as Record<string, unknown>;
    for (const id of ATTR_IDS) {
      if (typeof ab[id] === 'number') attributesBase[id] = ab[id] as number;
    }
  }

  const recordOfNumbers = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val === 'number') out[k] = val;
      }
    }
    return out;
  };

  return {
    ...base,
    ...(typeof r.id === 'string' ? { id: r.id } : {}),
    name: typeof r.name === 'string' ? r.name : base.name,
    concept: typeof r.concept === 'string' ? r.concept : base.concept,
    level: typeof r.level === 'number' ? r.level : base.level,
    xp: typeof r.xp === 'number' ? r.xp : base.xp,
    rulesetId: typeof r.rulesetId === 'string' ? r.rulesetId : base.rulesetId,
    raceId: typeof r.raceId === 'string' ? r.raceId : null,
    subtypeId: typeof r.subtypeId === 'string' ? r.subtypeId : null,
    attributesBase,
    proficiencies: recordOfNumbers(r.proficiencies),
    subProficiencies: recordOfNumbers(r.subProficiencies),
    talents: recordOfNumbers(r.talents),
    originalPower:
      r.originalPower && typeof r.originalPower === 'object'
        ? (r.originalPower as Character['originalPower'])
        : null,
    conjurations: Array.isArray(r.conjurations)
      ? (r.conjurations as Character['conjurations'])
      : [],
    scars: Array.isArray(r.scars) ? (r.scars as Character['scars']) : [],
    trauma: typeof r.trauma === 'number' ? r.trauma : 0,
    activeConditions: Array.isArray(r.activeConditions)
      ? (r.activeConditions as Character['activeConditions'])
      : [],
    levelHistory: Array.isArray(r.levelHistory)
      ? (r.levelHistory as Character['levelHistory'])
      : [],
    equipmentPackageId: typeof r.equipmentPackageId === 'string' ? r.equipmentPackageId : null,
    equipmentNotes: typeof r.equipmentNotes === 'string' ? r.equipmentNotes : '',
    personality:
      r.personality && typeof r.personality === 'object'
        ? { ...base.personality, ...(r.personality as Character['personality']) }
        : base.personality,
    notes: typeof r.notes === 'string' ? r.notes : ''
  };
}
