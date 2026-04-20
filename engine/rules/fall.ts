// Dano de Queda — resolvedor puro.

export interface FallRow {
  id: string;
  minMeters: number;
  /** null = sem teto (faixa terminal). */
  maxMeters: number | null;
  dice: string;
  note?: string;
}

export interface FallSurface {
  id: string;
  name: string;
  multiplier: number;
  examples?: string[];
  note?: string;
}

export interface FallTable {
  id: string;
  name?: string;
  description?: string;
  damageType?: string;
  startMeters?: number;
  capDice?: string;
  table: FallRow[];
  surfaceModifiers?: FallSurface[];
  reductions?: Array<{ id: string; name?: string; description: string }>;
  stacking?: string;
  notes?: string[];
  [k: string]: unknown;
}

/** Encontra a linha da tabela para uma altura (metros). */
export function rowForMeters(table: FallTable, meters: number): FallRow {
  const m = Math.max(0, Math.floor(meters));
  for (const row of table.table) {
    if (m < row.minMeters) continue;
    if (row.maxMeters === null || m <= row.maxMeters) return row;
  }
  // Caso a tabela não cubra — usa a última linha.
  return table.table[table.table.length - 1];
}

export function surfaceModifier(table: FallTable, surfaceId: string | null | undefined): FallSurface | null {
  if (!surfaceId) return null;
  return table.surfaceModifiers?.find((s) => s.id === surfaceId) ?? null;
}

export interface FallDamageOptions {
  /** Altura efetiva após reduções por reações (Reflexos "agarrar apoio" subtrai 3m, etc.). */
  metersAfterReactions?: number;
  /** Id da superfície (macia/rigida/letal). */
  surfaceId?: string | null;
  /** Multiplicador adicional por habilidade de árvore (ex: 0.5 reduz metade). Aplicado antes da superfície. */
  abilityMultiplier?: number;
}

export interface FallDamageResult {
  meters: number;
  row: FallRow;
  baseDice: string;
  finalDice: string;
  surfaceApplied: FallSurface | null;
  abilityMultiplier: number;
  damageType: string;
  note?: string;
}

/** Multiplica uma expressão de dados 'NdM' por um fator. Arredonda para cima.
 *  Se a expressão for '0' ou vazia, devolve '0'. */
export function multiplyDice(expr: string, factor: number): string {
  if (!expr || expr === '0') return '0';
  const m = expr.match(/^(\d+)d(\d+)$/i);
  if (!m) return expr; // formato livre — não mexe
  const n = parseInt(m[1], 10);
  const f = parseInt(m[2], 10);
  const scaled = Math.max(0, Math.ceil(n * factor));
  if (scaled === 0) return '0';
  return `${scaled}d${f}`;
}

/** Calcula o dano de queda para uma altura, aplicando reações → habilidade → superfície. */
export function fallDamage(
  table: FallTable,
  meters: number,
  opts: FallDamageOptions = {}
): FallDamageResult {
  const effMeters = Math.max(0, opts.metersAfterReactions ?? meters);
  const row = rowForMeters(table, effMeters);
  const abilityMult = opts.abilityMultiplier ?? 1;
  const surface = surfaceModifier(table, opts.surfaceId);
  const surfaceMult = surface?.multiplier ?? 1;
  const combinedMult = abilityMult * surfaceMult;
  const finalDice = multiplyDice(row.dice, combinedMult);

  return {
    meters: effMeters,
    row,
    baseDice: row.dice,
    finalDice,
    surfaceApplied: surface,
    abilityMultiplier: abilityMult,
    damageType: table.damageType ?? 'contundente',
    note: row.note
  };
}
