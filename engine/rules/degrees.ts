// Graus de Sucesso — resolvedor puro.
// Input: tabela (data/rules/degrees-of-success.json), roll (d20 nat), modifier total, DT.
// Output: grau atingido + margem + flags (nat20/nat1 shift aplicado).

export interface DegreeRow {
  id: string;
  name: string;
  order: number;
  rule?: string;
  narrative?: string;
}

export interface DegreesOfSuccessTable {
  id: string;
  name?: string;
  description?: string;
  degrees: DegreeRow[];
  naturalShift?: {
    nat20?: { delta: number; note?: string };
    nat1?: { delta: number; note?: string };
  };
  margins?: {
    criticalUpper?: number;
    criticalLower?: number;
    note?: string;
  };
  applicabilityHints?: Array<{ id: string; description: string }>;
  notes?: string[];
  [k: string]: unknown;
}

export interface ComputeDegreeInput {
  /** Valor do d20 natural (1–20). */
  natural: number;
  /** Soma de atributo + proficiência + modificadores situacionais. */
  modifier: number;
  /** DT do teste. */
  dt: number;
  /** Se true, ignora a regra de margem e considera apenas sucesso/falha (útil para narrativa rápida). */
  ignoreMargins?: boolean;
}

export interface ComputeDegreeResult {
  /** d20 natural. */
  natural: number;
  /** Total rolado (natural + modifier). */
  total: number;
  /** Margem = total − DT. */
  margin: number;
  /** Grau final resolvido (pós shift). */
  degree: DegreeRow;
  /** Grau antes do shift de nat20/nat1 — para telemetria/diagnóstico. */
  baseDegree: DegreeRow;
  /** True se a nat20/nat1 alterou o grau. */
  shifted: boolean;
}

/** Ordena graus do pior pro melhor, via `order`. */
function sortedDegrees(table: DegreesOfSuccessTable): DegreeRow[] {
  return [...table.degrees].sort((a, b) => a.order - b.order);
}

function degreeForMargin(table: DegreesOfSuccessTable, margin: number): DegreeRow {
  const degrees = sortedDegrees(table);
  const upper = table.margins?.criticalUpper ?? 10;
  const lower = table.margins?.criticalLower ?? -10;
  // pior → melhor: falha-critica, falha, sucesso, sucesso-critico
  // mapeamento por margem:
  //   margin <= lower          → order mínimo
  //   lower < margin < 0       → order -1
  //   0 <= margin < upper      → order 1
  //   margin >= upper          → order máximo
  if (margin <= lower) return degrees[0];
  if (margin < 0) return degrees.find((d) => d.order === -1) ?? degrees[0];
  if (margin < upper) return degrees.find((d) => d.order === 1) ?? degrees[degrees.length - 1];
  return degrees[degrees.length - 1];
}

function shiftByDelta(table: DegreesOfSuccessTable, start: DegreeRow, delta: number): DegreeRow {
  if (!delta) return start;
  const degrees = sortedDegrees(table);
  const idx = degrees.findIndex((d) => d.id === start.id);
  const next = Math.max(0, Math.min(degrees.length - 1, idx + delta));
  return degrees[next];
}

export function computeDegree(
  table: DegreesOfSuccessTable,
  input: ComputeDegreeInput
): ComputeDegreeResult {
  const natural = input.natural;
  const total = natural + input.modifier;
  const margin = total - input.dt;

  const base = input.ignoreMargins
    ? margin >= 0
      ? sortedDegrees(table).find((d) => d.order === 1) ?? sortedDegrees(table)[sortedDegrees(table).length - 1]
      : sortedDegrees(table).find((d) => d.order === -1) ?? sortedDegrees(table)[0]
    : degreeForMargin(table, margin);

  let after = base;
  if (natural === 20 && table.naturalShift?.nat20) {
    after = shiftByDelta(table, after, table.naturalShift.nat20.delta);
  } else if (natural === 1 && table.naturalShift?.nat1) {
    after = shiftByDelta(table, after, table.naturalShift.nat1.delta);
  }

  return {
    natural,
    total,
    margin,
    degree: after,
    baseDegree: base,
    shifted: after.id !== base.id
  };
}

/** Helper: True se o resultado é sucesso (qualquer grau ≥ 1). */
export function isSuccess(result: ComputeDegreeResult): boolean {
  return result.degree.order >= 1;
}

/** Helper: True se é sucesso crítico. */
export function isCriticalSuccess(result: ComputeDegreeResult): boolean {
  return result.degree.order >= 2;
}

/** Helper: True se é falha crítica. */
export function isCriticalFailure(result: ComputeDegreeResult): boolean {
  return result.degree.order <= -2;
}
