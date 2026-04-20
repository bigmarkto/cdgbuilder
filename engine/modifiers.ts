// Sprint D — coletor central de modifiers.
//
// Une a pilha de `EffectModifier` que atua sobre um personagem: raça, subtipo,
// traits, fraquezas, talentos comprados, sub-proficiências e cicatrizes.
// O resultado alimenta `computeAttributes` e `computeDerived` para que os
// números finais reflitam tudo que está no JSON.
//
// Só itens efetivamente "ativos" entram (ex: talento com level ≥ 1, sub-prof
// com rank ≥ 1). Traits/fraquezas de raça são sempre ativos uma vez que a
// raça está escolhida.

import type { EntityBase, Modifier as DataModifier, Race, Subtype, Tree } from '@/lib/types';
import type { Character } from './character';
import type { DataContext } from './context';
import {
  type EffectModifier,
  type EffectSource,
  normalizeDataModifier
} from './effects';
import { findRace } from './context';

/** Puxa mods estruturados da pilha toda e normaliza. */
export function collectModifiers(ctx: DataContext, character: Character): EffectModifier[] {
  const out: EffectModifier[] = [];
  const push = (raw: DataModifier | undefined, src: EffectSource) => {
    if (!raw) return;
    const norm = normalizeDataModifier(raw, src);
    if (norm) out.push(norm);
  };
  const pushAll = (mods: DataModifier[] | undefined, src: EffectSource) => {
    for (const m of mods ?? []) push(m, src);
  };

  // Raça + traits + fraquezas.
  const race = findRace(ctx, character.raceId);
  if (race) {
    pushAll(race.modifiers, { kind: 'race', id: race.id, name: race.name });
    for (const trait of race.traits ?? []) {
      pushAll(trait.modifiers, { kind: 'trait', id: trait.id, name: trait.name });
    }
    for (const weak of race.weaknesses ?? []) {
      pushAll(weak.modifiers, { kind: 'trait', id: weak.id, name: weak.name });
    }

    // Subtype (se selecionado).
    const st = findSubtype(race, character.subtypeId);
    if (st) {
      pushAll(st.modifiers, { kind: 'subtype', id: st.id, name: st.name });
      for (const trait of (st as unknown as { traits?: EntityBase[] }).traits ?? []) {
        pushAll(trait.modifiers, { kind: 'trait', id: trait.id, name: trait.name });
      }
    }
  }

  // Talentos comprados (level ≥ 1) — varre as árvores pra localizar.
  const talents = character.talents ?? {};
  for (const [abilityId, level] of Object.entries(talents)) {
    if (level <= 0) continue;
    const hit = findAbilityMods(ctx.trees, abilityId);
    if (!hit) continue;
    pushAll(hit.ability.modifiers, {
      kind: 'talent',
      id: abilityId,
      name: hit.ability.name
    });
  }

  // Sub-proficiências (se o JSON trouxer mods — hoje em dia raro, mas o
  // coletor já cobre).
  const subList = ctx.proficiencies.subProficiencies ?? [];
  for (const [subId, rank] of Object.entries(character.subProficiencies ?? {})) {
    if (rank <= 0) continue;
    const entry = subList.find((s) => s.id === subId);
    if (!entry) continue;
    pushAll(entry.modifiers, { kind: 'subProficiency', id: subId, name: entry.name });
  }

  // Cicatrizes adquiridas (as selecionadas em character.scars geralmente
  // carregam só name+note, mas pode haver um id cheio).
  for (const scar of character.scars ?? []) {
    // character.scars é {id, name, note} — mods completas moram no data/scars.
    // Sem loader direto aqui, aceitamos o scar inline se tiver modifiers.
    const asRaw = scar as unknown as { modifiers?: DataModifier[] };
    pushAll(asRaw.modifiers, { kind: 'scar', id: scar.id, name: scar.name });
  }

  return out;
}

function findSubtype(race: Race, subtypeId: string | null): Subtype | null {
  if (!subtypeId || !race.subtypes) return null;
  return race.subtypes.find((s) => s.id === subtypeId) ?? null;
}

function findAbilityMods(
  trees: Tree[] | undefined,
  abilityId: string
): { tree: Tree; ability: { modifiers?: DataModifier[]; name: string } } | null {
  for (const tree of trees ?? []) {
    for (const tier of tree.tiers ?? []) {
      const ability = (tier.abilities ?? []).find((a) => a.id === abilityId);
      if (ability) return { tree, ability };
    }
  }
  return null;
}
