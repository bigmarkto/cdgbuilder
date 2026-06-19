// Combat model — acerto e dano de ataques físicos.
//
// Acerto: d20 + Atributo + BônusRank vs DP do alvo (teste padrão do sistema).
// Dano:  dado da arma + floor(Atributo x damageFactor).
//
// As categorias e fatores vêm de data/rules/combate.json. Cada categoria
// define qual atributo entra no acerto e no dano, e o fator de dano:
//   • corpo / acuidade / arremesso / desarmado → fator 1 (atributo cheio)
//   • distância → fator 0.5 (metade do AGI; compensa o alcance seguro)
//   • conjuração → fator 0 (dano vem da Intensidade, ver casting.ts)
//
// Módulo PURO. Conjuração de Vertente NÃO é calculada aqui — ver casting.ts.

import type { AttrId } from '@/lib/types';
import type { Character } from './character';
import { type DataContext, rankBonus } from './context';
import { computeAttributes } from './attributes';
import { collectModifiers } from './modifiers';
import { resolveNumber } from './effects';

export interface CombatCategory {
  id: string;
  name: string;
  toHitAttr: AttrId | null;
  damageAttr: AttrId | null;
  damageFactor: number;
  defaultProficiency: string | null;
  baseDamage?: string;
  description?: string;
}

export interface CombatTable {
  id: string;
  name?: string;
  toHitFormula?: string;
  damageFormula?: string;
  categories?: CombatCategory[];
  critRule?: { natural20?: string; natural1?: string };
  notes?: string[];
}

export interface AttackProfile {
  /** Id da categoria em combate.json (corpo, acuidade, distancia, …). */
  categoryId: string;
  /** Dado de dano da arma, ex "1d8". Se omitido, usa category.baseDamage ou "1d4". */
  weaponDice?: string;
  /** Override da proficiência usada no acerto. Senão usa category.defaultProficiency. */
  proficiencyId?: string;
  /** Bônus extra de arma no acerto (ex: arma mágica +1). Default 0. */
  weaponToHitBonus?: number;
  /** Bônus extra de arma no dano (ex: +2). Default 0. */
  weaponDamageBonus?: number;
}

export interface AttackResult {
  categoryId: string;
  categoryName: string;
  /** Atributo usado no acerto (null se categoria não usa atributo). */
  toHitAttr: AttrId | null;
  /** Atributo usado no dano. */
  damageAttr: AttrId | null;
  /** Rank da proficiência considerada no acerto. */
  proficiencyId: string | null;
  proficiencyRank: number;
  /** Bônus total de acerto: Atributo + BônusRank + arma + mods. */
  toHitBonus: number;
  /** Modificador de dano por atributo: floor(attr x factor) + arma + mods. */
  damageBonus: number;
  /** Dado da arma usado. */
  weaponDice: string;
  /** Texto pronto: "d20 +7" / "1d8 +4". */
  toHitText: string;
  damageText: string;
}

function findCategory(table: CombatTable | undefined, id: string): CombatCategory | null {
  return table?.categories?.find((c) => c.id === id) ?? null;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Calcula acerto + dano de um ataque dado o perfil.
 * Lê a tabela de ctx.rules.combate (ou recebe via arg).
 */
export function computeAttack(
  ctx: DataContext,
  character: Character,
  profile: AttackProfile,
  table?: CombatTable
): AttackResult {
  const tbl = table ?? ctx.rules?.combate;
  const cat = findCategory(tbl, profile.categoryId);

  if (!cat) {
    // Categoria desconhecida — devolve um resultado neutro pra não quebrar a UI.
    return {
      categoryId: profile.categoryId,
      categoryName: profile.categoryId,
      toHitAttr: null,
      damageAttr: null,
      proficiencyId: profile.proficiencyId ?? null,
      proficiencyRank: 0,
      toHitBonus: 0,
      damageBonus: 0,
      weaponDice: profile.weaponDice ?? '1d4',
      toHitText: 'd20 +0',
      damageText: `${profile.weaponDice ?? '1d4'} +0`
    };
  }

  const attrs = computeAttributes(ctx, character);
  const mods = collectModifiers(ctx, character);

  const profId = profile.proficiencyId ?? cat.defaultProficiency;
  const profRank = profId ? character.proficiencies?.[profId] ?? 0 : 0;
  const profBonus = profId ? rankBonus(ctx, profRank) : 0;

  // To-hit: atributo + bônus de rank + bônus de arma, depois passa pelo
  // pipeline de mods (combat.toHit.<cat>) pra builds adicionarem.
  const toHitAttrVal = cat.toHitAttr ? attrs[cat.toHitAttr]?.total ?? 0 : 0;
  const toHitBase =
    toHitAttrVal + profBonus + (profile.weaponToHitBonus ?? 0);
  const toHit = resolveNumber(toHitBase, mods, `combat.toHit.${cat.id}`).value;

  // Dano: floor(atributo x fator) + bônus de arma, depois pipeline.
  const dmgAttrVal = cat.damageAttr ? attrs[cat.damageAttr]?.total ?? 0 : 0;
  const dmgFromAttr = Math.floor(dmgAttrVal * (cat.damageFactor ?? 0));
  const dmgBase = dmgFromAttr + (profile.weaponDamageBonus ?? 0);
  const dmgBonus = resolveNumber(dmgBase, mods, `combat.damage.${cat.id}`).value;

  const weaponDice = profile.weaponDice ?? cat.baseDamage ?? '1d4';

  return {
    categoryId: cat.id,
    categoryName: cat.name,
    toHitAttr: cat.toHitAttr,
    damageAttr: cat.damageAttr,
    proficiencyId: profId,
    proficiencyRank: profRank,
    toHitBonus: toHit,
    damageBonus: dmgBonus,
    weaponDice,
    toHitText: `d20 ${signed(toHit)}`,
    damageText: `${weaponDice} ${signed(dmgBonus)}`
  };
}
