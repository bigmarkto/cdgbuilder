// Casting model — custo e risco de conjurar uma Vertente, treinado ou não.
//
// Regra de balanceamento (1.1): qualquer um PODE conjurar qualquer Vertente,
// mas conjurar uma em que não se tem proficiência (Rank 0 / "Nenhum") cobra
// um preço:
//   • Sobretaxa de Energia por Intensidade (leve+1 … devastador+4).
//   • Teste de Controle: d20 + AtributoGovernante + BônusRank vs DT da
//     Intensidade. Rank 0 já aplica -4 pelo próprio bônus de rank.
//   • Falha = fizzle (Energia gasta à toa). 1 natural = refluxo (dano + Trauma).
//
// Treinar a Vertente (Rank ≥ trainedThreshold) zera a sobretaxa e dispensa o teste.
//
// Módulo PURO. As regras vêm de data/vertentes/system.json (untrainedCasting +
// intensities); passadas explicitamente pra manter testabilidade.

import type { AttrId, Vertente } from '@/lib/types';
import type { Character } from './character';
import { type DataContext, rankBonus } from './context';
import { computeAttributes } from './attributes';

export interface IntensitySpec {
  id: string;
  name?: string;
  dice?: string;
  controlDT?: number;
  costModifier?: number;
}

export interface UntrainedCastingRules {
  trainedThreshold?: number;
  manaSurchargeByIntensity?: Record<string, number>;
  controlTest?: { dtSource?: string };
}

export interface CastingInput {
  /** Id da vertente conjurada (chave em character.proficiencies). */
  vertenteId: string;
  /** Custo base de Energia (Forma + Alcance + Intensidade). Default 0. */
  baseEnergyCost?: number;
  /** Id da Intensidade escolhida (leve/moderado/forte/devastador). */
  intensityId: string;
  /** Override do atributo governante. Senão usa o maior dos governantes da vertente. */
  governingAttr?: AttrId;
}

export interface CastingResult {
  vertenteId: string;
  /** Rank do personagem na vertente. 0 = não-treinado. */
  rank: number;
  trained: boolean;
  governingAttr: AttrId | null;
  /** Custo base (sem sobretaxa). */
  baseEnergyCost: number;
  /** Sobretaxa por não-treino (0 se treinado). */
  surcharge: number;
  /** Custo final de Energia = base + sobretaxa. */
  energyCost: number;
  /** DT do teste de controle (null se treinado — não precisa testar). */
  controlDT: number | null;
  /** Bônus do teste de controle: AtributoGovernante + BônusRank. null se treinado. */
  controlTestBonus: number | null;
  /** Texto pronto do teste, ex "d20 +1 vs DT 14". null se treinado. */
  controlTestText: string | null;
}

const DEFAULT_THRESHOLD = 1;

/** Rank do personagem numa vertente (0 se ausente). */
export function vertenteRank(character: Character, vertenteId: string): number {
  return character.proficiencies?.[vertenteId] ?? 0;
}

/**
 * Escolhe o atributo governante: o maior, entre os governingAttributes da
 * vertente, no total do personagem. Null se a vertente não tiver governantes.
 */
function resolveGoverningAttr(
  ctx: DataContext,
  character: Character,
  vertenteId: string,
  override?: AttrId
): AttrId | null {
  if (override) return override;
  const vert = (ctx.vertentes ?? []).find((v) => v.id === vertenteId) as
    | (Vertente & { governingAttributes?: AttrId[] })
    | undefined;
  const govs = vert?.governingAttributes ?? [];
  if (govs.length === 0) return null;
  const attrs = computeAttributes(ctx, character);
  let best: AttrId | null = null;
  let bestVal = -Infinity;
  for (const id of govs) {
    const v = attrs[id]?.total ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = id;
    }
  }
  return best;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Calcula custo + risco de conjurar. `rules` é o bloco untrainedCasting do
 * system.json; `intensities` é a lista de intensidades (pra ler a controlDT).
 */
export function computeCastingCost(
  ctx: DataContext,
  character: Character,
  input: CastingInput,
  rules: UntrainedCastingRules,
  intensities: IntensitySpec[]
): CastingResult {
  const threshold = rules.trainedThreshold ?? DEFAULT_THRESHOLD;
  const rank = vertenteRank(character, input.vertenteId);
  const trained = rank >= threshold;

  const governingAttr = resolveGoverningAttr(
    ctx,
    character,
    input.vertenteId,
    input.governingAttr
  );

  const baseEnergyCost = Math.max(0, input.baseEnergyCost ?? 0);
  const surchargeTable = rules.manaSurchargeByIntensity ?? {};
  const surcharge = trained ? 0 : surchargeTable[input.intensityId] ?? 0;
  const energyCost = baseEnergyCost + surcharge;

  const intensity = intensities.find((i) => i.id === input.intensityId);
  const dt = intensity?.controlDT ?? null;

  if (trained) {
    return {
      vertenteId: input.vertenteId,
      rank,
      trained: true,
      governingAttr,
      baseEnergyCost,
      surcharge: 0,
      energyCost,
      controlDT: null,
      controlTestBonus: null,
      controlTestText: null
    };
  }

  // Não-treinado: monta o teste de controle.
  const attrs = computeAttributes(ctx, character);
  const attrVal = governingAttr ? attrs[governingAttr]?.total ?? 0 : 0;
  const testBonus = attrVal + rankBonus(ctx, rank); // rank 0 → -4 naturalmente
  const text = dt !== null ? `d20 ${signed(testBonus)} vs DT ${dt}` : `d20 ${signed(testBonus)}`;

  return {
    vertenteId: input.vertenteId,
    rank,
    trained: false,
    governingAttr,
    baseEnergyCost,
    surcharge,
    energyCost,
    controlDT: dt,
    controlTestBonus: testBonus,
    controlTestText: text
  };
}
