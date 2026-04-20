// DataContext: o snapshot de regras que a engine precisa para calcular qualquer coisa.
// É produzido a partir dos JSONs e passado como parâmetro nas funções da engine
// (nenhuma função lê do disco diretamente — engine é pura).

import type {
  SystemConstants,
  Derived,
  Creation,
  Race,
  ProficiencyIndex,
  Tree,
  Vertente,
  AttrId
} from '@/lib/types';
import type { Character } from './character';
import { DEFAULT_RULESET_ID } from './character';
import type { LevelGrantsTable } from './levelup';
import type { RulesBundle } from './rules';

export interface DataContext {
  system: SystemConstants;
  creation: Creation;
  derived: Derived;
  races: Race[];
  proficiencies: ProficiencyIndex;
  /** Opcional: tabela de progressão (níveis/XP). Sprint A passa a consumir. */
  progression?: ProgressionTable;
  /** Opcional: árvores de talentos carregadas. Sprint C. */
  trees?: Tree[];
  /** Opcional: vertentes carregadas. Sprint D: usado para pool vertente-aware. */
  vertentes?: Vertente[];
  /** Opcional: tabela de grants por nível (Sprint E). Usado pelo LevelUpWizard. */
  levelGrants?: LevelGrantsTable;
  /** Opcional: pacote Vale Desperto v2.0 (port). Graus, condições, cobertura, trauma, queda, tamanhos. */
  rules?: RulesBundle;
}

/** Shape parcial de data/progression/niveis.json — aquilo que a engine precisa. */
export interface ProgressionTable {
  id: string;
  name?: string;
  /** Tabela primária de níveis. xpRequired é o XP total acumulado necessário. */
  levels?: Array<{ level: number; xpRequired: number; [k: string]: unknown }>;
  arvores?: {
    xpDisponivelPorNivel?: Array<{ nivel: number; ganhoXP?: number; totalXP: number; nota?: string | null }>;
    acessoPorTier?: Array<{ tier: number; nivelMin: number; custoXP: number; [k: string]: unknown }>;
    [k: string]: unknown;
  };
  [key: string]: unknown;
}

/** O ruleset ativo do personagem; usado para selecionar variantes de regra futuramente. */
export function rulesetId(character: Character): string {
  return character.rulesetId || DEFAULT_RULESET_ID;
}

export function findRace(ctx: DataContext, id: string | null): Race | null {
  if (!id) return null;
  return ctx.races.find((r) => r.id === id) ?? null;
}

export function racialAttributeBonus(race: Race | null): Partial<Record<AttrId, number>> {
  if (!race?.attributeBonus?.values) return {};
  return race.attributeBonus.values;
}

export function racialHitDie(race: Race | null): string | null {
  return (race?.hitDie as string | undefined) ?? null;
}

export function racialBaseSpeed(ctx: DataContext, race: Race | null): number {
  if (race?.baseSpeed && typeof race.baseSpeed === 'number') return race.baseSpeed;
  return ctx.system.baseSpeed ?? 9;
}

export function pointBuyRules(ctx: DataContext) {
  const pb = ctx.creation.attributePointBuy ?? {
    totalPoints: 18,
    minPerAttribute: 0,
    maxPerAttributeBase: 6,
    maxAbsoluteLevel1: 8
  };
  return pb;
}

export function proficiencyBudget(ctx: DataContext) {
  const pb = ctx.creation.proficiencyBudget ?? {
    initialPoints: 12,
    maxRankAtCreation: 2,
    maxRankFormula: 'nivel/2 arredondado para cima'
  };
  return pb;
}

export interface SubProficiencyRules {
  levelUnlock: number;
  firstFreeSubAtLevel2: boolean;
  costXP: Record<string, number>;
  levelRequirements: Record<string, number>;
  prerequisiteRule?: string;
}

export function subProficiencyRules(ctx: DataContext): SubProficiencyRules {
  const raw = (ctx.creation as unknown as { subProficiencyRules?: SubProficiencyRules }).subProficiencyRules;
  return (
    raw ?? {
      levelUnlock: 2,
      firstFreeSubAtLevel2: true,
      costXP: { R1: 100, R2: 300, R3: 600, R4: 1200, R5: 2000 },
      levelRequirements: { R1: 2, R2: 4, R3: 6, R4: 8, R5: 10 },
      prerequisiteRule: 'Sub Rank N requer Prof Básica Rank N+1.'
    }
  );
}

export interface OriginalPowerRank {
  rank: number;
  name?: string;
  levelMin: number;
  xp: number;
  effects?: string;
  usesPerLongRest?: number;
}

export function originalPowerRanks(ctx: DataContext): OriginalPowerRank[] {
  const raw = (ctx.creation as unknown as { originalPowerRules?: { ranks?: OriginalPowerRank[] } })
    .originalPowerRules;
  return raw?.ranks ?? [];
}

export function rankBonus(ctx: DataContext, rank: number): number {
  const ranks = ctx.proficiencies.ranks ?? [];
  const row = ranks[Math.max(0, Math.min(ranks.length - 1, rank))];
  return row?.bonus ?? 0;
}
