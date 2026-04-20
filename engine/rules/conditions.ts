// Catálogo de Condições — resolvedor puro.

export interface ConditionStage {
  stage: number;
  name?: string;
  effects?: Array<Record<string, unknown>>;
}

export interface ConditionRecord {
  id: string;
  name: string;
  description?: string;
  duration?: string;
  effects?: Array<Record<string, unknown>>;
  stages?: ConditionStage[];
  [k: string]: unknown;
}

export interface ConditionsTable {
  id: string;
  name?: string;
  description?: string;
  stackingRule?: string;
  removalCommon?: string;
  conditions: ConditionRecord[];
  notes?: string[];
  [k: string]: unknown;
}

/** Busca uma condição por id. Case-insensitive, sem acento. */
export function findCondition(
  table: ConditionsTable,
  id: string
): ConditionRecord | null {
  if (!id) return null;
  const norm = id.trim().toLowerCase();
  return table.conditions.find((c) => c.id.toLowerCase() === norm) ?? null;
}

/** Retorna o estágio específico de uma condição escalada. Se a condição não tiver estágios,
 *  retorna null — o chamador deve usar os `effects` da condição diretamente. */
export function conditionStage(
  cond: ConditionRecord,
  stage: number
): ConditionStage | null {
  if (!cond.stages || cond.stages.length === 0) return null;
  return cond.stages.find((s) => s.stage === stage) ?? null;
}

/** Retorna todos os effects ativos de uma condição no estágio informado.
 *  - Sem estágios: devolve `cond.effects ?? []`.
 *  - Com estágios: devolve os effects do estágio atual (acumulados com os base da condição, se houver). */
export function conditionEffects(
  cond: ConditionRecord,
  stage?: number
): Array<Record<string, unknown>> {
  const base = cond.effects ?? [];
  if (!cond.stages || cond.stages.length === 0) return base;
  if (typeof stage !== 'number') return base;
  const s = conditionStage(cond, stage);
  return [...base, ...(s?.effects ?? [])];
}

/** Lista condições ordenadas por nome (ordem alfabética PT-BR). */
export function listConditions(table: ConditionsTable): ConditionRecord[] {
  return [...table.conditions].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** True se a condição tem escada de estágios. */
export function isStaged(cond: ConditionRecord): boolean {
  return Array.isArray(cond.stages) && cond.stages.length > 0;
}

/** Número máximo de estágios da condição (0 se sem escada). */
export function maxStage(cond: ConditionRecord): number {
  if (!cond.stages || cond.stages.length === 0) return 0;
  return cond.stages.reduce((m, s) => Math.max(m, s.stage), 0);
}
