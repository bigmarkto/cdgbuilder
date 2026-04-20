import type { Prerequisite } from '@/lib/types';
import type { Character } from './character';
import type { DataContext } from './context';
import { computeAttributes } from './attributes';
import { proficiencyRank } from './proficiencies';

export interface PrereqResult {
  ok: boolean;
  reason?: string;
}

export function checkPrerequisite(ctx: DataContext, character: Character, prereq: Prerequisite): PrereqResult {
  switch (prereq.type) {
    case 'attribute': {
      if (!prereq.attr || prereq.min == null) return { ok: true };
      const attrs = computeAttributes(ctx, character);
      const value = attrs[prereq.attr]?.total ?? 0;
      return value >= prereq.min
        ? { ok: true }
        : { ok: false, reason: `Requer ${prereq.attr} ≥ ${prereq.min} (atual ${value}).` };
    }
    case 'proficiency': {
      if (!prereq.id || prereq.minRank == null) return { ok: true };
      const rank = proficiencyRank(character, prereq.id);
      return rank >= prereq.minRank
        ? { ok: true }
        : { ok: false, reason: `Requer ${prereq.id} rank ${prereq.minRank} (atual ${rank}).` };
    }
    case 'level': {
      if (prereq.min == null) return { ok: true };
      return character.level >= prereq.min
        ? { ok: true }
        : { ok: false, reason: `Requer nível ${prereq.min} (atual ${character.level}).` };
    }
    case 'race': {
      if (!prereq.id) return { ok: true };
      return character.raceId === prereq.id
        ? { ok: true }
        : { ok: false, reason: `Requer raça ${prereq.id}.` };
    }
    case 'custom': {
      // Engine não consegue validar texto livre — retornamos indefinido mas
      // marcamos como "ok" para não bloquear. UI pode destacar o texto.
      return { ok: true, reason: prereq.text };
    }
    default:
      return { ok: true };
  }
}

export function checkAllPrerequisites(ctx: DataContext, character: Character, prereqs: Prerequisite[] | undefined): { ok: boolean; results: Array<PrereqResult & { prereq: Prerequisite }> } {
  const list = prereqs ?? [];
  const results = list.map((p) => ({ ...checkPrerequisite(ctx, character, p), prereq: p }));
  return { ok: results.every((r) => r.ok), results };
}
