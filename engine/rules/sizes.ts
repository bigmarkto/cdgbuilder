// Categorias de Tamanho — resolvedor puro.

export interface SizeRecord {
  id: string;
  name: string;
  order: number;
  spaceMeters: number;
  reachMeters: number;
  attackMod: number;
  stealthMod: number;
  carryMult: number;
  examples?: string[];
}

export interface SizesTable {
  id: string;
  name?: string;
  description?: string;
  sizes: SizeRecord[];
  rules?: Array<{ id: string; name?: string; description: string }>;
  notes?: string[];
  [k: string]: unknown;
}

/** Busca tamanho por id. */
export function sizeInfo(table: SizesTable, id: string): SizeRecord | null {
  if (!id) return null;
  return table.sizes.find((s) => s.id === id) ?? null;
}

/** Ordem canônica do menor pro maior. */
export function sortedSizes(table: SizesTable): SizeRecord[] {
  return [...table.sizes].sort((a, b) => a.order - b.order);
}

/** Delta de tamanho entre atacante e alvo: positivo se atacante é maior.
 *  Retorna null se algum id for inválido. */
export function sizeDelta(
  table: SizesTable,
  attackerId: string,
  targetId: string
): number | null {
  const a = sizeInfo(table, attackerId);
  const t = sizeInfo(table, targetId);
  if (!a || !t) return null;
  return a.order - t.order;
}

/** Bônus de ataque por diferença de tamanho (+1 por categoria maior, clamp ±3). */
export function sizeAttackBonus(
  table: SizesTable,
  attackerId: string,
  targetId: string
): number {
  const delta = sizeDelta(table, attackerId, targetId);
  if (delta === null) return 0;
  return Math.max(-3, Math.min(3, delta));
}

/** True se o agarrão é válido (diferença ≤ 1). */
export function canGrapple(
  table: SizesTable,
  attackerId: string,
  targetId: string
): boolean {
  const delta = sizeDelta(table, attackerId, targetId);
  if (delta === null) return false;
  return Math.abs(delta) <= 1;
}

/** Carga multiplicada pelo carryMult do portador. */
export function carryCapacity(table: SizesTable, sizeId: string, baseCarry: number): number {
  const info = sizeInfo(table, sizeId);
  if (!info) return baseCarry;
  return Math.floor(baseCarry * info.carryMult);
}
