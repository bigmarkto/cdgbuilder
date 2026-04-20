import type { AttrId } from '@/lib/types';

/** Versão do schema do Character persistido. Bump quando mudar layout e migrar em lib/store.ts. */
export const CHARACTER_SCHEMA_VERSION = 4;

/** Ruleset ativo. 'core' é o livro base; futuros rulesets podem sobrescrever dados. */
export const DEFAULT_RULESET_ID = 'core';

/**
 * Slot extra de habilidade do Poder Original. A cada marco/rank, o personagem
 * ganha uma habilidade nova. Nome + descrição livres; `unlockedAt` é só
 * rotulo narrativo ("Rank 2", "Cicatriz de Ascensão", etc).
 */
export interface OriginalPowerAbility {
  id: string;
  name: string;
  description: string;
  unlockedAt?: string;
}

export interface OriginalPower {
  concept: string;
  trigger: string;
  costSource: string;
  effect: string;
  condition: string;
  weakness: string;
  rank: number;
  /** Slots extras desbloqueados (Rank 2+, marcos, cicatrizes). */
  abilities?: OriginalPowerAbility[];
}

/**
 * Uma condição ativa atualmente aplicada ao personagem. `id` referencia
 * `data/rules/conditions.json`; `stage` só é relevante para condições escalonadas.
 */
export interface ActiveCondition {
  id: string;
  stage?: number;
  /** Timestamp Unix da aplicação. Usado para ordenação e debug. */
  at?: number;
  /** Nota livre ("aplicado por emboscada", "até próximo turno", etc). */
  note?: string;
}

export interface Personality {
  appearance: string;
  history: string;
  motivation: string;
  bonds: string;
}

/** Uma conjuração montada pelo jogador a partir das Vertentes. */
export interface CharacterConjuration {
  id: string;
  name: string;
  vertenteId: string | null;
  rank: number;
  form?: string;
  range?: string;
  intensity?: string;
  cost?: string;
  notes?: string;
  components?: string[];
}

/** Escolha aplicada em um level-up. Ids opcionais; `kind` descreve o bucket. */
export interface LevelChoice {
  kind: 'proficiency' | 'subProficiency' | 'talent' | 'conjuration' | 'attribute' | 'note';
  id?: string;
  /** Quantidade/ranks adicionados (para proficiências, talentos, atributos). */
  delta?: number;
  /** Texto livre — para notes ou resumo de grant. */
  notes?: string;
}

/**
 * Entrada do ledger de progressão. Um item por nível atingido (1..N).
 * Entradas sintéticas (gerada via migração) carregam `synthetic: true`
 * e representam a reconstrução retroativa do histórico.
 */
export interface LevelUpEntry {
  /** Nível atingido por este marco (1 = criação). */
  level: number;
  /** Timestamp Unix. 0 para synthetic. */
  at: number;
  /** XP total exigido para este nível (ver data/progression/niveis.json). */
  xpAtLevel: number;
  /** Grants automáticos aplicados (marcos de atributo, tiers de talento, dado de vida…). */
  grants?: LevelChoice[];
  /** Escolhas livres do jogador. */
  choices?: LevelChoice[];
  /** Entrada reconstruída retroativamente. */
  synthetic?: boolean;
}

export interface Character {
  id: string;
  schemaVersion: number;
  rulesetId: string;

  name: string;
  concept: string;
  level: number;
  xp: number;

  raceId: string | null;
  subtypeId: string | null;

  /** Point-buy values (0-6 by default) BEFORE racial bonuses. */
  attributesBase: Record<AttrId, number>;

  /** proficiencyId -> rank (0-6). Present means explicitly set; absent = 0. */
  proficiencies: Record<string, number>;

  /** sub-proficiencyId -> rank. Prereqs/custos validados fora. */
  subProficiencies: Record<string, number>;

  /** treeAbilityId -> nível comprado (1+). Árvores de talentos. */
  talents: Record<string, number>;

  originalPower: OriginalPower | null;

  /** Conjurações modulares montadas pelo jogador. */
  conjurations: CharacterConjuration[];

  /** Ledger de level-ups — um marco por nível atingido. */
  levelHistory: LevelUpEntry[];

  equipmentPackageId: string | null;
  equipmentNotes: string;

  /** Scars acquired. Empty at level 1. */
  scars: Array<{ id: string; name: string; note?: string }>;

  /**
   * Nível de Trauma acumulado (0..N). Trilha paralela a HP/Energia, diferente de Cicatrizes:
   * condição temporária que acumula por gatilhos narrativos e dissolve com descanso.
   * Valores canônicos 0..4 conforme data/rules/trauma.json; a interpretação concreta é feita
   * pelo engine/rules/trauma a partir de ctx.rules.trauma.
   */
  trauma: number;

  /**
   * Condições ativas atualmente aplicadas ao personagem. `id` aponta para uma entrada
   * em data/rules/conditions.json; `stage` é usado apenas para condições escalonadas
   * (ex.: "ferido 2"). Array vazio é o estado normal fora de combate.
   */
  activeConditions: ActiveCondition[];

  personality: Personality;

  /** Non-authoritative notes. */
  notes: string;

  createdAt: number;
  updatedAt: number;
}

export const ATTR_IDS: AttrId[] = ['CON', 'POT', 'AGI', 'PER', 'INT', 'ENG', 'RES', 'FOC', 'PRE'];

export function emptyCharacter(): Character {
  const now = Date.now();
  return {
    id: cryptoRandomId(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    rulesetId: DEFAULT_RULESET_ID,
    name: '',
    concept: '',
    level: 1,
    xp: 0,
    raceId: null,
    subtypeId: null,
    attributesBase: {
      CON: 0, POT: 0, AGI: 0,
      PER: 0, INT: 0, ENG: 0,
      RES: 0, FOC: 0, PRE: 0
    },
    proficiencies: {},
    subProficiencies: {},
    talents: {},
    originalPower: null,
    conjurations: [],
    levelHistory: [],
    equipmentPackageId: null,
    equipmentNotes: '',
    scars: [],
    trauma: 0,
    activeConditions: [],
    personality: { appearance: '', history: '', motivation: '', bonds: '' },
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

function cryptoRandomId(): string {
  // Browser path: prefer crypto.randomUUID if present. SSR-safe fallback otherwise.
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    const c = (globalThis as unknown as { crypto: Crypto }).crypto;
    if (c && 'randomUUID' in c) return c.randomUUID();
  }
  return 'pc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
