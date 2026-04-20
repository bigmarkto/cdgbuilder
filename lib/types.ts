// TypeScript types for CDG entities. Lazy/loose by design — the JSON sources
// carry more shape variation than a strict schema can cover yet. Prefer
// structural property-access with optional chaining.

export type AttrId = 'CON' | 'POT' | 'AGI' | 'PER' | 'INT' | 'ENG' | 'RES' | 'FOC' | 'PRE';
export type AttrGroup = 'CORPO' | 'MENTE' | 'ESPIRITO';

export interface Prerequisite {
  type: string; // 'attribute' | 'proficiency' | 'level' | 'race' | 'vertente' | 'talent' | 'custom'
  attr?: AttrId;
  min?: number;
  minRank?: number;
  id?: string;
  text?: string;
}

export interface Modifier {
  type: string; // 'attribute' | 'derived' | 'proficiency' | 'speed' | 'resistance' | 'immunity' | 'grant' | 'custom'
  attr?: AttrId;
  target?: string;
  id?: string;
  value?: number | string;
  rankDelta?: number;
  damageType?: string;
  text?: string;
}

export interface EntityBase {
  id: string;
  name: string;
  source?: string;
  description?: string;
  tags?: string[];
  notes?: string;
  prerequisites?: Prerequisite[];
  modifiers?: Modifier[];
  [key: string]: unknown;
}

export interface Trait extends EntityBase {}
export interface Weakness extends EntityBase {}
export interface Subtype extends EntityBase {}

export interface Race extends EntityBase {
  hitDie?: string;
  baseSpeed?: number;
  size?: string;
  attributeBonus?: {
    type?: string;
    values?: Partial<Record<AttrId, number>>;
    notes?: string;
  };
  traits?: Trait[];
  weaknesses?: Weakness[];
  subtypes?: Subtype[];
  ageRange?: { maturity?: number; average?: number };
}

export interface ProficiencyRecord extends EntityBase {
  attribute?: AttrId;
  usedFor?: string[];
  parent?: string; // for sub-proficiencies
}

export interface ProficiencyIndex {
  id: string;
  name: string;
  source?: string;
  attributes?: AttrId[];
  attributeGroups?: Record<AttrGroup, AttrId[]>;
  ranks?: Array<{ id: string; name: string; bonus: number }>;
  proficiencies?: ProficiencyRecord[];
  subProficiencies?: ProficiencyRecord[];
  [key: string]: unknown;
}

export interface Conjuration extends EntityBase {
  rank?: number;
  forms?: string[];
  ranges?: string[];
  intensity?: string;
  cost?: number | string;
}

export interface Vertente extends EntityBase {
  governingAttribute?: AttrId;
  maxRankNormal?: number | null;
  unlockCondition?: string;
  conjurations?: Conjuration[];
}

export interface Pacto extends EntityBase {
  patron?: string;
  boons?: EntityBase[];
  costs?: EntityBase[];
}

export interface Scar extends EntityBase {
  trigger?: string;
  effects?: EntityBase[];
  severity?: string;
}

export interface TreeAbility extends EntityBase {
  cost?: number;
}

export interface TreeTier {
  tier: number;
  slots?: number;
  nivelMin?: number;
  nome?: string;
  prerequisites?: Prerequisite[];
  abilities?: TreeAbility[];
}

export interface Tree extends EntityBase {
  tiers?: TreeTier[];
}

export interface SystemConstants extends EntityBase {
  attributes?: Array<{ id: AttrId; name: string; group: AttrGroup; description: string }>;
  attributeGroups?: Record<AttrGroup, AttrId[]>;
  baseSpeed?: number;
  difficultyTable?: Array<{ id: string; name: string; dt: number }>;
  [key: string]: unknown;
}

export interface Derived extends EntityBase {
  derived?: Array<{ id: string; name: string; formula: string; alternateFormula?: string; notes?: string; unit?: string }>;
}

export interface Creation extends EntityBase {
  steps?: Array<{ step: number; id: string; name: string; summary: string }>;
  attributePointBuy?: { totalPoints: number; minPerAttribute: number; maxPerAttributeBase: number; maxAbsoluteLevel1?: number; notes?: string[] };
  proficiencyBudget?: { initialPoints: number; maxRankAtCreation: number; maxRankFormula?: string; notes?: string[] };
  [key: string]: unknown;
}

export type CollectionId =
  | 'races'
  | 'proficiencies'
  | 'vertentes'
  | 'pactos'
  | 'scars'
  | 'trees'
  | 'progression'
  | 'meta'
  | 'rules';

export const COLLECTIONS: readonly CollectionId[] = [
  'races',
  'proficiencies',
  'vertentes',
  'pactos',
  'scars',
  'trees',
  'progression',
  'meta',
  'rules'
] as const;

export const COLLECTION_LABELS: Record<CollectionId, string> = {
  races: 'Raças',
  proficiencies: 'Proficiências',
  vertentes: 'Vertentes de Poder',
  pactos: 'Pactos',
  scars: 'Cicatrizes',
  trees: 'Árvores de Habilidades',
  progression: 'Progressão',
  meta: 'Sistema',
  rules: 'Regras'
};

export const COLLECTION_BLURBS: Record<CollectionId, string> = {
  races: '14 linhagens jogáveis, cada uma com traços, fraquezas e dado de vida.',
  proficiencies: '59 proficiências básicas + 33 sub-proficiências em 9 atributos.',
  vertentes: '9 Vertentes de Energia Cósmica. Sistema modular — jogador monta cada conjuração.',
  pactos: 'Acordos com entidades. Benefícios vêm com preços narrativos e mecânicos.',
  scars: 'Marcas que ficam. Poder, guerra, corrupção, sacrifício, pactos e narrativa.',
  trees: '12 árvores de habilidades, cada uma com 4 tiers (28 habilidades por árvore).',
  progression: 'Níveis, XP e regras das 4 Fases de campanha.',
  meta: 'Atributos, valores derivados, criação de personagem e regras universais.',
  rules: 'Port Vale Desperto v2.0: graus de sucesso, condições, cobertura, trauma, queda, tamanhos.'
};
