// Trauma — resolvedor puro.

export interface TraumaStage {
  level: number;
  id: string;
  name: string;
  effects?: Array<Record<string, unknown>>;
}

export interface TraumaTrigger {
  id: string;
  name: string;
  gain: number;
  save?: string;
}

export interface TraumaTable {
  id: string;
  name?: string;
  source?: string;
  description?: string;
  attribute?: string;
  saveDC?: string;
  track: TraumaStage[];
  triggers?: TraumaTrigger[];
  recovery?: Array<{ id: string; description: string }>;
  notes?: string[];
  [k: string]: unknown;
}

/** Clamp para o range válido da trilha (geralmente 0..4). */
export function clampTraumaLevel(table: TraumaTable, level: number): number {
  const levels = table.track.map((s) => s.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return Math.max(min, Math.min(max, Math.floor(level)));
}

/** Estágio de trauma atual. */
export function traumaStage(table: TraumaTable, level: number): TraumaStage {
  const safe = clampTraumaLevel(table, level);
  return table.track.find((s) => s.level === safe) ?? table.track[0];
}

/** Aplica um gatilho — retorna o novo nível (já clamped) e o estágio resultante. */
export function applyTrigger(
  table: TraumaTable,
  currentLevel: number,
  triggerId: string,
  saved: boolean
): { level: number; stage: TraumaStage; gained: number } {
  const trigger = table.triggers?.find((t) => t.id === triggerId);
  if (!trigger) return { level: currentLevel, stage: traumaStage(table, currentLevel), gained: 0 };
  // Regra simples: save reduz em 1, mínimo 0.
  const gain = Math.max(0, trigger.gain - (saved ? 1 : 0));
  const next = clampTraumaLevel(table, currentLevel + gain);
  return { level: next, stage: traumaStage(table, next), gained: gain };
}

/** Reduz o nível pela quantidade informada, respeitando o mínimo. */
export function recoverTrauma(
  table: TraumaTable,
  currentLevel: number,
  amount: number
): { level: number; stage: TraumaStage; recovered: number } {
  const next = clampTraumaLevel(table, currentLevel - Math.max(0, amount));
  return {
    level: next,
    stage: traumaStage(table, next),
    recovered: currentLevel - next
  };
}

/** True se o personagem atingiu o topo da trilha (forçará Cicatriz Psíquica). */
export function atBreakingPoint(table: TraumaTable, level: number): boolean {
  const max = Math.max(...table.track.map((s) => s.level));
  return clampTraumaLevel(table, level) >= max;
}
