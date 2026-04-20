// Cobertura — resolvedor puro.

export interface CoverTier {
  id: string;
  name: string;
  /** null = cobertura total (alvo inalcançável por ataques diretos). */
  dpBonus: number | null;
  /** null = cobertura total (ver blocksLineOfSight). */
  reflexBonus: number | null;
  blocksLineOfSight?: boolean;
  examples?: string[];
  description?: string;
}

export interface CoverTable {
  id: string;
  name?: string;
  description?: string;
  tiers: CoverTier[];
  stacking?: string;
  interactions?: Array<{ id: string; description: string }>;
  notes?: string[];
  [k: string]: unknown;
}

/** Busca o tier por id. */
export function findCoverTier(table: CoverTable, id: string): CoverTier | null {
  if (!id) return null;
  return table.tiers.find((t) => t.id === id) ?? null;
}

export interface CoverEffect {
  dpBonus: number;
  reflexBonus: number;
  blocksLineOfSight: boolean;
}

/** Aplica uma cobertura. Para 'total', dpBonus/reflexBonus ficam em 0 mas blocksLineOfSight=true. */
export function coverEffect(tier: CoverTier | null): CoverEffect {
  if (!tier) return { dpBonus: 0, reflexBonus: 0, blocksLineOfSight: false };
  return {
    dpBonus: tier.dpBonus ?? 0,
    reflexBonus: tier.reflexBonus ?? 0,
    blocksLineOfSight: Boolean(tier.blocksLineOfSight)
  };
}

/** Dado um conjunto de coberturas aplicáveis, retorna a de maior bônus (regra: não empilhar). */
export function bestCover(tiers: CoverTier[]): CoverTier | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((best, t) => {
    const bScore = (best.dpBonus ?? Infinity) + (best.blocksLineOfSight ? 100 : 0);
    const tScore = (t.dpBonus ?? Infinity) + (t.blocksLineOfSight ? 100 : 0);
    return tScore > bScore ? t : best;
  });
}

/** Lista tiers ordenados do menor pro maior pelo dpBonus (null = total, fica por último). */
export function listCoverTiers(table: CoverTable): CoverTier[] {
  return [...table.tiers].sort((a, b) => {
    if (a.dpBonus === null) return 1;
    if (b.dpBonus === null) return -1;
    return a.dpBonus - b.dpBonus;
  });
}
