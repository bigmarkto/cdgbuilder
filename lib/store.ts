'use client';

// Zustand store do Builder. O estado vive só no cliente; nunca use este
// módulo em Server Components — importe apenas a partir de componentes 'use client'.
//
// v2: roster de múltiplas fichas. Seleciona uma ativa (expõe como `character`
// para evitar quebrar a API dos step components). Cada mutação do ativo
// espelha em `roster[id]`, que é a fonte persistida.
//
// v3 (Sprint A): Character ganhou `schemaVersion`, `rulesetId`,
// `subProficiencies`, `talents`, `conjurations`. XP virou relevante.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AttrId } from '@/lib/types';
import {
  ATTR_IDS,
  emptyCharacter,
  CHARACTER_SCHEMA_VERSION,
  DEFAULT_RULESET_ID,
  type ActiveCondition,
  type Character,
  type CharacterConjuration,
  type LevelUpEntry,
  type OriginalPower,
  type OriginalPowerAbility,
  type Personality
} from '@/engine/character';

const STORAGE_KEY = 'cdg-builder.character.v1';

/** Nível máximo suportado pelo sistema (ver data/progression/niveis.json). */
const MAX_LEVEL = 12;

/**
 * XP total mínimo para estar em cada nível. Mantido aqui em vez de importar
 * direto de niveis.json para não acoplar o store ao DataContext e para não
 * bloquear a hidratação assíncrona. Espelha data/progression/niveis.json.
 */
const MIN_XP_FOR_LEVEL: Record<number, number> = {
  1: 0,
  2: 500,
  3: 1000,
  4: 1500,
  5: 3000,
  6: 4500,
  7: 6000,
  8: 8000,
  9: 10000,
  10: 12000,
  11: 14000,
  12: 16000
};

export interface RosterEntry {
  id: string;
  name: string;
  raceId: string | null;
  level: number;
  updatedAt: number;
}

export interface BuilderState {
  character: Character;
  /** id -> ficha. Inclui a ativa (espelhada a cada mutação). */
  roster: Record<string, Character>;
  currentStep: string;
  setStep: (step: string) => void;

  // --- roster ---
  rosterList: () => RosterEntry[];
  createCharacter: (opts?: { select?: boolean }) => string;
  selectCharacter: (id: string) => void;
  duplicateCharacter: (id: string) => string | null;
  deleteCharacter: (id: string) => void;

  reset: () => void;
  replaceCharacter: (next: Character) => void;

  setName: (name: string) => void;
  setConcept: (concept: string) => void;
  setLevel: (level: number) => void;
  setXP: (xp: number) => void;
  setRulesetId: (id: string) => void;

  setRace: (raceId: string | null, subtypeId?: string | null) => void;
  setSubtype: (subtypeId: string | null) => void;

  setAttribute: (id: AttrId, value: number) => void;
  bumpAttribute: (id: AttrId, delta: number) => void;
  resetAttributes: () => void;

  setProficiency: (id: string, rank: number) => void;
  bumpProficiency: (id: string, delta: number) => void;
  clearProficiency: (id: string) => void;

  setSubProficiency: (id: string, rank: number) => void;
  bumpSubProficiency: (id: string, delta: number) => void;
  clearSubProficiency: (id: string) => void;

  setTalent: (id: string, level: number) => void;
  bumpTalent: (id: string, delta: number) => void;
  clearTalent: (id: string) => void;

  setOriginalPower: (patch: Partial<OriginalPower> | null) => void;

  addOriginalPowerAbility: (ability: OriginalPowerAbility) => void;
  updateOriginalPowerAbility: (id: string, patch: Partial<OriginalPowerAbility>) => void;
  removeOriginalPowerAbility: (id: string) => void;

  addConjuration: (c: CharacterConjuration) => void;
  updateConjuration: (id: string, patch: Partial<CharacterConjuration>) => void;
  removeConjuration: (id: string) => void;

  /** Anexa um marco de level-up ao histórico. Não reordena nem deduplica. */
  appendLevelUp: (entry: LevelUpEntry) => void;
  /** Substitui o ledger inteiro (usado por reconstrução sintética na migração). */
  replaceLevelHistory: (entries: LevelUpEntry[]) => void;

  setEquipmentPackage: (id: string | null) => void;
  setEquipmentNotes: (notes: string) => void;

  addScar: (scar: { id: string; name: string; note?: string }) => void;
  removeScar: (id: string) => void;

  /** Define o nível de trauma absoluto (clamped em [0, 4]). */
  setTrauma: (level: number) => void;
  /** Ajusta o trauma por delta (positivo ou negativo), clamped em [0, 4]. */
  adjustTrauma: (delta: number) => void;

  /**
   * Adiciona (ou atualiza) uma condição ativa. Se `id` já existe, faz merge
   * do patch — útil para subir stage sem duplicar. `at` é sempre tocado.
   */
  addActiveCondition: (cond: ActiveCondition) => void;
  /** Remove condição pelo id. No-op se ausente. */
  removeActiveCondition: (id: string) => void;
  /** Define o stage de uma condição existente. Se não houver entrada, é no-op. */
  setActiveConditionStage: (id: string, stage: number) => void;
  /** Limpa todas as condições ativas (ex.: fim de cena). */
  clearActiveConditions: () => void;

  setPersonality: (patch: Partial<Personality>) => void;
  setNotes: (notes: string) => void;

  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; error?: string };
}

function touch(c: Character): Character {
  return { ...c, updatedAt: Date.now() };
}

/** Clampa trauma em [0, 4] e força inteiro. Usado em set, import e migrate. */
function clampTrauma(raw: unknown): number {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(4, Math.floor(raw)));
}

/**
 * Valida e limpa um array de condições ativas possivelmente vindo de JSON
 * externo (import, localStorage corrompido). Descarta entradas que não
 * tenham um `id: string` válido e normaliza `stage`/`at`/`note`.
 */
function sanitizeActiveConditions(raw: unknown): ActiveCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: ActiveCondition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const x = item as Partial<ActiveCondition>;
    if (typeof x.id !== 'string' || x.id.length === 0) continue;
    const clean: ActiveCondition = { id: x.id };
    if (typeof x.stage === 'number' && Number.isFinite(x.stage)) {
      clean.stage = Math.max(1, Math.floor(x.stage));
    }
    if (typeof x.at === 'number' && Number.isFinite(x.at)) clean.at = x.at;
    if (typeof x.note === 'string') clean.note = x.note;
    out.push(clean);
  }
  return out;
}

const emptyOriginalPower: OriginalPower = {
  concept: '',
  trigger: '',
  costSource: '',
  effect: '',
  condition: '',
  weakness: '',
  rank: 1,
  abilities: []
};

/** Atualiza `character` e espelha em `roster[id]`. Todo mutador deve passar por aqui. */
function mutate(
  state: BuilderState,
  fn: (c: Character) => Character
): Partial<BuilderState> {
  const next = touch(fn(state.character));
  return {
    character: next,
    roster: { ...state.roster, [next.id]: next }
  };
}

function initialState(): Pick<BuilderState, 'character' | 'roster' | 'currentStep'> {
  const c = emptyCharacter();
  return {
    character: c,
    roster: { [c.id]: c },
    currentStep: 'conceito'
  };
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      ...initialState(),
      setStep: (step) => set({ currentStep: step }),

      rosterList: () =>
        Object.values(get().roster)
          .map((c) => ({
            id: c.id,
            name: c.name,
            raceId: c.raceId,
            level: c.level,
            updatedAt: c.updatedAt
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt),

      createCharacter: (opts) => {
        const fresh = emptyCharacter();
        set((s) => ({
          roster: { ...s.roster, [fresh.id]: fresh },
          ...(opts?.select === false
            ? {}
            : { character: fresh, currentStep: 'conceito' })
        }));
        return fresh.id;
      },

      selectCharacter: (id) => {
        const s = get();
        const target = s.roster[id];
        if (!target) return;
        set({
          character: target,
          roster: { ...s.roster, [s.character.id]: s.character },
          currentStep: 'conceito'
        });
      },

      duplicateCharacter: (id) => {
        const src = get().roster[id];
        if (!src) return null;
        const copy: Character = {
          ...src,
          id: emptyCharacter().id,
          name: src.name ? `${src.name} (cópia)` : '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        set((s) => ({ roster: { ...s.roster, [copy.id]: copy } }));
        return copy.id;
      },

      deleteCharacter: (id) => {
        set((s) => {
          const nextRoster = { ...s.roster };
          delete nextRoster[id];
          if (s.character.id !== id) return { roster: nextRoster };
          // Apagou a ativa: entra na mais recente ou cria uma em branco.
          const fallback =
            Object.values(nextRoster).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
          if (fallback) {
            return { roster: nextRoster, character: fallback, currentStep: 'conceito' };
          }
          const fresh = emptyCharacter();
          return {
            roster: { [fresh.id]: fresh },
            character: fresh,
            currentStep: 'conceito'
          };
        });
      },

      reset: () => set(initialState()),
      replaceCharacter: (next) => set((s) => mutate(s, () => next)),

      setName: (name) => set((s) => mutate(s, (c) => ({ ...c, name }))),
      setConcept: (concept) => set((s) => mutate(s, (c) => ({ ...c, concept }))),
      setLevel: (level) =>
        set((s) =>
          mutate(s, (c) => {
            const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
            const minXP = MIN_XP_FOR_LEVEL[clamped] ?? 0;
            // XP total é o que define o nível no engine (levelCurrent =
            // min(character.level, levelForXP(total))). Se o jogador escolher
            // um nível maior do que o XP atual permite, bump o XP para o piso
            // daquele nível — senão a seleção não surte efeito.
            const nextXP = c.xp >= minXP ? c.xp : minXP;
            return { ...c, level: clamped, xp: nextXP };
          })
        ),
      setXP: (xp) =>
        set((s) => mutate(s, (c) => ({ ...c, xp: Math.max(0, Math.floor(xp)) }))),
      setRulesetId: (id) =>
        set((s) => mutate(s, (c) => ({ ...c, rulesetId: id || DEFAULT_RULESET_ID }))),

      setRace: (raceId, subtypeId) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            raceId,
            subtypeId: subtypeId !== undefined ? subtypeId : null
          }))
        ),
      setSubtype: (subtypeId) => set((s) => mutate(s, (c) => ({ ...c, subtypeId }))),

      setAttribute: (id, value) =>
        set((s) =>
          mutate(s, (c) => ({ ...c, attributesBase: { ...c.attributesBase, [id]: value } }))
        ),
      bumpAttribute: (id, delta) => {
        const cur = get().character.attributesBase[id] ?? 0;
        get().setAttribute(id, cur + delta);
      },
      resetAttributes: () =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            attributesBase: ATTR_IDS.reduce(
              (acc, id) => ({ ...acc, [id]: 0 }),
              {} as Record<AttrId, number>
            )
          }))
        ),

      setProficiency: (id, rank) =>
        set((s) =>
          mutate(s, (c) => {
            const next = { ...c.proficiencies };
            if (rank <= 0) delete next[id];
            else next[id] = rank;
            return { ...c, proficiencies: next };
          })
        ),
      bumpProficiency: (id, delta) => {
        const cur = get().character.proficiencies[id] ?? 0;
        get().setProficiency(id, Math.max(0, cur + delta));
      },
      clearProficiency: (id) =>
        set((s) =>
          mutate(s, (c) => {
            const next = { ...c.proficiencies };
            delete next[id];
            return { ...c, proficiencies: next };
          })
        ),

      setSubProficiency: (id, rank) =>
        set((s) =>
          mutate(s, (c) => {
            const next = { ...(c.subProficiencies ?? {}) };
            if (rank <= 0) delete next[id];
            else next[id] = rank;
            return { ...c, subProficiencies: next };
          })
        ),
      bumpSubProficiency: (id, delta) => {
        const cur = get().character.subProficiencies?.[id] ?? 0;
        get().setSubProficiency(id, Math.max(0, cur + delta));
      },
      clearSubProficiency: (id) =>
        set((s) =>
          mutate(s, (c) => {
            const next = { ...(c.subProficiencies ?? {}) };
            delete next[id];
            return { ...c, subProficiencies: next };
          })
        ),

      setTalent: (id, level) =>
        set((s) =>
          mutate(s, (c) => {
            const next = { ...(c.talents ?? {}) };
            if (level <= 0) delete next[id];
            else next[id] = level;
            return { ...c, talents: next };
          })
        ),
      bumpTalent: (id, delta) => {
        const cur = get().character.talents?.[id] ?? 0;
        get().setTalent(id, Math.max(0, cur + delta));
      },
      clearTalent: (id) =>
        set((s) =>
          mutate(s, (c) => {
            const next = { ...(c.talents ?? {}) };
            delete next[id];
            return { ...c, talents: next };
          })
        ),

      setOriginalPower: (patch) =>
        set((s) =>
          mutate(s, (c) => {
            if (patch === null) return { ...c, originalPower: null };
            const base = c.originalPower ?? emptyOriginalPower;
            return { ...c, originalPower: { ...base, ...patch } };
          })
        ),

      addOriginalPowerAbility: (ability) =>
        set((s) =>
          mutate(s, (c) => {
            const base = c.originalPower ?? emptyOriginalPower;
            return {
              ...c,
              originalPower: {
                ...base,
                abilities: [...(base.abilities ?? []), ability]
              }
            };
          })
        ),
      updateOriginalPowerAbility: (id, patch) =>
        set((s) =>
          mutate(s, (c) => {
            if (!c.originalPower) return c;
            const abilities = (c.originalPower.abilities ?? []).map((a) =>
              a.id === id ? { ...a, ...patch } : a
            );
            return { ...c, originalPower: { ...c.originalPower, abilities } };
          })
        ),
      removeOriginalPowerAbility: (id) =>
        set((s) =>
          mutate(s, (c) => {
            if (!c.originalPower) return c;
            const abilities = (c.originalPower.abilities ?? []).filter((a) => a.id !== id);
            return { ...c, originalPower: { ...c.originalPower, abilities } };
          })
        ),

      addConjuration: (conj) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            conjurations: [...(c.conjurations ?? []), conj]
          }))
        ),
      updateConjuration: (id, patch) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            conjurations: (c.conjurations ?? []).map((x) =>
              x.id === id ? { ...x, ...patch } : x
            )
          }))
        ),
      removeConjuration: (id) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            conjurations: (c.conjurations ?? []).filter((x) => x.id !== id)
          }))
        ),

      appendLevelUp: (entry) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            levelHistory: [...(c.levelHistory ?? []), entry]
          }))
        ),
      replaceLevelHistory: (entries) =>
        set((s) => mutate(s, (c) => ({ ...c, levelHistory: entries }))),

      setEquipmentPackage: (id) =>
        set((s) => mutate(s, (c) => ({ ...c, equipmentPackageId: id }))),
      setEquipmentNotes: (notes) =>
        set((s) => mutate(s, (c) => ({ ...c, equipmentNotes: notes }))),

      addScar: (scar) =>
        set((s) => mutate(s, (c) => ({ ...c, scars: [...c.scars, scar] }))),
      removeScar: (id) =>
        set((s) => mutate(s, (c) => ({ ...c, scars: c.scars.filter((x) => x.id !== id) }))),

      setTrauma: (level) =>
        set((s) => mutate(s, (c) => ({ ...c, trauma: clampTrauma(level) }))),
      adjustTrauma: (delta) => {
        const cur = get().character.trauma ?? 0;
        get().setTrauma(cur + delta);
      },

      addActiveCondition: (cond) =>
        set((s) =>
          mutate(s, (c) => {
            const list = c.activeConditions ?? [];
            const idx = list.findIndex((x) => x.id === cond.id);
            const merged: ActiveCondition = {
              ...(idx >= 0 ? list[idx] : {}),
              ...cond,
              at: cond.at ?? Date.now()
            };
            const next = idx >= 0 ? list.map((x, i) => (i === idx ? merged : x)) : [...list, merged];
            return { ...c, activeConditions: next };
          })
        ),
      removeActiveCondition: (id) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            activeConditions: (c.activeConditions ?? []).filter((x) => x.id !== id)
          }))
        ),
      setActiveConditionStage: (id, stage) =>
        set((s) =>
          mutate(s, (c) => ({
            ...c,
            activeConditions: (c.activeConditions ?? []).map((x) =>
              x.id === id ? { ...x, stage: Math.max(1, Math.floor(stage)) } : x
            )
          }))
        ),
      clearActiveConditions: () =>
        set((s) => mutate(s, (c) => ({ ...c, activeConditions: [] }))),

      setPersonality: (patch) =>
        set((s) =>
          mutate(s, (c) => ({ ...c, personality: { ...c.personality, ...patch } }))
        ),
      setNotes: (notes) => set((s) => mutate(s, (c) => ({ ...c, notes }))),

      exportJson: () => JSON.stringify(get().character, null, 2),
      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw);
          const merged = mergeCharacter(parsed);
          // Importar SEMPRE como nova ficha — não sobrescreve a ativa.
          const withFreshId: Character = { ...merged, id: emptyCharacter().id };
          set((s) => ({
            character: withFreshId,
            roster: { ...s.roster, [s.character.id]: s.character, [withFreshId.id]: withFreshId },
            currentStep: 'conceito'
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'JSON inválido' };
        }
      }
    }),
    {
      name: STORAGE_KEY,
      version: 6,
      partialize: (s) => ({
        character: s.character,
        roster: s.roster,
        currentStep: s.currentStep
      }),
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted as BuilderState;

        // v1 → v2: embrulhou Character numa estrutura com roster.
        let state = persisted as {
          character?: Character;
          roster?: Record<string, Character>;
          currentStep?: string;
        };
        if (version < 2) {
          const active = state.character ?? emptyCharacter();
          state = {
            character: active,
            roster: { [active.id]: active },
            currentStep: state.currentStep ?? 'conceito'
          };
        }

        // v2 → v3: Character ganhou schemaVersion, rulesetId, subProficiencies, talents, conjurations.
        if (version < 3) {
          const upgrade = (raw?: Character): Character | undefined => {
            if (!raw) return raw;
            return {
              ...raw,
              schemaVersion: raw.schemaVersion ?? CHARACTER_SCHEMA_VERSION,
              rulesetId: raw.rulesetId ?? DEFAULT_RULESET_ID,
              subProficiencies: raw.subProficiencies ?? {},
              talents: raw.talents ?? {},
              conjurations: raw.conjurations ?? []
            };
          };
          const nextRoster: Record<string, Character> = {};
          for (const [id, c] of Object.entries(state.roster ?? {})) {
            const up = upgrade(c as Character);
            if (up) nextRoster[id] = up;
          }
          state = {
            character: upgrade(state.character),
            roster: nextRoster,
            currentStep: state.currentStep ?? 'conceito'
          };
        }

        // v3 → v4: Duas mudanças atômicas do Sprint E.
        //   1. Removido `powerSourceId` (Fonte de Poder substituída por Conjurações).
        //   2. Adicionado `levelHistory: LevelUpEntry[]` — ledger de progressão.
        //      Aqui inicializamos vazio; o engine/levelup irá, on-demand, preencher
        //      entradas sintéticas reconstruídas a partir de `level` + `xp` atuais.
        if (version < 4) {
          const upgrade = (raw?: Character): Character | undefined => {
            if (!raw) return raw;
            const { powerSourceId: _drop, ...rest } = raw as Character & { powerSourceId?: unknown };
            const r = rest as Partial<Character>;
            return {
              ...(rest as Character),
              schemaVersion: CHARACTER_SCHEMA_VERSION,
              levelHistory: Array.isArray(r.levelHistory) ? r.levelHistory : []
            };
          };
          const nextRoster: Record<string, Character> = {};
          for (const [id, c] of Object.entries(state.roster ?? {})) {
            const up = upgrade(c as Character);
            if (up) nextRoster[id] = up;
          }
          // Se a etapa ativa for 'fonte' (removida), desloca para 'magias' (substituto).
          const nextStep = state.currentStep === 'fonte' ? 'magias' : (state.currentStep ?? 'conceito');
          state = {
            character: upgrade(state.character),
            roster: nextRoster,
            currentStep: nextStep
          };
        }

        // v4 → v5: Character ganhou `trauma: number` (Vale Desperto v2.0 port).
        //   Default 0 para personagens existentes — trauma é ganho por gatilhos narrativos.
        if (version < 5) {
          const upgrade = (raw?: Character): Character | undefined => {
            if (!raw) return raw;
            return {
              ...raw,
              schemaVersion: CHARACTER_SCHEMA_VERSION,
              trauma: clampTrauma(raw.trauma)
            };
          };
          const nextRoster: Record<string, Character> = {};
          for (const [id, c] of Object.entries(state.roster ?? {})) {
            const up = upgrade(c as Character);
            if (up) nextRoster[id] = up;
          }
          state = {
            character: upgrade(state.character),
            roster: nextRoster,
            currentStep: state.currentStep ?? 'conceito'
          };
        }

        // v5 → v6: Character ganhou `activeConditions: ActiveCondition[]`.
        //   Default vazio — condições são aplicadas em runtime (combate/cena).
        //   Sanitiza entradas corrompidas (sem id ou tipos errados).
        if (version < 6) {
          const upgrade = (raw?: Character): Character | undefined => {
            if (!raw) return raw;
            return {
              ...raw,
              schemaVersion: CHARACTER_SCHEMA_VERSION,
              activeConditions: sanitizeActiveConditions(raw.activeConditions)
            };
          };
          const nextRoster: Record<string, Character> = {};
          for (const [id, c] of Object.entries(state.roster ?? {})) {
            const up = upgrade(c as Character);
            if (up) nextRoster[id] = up;
          }
          state = {
            character: upgrade(state.character),
            roster: nextRoster,
            currentStep: state.currentStep ?? 'conceito'
          };
        }

        return state as unknown as BuilderState;
      }
    }
  )
);

// Merge permissivo — preenche valores ausentes com os defaults.
// Também descarta campos legados que não existem mais no schema (ex.: powerSourceId).
function mergeCharacter(raw: unknown): Character {
  const base = emptyCharacter();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Character> & { powerSourceId?: unknown };
  const { powerSourceId: _drop, ...rest } = r;
  return {
    ...base,
    ...rest,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    rulesetId: rest.rulesetId ?? DEFAULT_RULESET_ID,
    attributesBase: { ...base.attributesBase, ...(rest.attributesBase ?? {}) },
    proficiencies: { ...(rest.proficiencies ?? {}) },
    subProficiencies: { ...(rest.subProficiencies ?? {}) },
    talents: { ...(rest.talents ?? {}) },
    personality: { ...base.personality, ...(rest.personality ?? {}) },
    scars: Array.isArray(rest.scars) ? rest.scars : [],
    trauma: clampTrauma(rest.trauma),
    activeConditions: sanitizeActiveConditions(rest.activeConditions),
    conjurations: Array.isArray(rest.conjurations) ? rest.conjurations : [],
    levelHistory: Array.isArray(rest.levelHistory) ? rest.levelHistory : [],
    originalPower: rest.originalPower ?? null,
    createdAt: rest.createdAt ?? base.createdAt,
    updatedAt: Date.now()
  };
}
