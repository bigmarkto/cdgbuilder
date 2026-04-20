// Level-up engine. Camada pura: ingere ctx + character e devolve planos/ledgers.
// Nenhuma IO, nenhuma UI. O LevelUpWizard consome `nextLevelPlan`, aplica a
// mutação via store e persiste a entrada com `appendLevelUp`.

import type { Character, LevelUpEntry, LevelChoice } from './character';
import type { DataContext } from './context';
import type { AttrId } from '@/lib/types';
import { xpForLevel } from './xp';

/** Um grant determinístico emitido por um nível (sem escolha do jogador). */
export interface LevelGrant {
  kind:
    | 'hitDieInitial'
    | 'hitDieRoll'
    | 'usosMagiaDelta'
    | 'energiaDelta'
    | 'talentTierUnlock'
    | 'talentXp';
  /** Fórmula textual quando aplicável (ex.: "+1d racial + CON/2"). */
  formula?: string;
  /** Valor numérico quando aplicável. */
  delta?: number;
  /** Apenas para talentTierUnlock. */
  tier?: number;
  /** Apenas para talentXp — quanto XP de árvore o nível concede. */
  xp?: number;
}

/** Uma escolha que o jogador precisa fazer neste nível. */
export interface LevelChoiceSpec {
  kind: 'proficiencyRank' | 'attributePoint';
  delta: number;
  /** Rótulo em PT-BR mostrado no wizard. */
  label: string;
  /** Máximo de rank permitido por tabela (só para proficiencyRank). */
  maxRank?: number;
}

export interface LevelPlanEntry {
  level: number;
  xpRequired: number;
  narrative?: string;
  grants: LevelGrant[];
  choices: LevelChoiceSpec[];
}

export interface LevelGrantsTable {
  id: string;
  name?: string;
  attributeCap: number;
  maxRankByLevel: Array<{ levelFrom: number; levelTo: number; maxRank: number }>;
  talentXpByLevel: Array<{ level: number; xpGranted: number; totalXp: number }>;
  levels: LevelPlanEntry[];
}

// ---------- queries ----------

/** Máximo rank permitido em proficiência dado o nível do personagem. */
export function maxRankAtLevel(table: LevelGrantsTable | undefined, level: number): number {
  if (!table) return Math.ceil(level / 2);
  const row = table.maxRankByLevel.find((r) => level >= r.levelFrom && level <= r.levelTo);
  return row?.maxRank ?? Math.ceil(level / 2);
}

/** Teto absoluto de atributo no sistema. Default 8 se não tabelado. */
export function attributeCap(table: LevelGrantsTable | undefined): number {
  return table?.attributeCap ?? 8;
}

/** Lê o plano de um nível específico. */
export function planForLevel(
  table: LevelGrantsTable | undefined,
  level: number
): LevelPlanEntry | null {
  if (!table) return null;
  return table.levels.find((l) => l.level === level) ?? null;
}

// ---------- planejamento ----------

export interface NextLevelPlan {
  /** Nível atual do personagem (pode estar fora de sincronia com XP). */
  currentLevel: number;
  /** Próximo nível alcançável, considerando XP e teto da tabela. */
  targetLevel: number | null;
  /** XP total exigido para bater o `targetLevel`. */
  xpRequiredForTarget: number | null;
  /** XP que falta até o marco. 0 indica que o marco já foi alcançado. */
  xpMissing: number | null;
  /** True quando o personagem JÁ tem XP para subir. */
  canLevelUp: boolean;
  /** Plano detalhado para o `targetLevel` (grants + choices). */
  entry: LevelPlanEntry | null;
}

export function nextLevelPlan(ctx: DataContext, character: Character): NextLevelPlan {
  const currentLevel = Math.max(1, character.level ?? 1);
  const table = ctx.levelGrants;
  const topLevel = table?.levels[table.levels.length - 1]?.level ?? 12;
  const targetLevel = currentLevel < topLevel ? currentLevel + 1 : null;

  if (targetLevel === null) {
    return {
      currentLevel,
      targetLevel: null,
      xpRequiredForTarget: null,
      xpMissing: null,
      canLevelUp: false,
      entry: null
    };
  }

  const xpMark = xpForLevel(ctx, targetLevel);
  const xpMissing = xpMark !== null ? Math.max(0, xpMark - (character.xp ?? 0)) : null;
  const canLevelUp = xpMissing !== null && xpMissing === 0;
  const entry = planForLevel(table, targetLevel);

  return {
    currentLevel,
    targetLevel,
    xpRequiredForTarget: xpMark,
    xpMissing,
    canLevelUp,
    entry
  };
}

// ---------- aplicação ----------

export interface LevelUpSubmission {
  /** Plano alvo (normalmente obtido via nextLevelPlan). */
  plan: LevelPlanEntry;
  /** Escolhas resolvidas pelo jogador (ordem segue plan.choices). */
  choices: Array<{
    kind: LevelChoiceSpec['kind'];
    /** Para proficiencyRank: id da proficiência. Para attributePoint: AttrId. */
    targetId: string;
    delta: number;
  }>;
  /** Timestamp da aplicação (default: Date.now()). */
  at?: number;
}

export interface LevelUpApplyResult {
  /** Character após aplicar atributos/proficiências/level. */
  character: Character;
  /** Entry para anexar em `levelHistory` via store.appendLevelUp. */
  entry: LevelUpEntry;
  /** Problemas encontrados. Lista vazia = ok. */
  violations: string[];
}

/**
 * Aplica um level-up ao character e gera a entry para o ledger.
 * Não grava no store — o chamador decide (appendLevelUp + replaceCharacter).
 */
export function applyLevelUp(
  ctx: DataContext,
  character: Character,
  submission: LevelUpSubmission
): LevelUpApplyResult {
  const { plan, choices } = submission;
  const at = submission.at ?? Date.now();
  const violations: string[] = [];

  // Valida escolhas contra o plano.
  const expected = plan.choices;
  if (choices.length !== expected.length) {
    violations.push(
      `Esperado ${expected.length} escolha(s), recebido ${choices.length}.`
    );
  }

  const nextAttributes = { ...character.attributesBase };
  const nextProficiencies = { ...character.proficiencies };
  const cap = attributeCap(ctx.levelGrants);
  const maxRank = maxRankAtLevel(ctx.levelGrants, plan.level);

  const appliedChoices: LevelChoice[] = [];

  for (let i = 0; i < expected.length; i++) {
    const spec = expected[i];
    const choice = choices[i];
    if (!choice) continue;

    if (spec.kind === 'attributePoint' && choice.kind === 'attributePoint') {
      const attr = choice.targetId as AttrId;
      const cur = nextAttributes[attr] ?? 0;
      if (cur + choice.delta > cap) {
        violations.push(`Atributo ${attr} excederia o teto ${cap}.`);
      } else {
        nextAttributes[attr] = cur + choice.delta;
        appliedChoices.push({ kind: 'attribute', id: attr, delta: choice.delta });
      }
    } else if (spec.kind === 'proficiencyRank' && choice.kind === 'proficiencyRank') {
      const cur = nextProficiencies[choice.targetId] ?? 0;
      if (cur + choice.delta > maxRank) {
        violations.push(
          `Proficiência ${choice.targetId} excederia o rank máximo ${maxRank} no nível ${plan.level}.`
        );
      } else {
        nextProficiencies[choice.targetId] = cur + choice.delta;
        appliedChoices.push({
          kind: 'proficiency',
          id: choice.targetId,
          delta: choice.delta
        });
      }
    } else {
      violations.push(
        `Tipo de escolha ${choice.kind} não corresponde ao esperado ${spec.kind}.`
      );
    }
  }

  const grantChoices: LevelChoice[] = plan.grants.map((g) => ({
    kind: 'note',
    notes: grantToString(g)
  }));

  const entry: LevelUpEntry = {
    level: plan.level,
    at,
    xpAtLevel: plan.xpRequired,
    grants: grantChoices,
    choices: appliedChoices,
    synthetic: false
  };

  const nextCharacter: Character = {
    ...character,
    level: Math.max(character.level, plan.level),
    attributesBase: nextAttributes,
    proficiencies: nextProficiencies,
    levelHistory: [...(character.levelHistory ?? []), entry]
  };

  return { character: nextCharacter, entry, violations };
}

// ---------- reconstrução sintética ----------

/**
 * Gera um ledger retroativo para um personagem que não tem `levelHistory`.
 * Cada entrada é marcada `synthetic: true` e **não descreve escolhas** —
 * apenas registra o nível atingido e os grants automáticos.
 *
 * Útil para duas situações:
 *   1. Personagem importado/migrado sem histórico (v3→v4);
 *   2. Placeholder de auditoria quando o jogador só digitou XP/level.
 *
 * O engine não tenta adivinhar onde foram parar os pontos de atributo/
 * proficiência — eles já estão em `character.attributesBase`/`proficiencies`.
 */
export function createSyntheticHistory(
  ctx: DataContext,
  character: Character
): LevelUpEntry[] {
  const table = ctx.levelGrants;
  if (!table) return [];
  const topLevel = Math.min(character.level ?? 1, table.levels.length);
  const out: LevelUpEntry[] = [];
  for (let lvl = 1; lvl <= topLevel; lvl++) {
    const plan = planForLevel(table, lvl);
    if (!plan) continue;
    out.push({
      level: lvl,
      at: 0,
      xpAtLevel: plan.xpRequired,
      grants: plan.grants.map((g) => ({ kind: 'note', notes: grantToString(g) })),
      choices: plan.choices.map((c) => ({ kind: 'note', notes: c.label })),
      synthetic: true
    });
  }
  return out;
}

/**
 * Garante que o character tenha um ledger. Se estiver vazio, devolve uma cópia
 * com `levelHistory` preenchido por `createSyntheticHistory`. Idempotente.
 */
export function ensureLevelHistory(ctx: DataContext, character: Character): Character {
  if ((character.levelHistory ?? []).length > 0) return character;
  const synthetic = createSyntheticHistory(ctx, character);
  if (synthetic.length === 0) return character;
  return { ...character, levelHistory: synthetic };
}

// ---------- util ----------

function grantToString(g: LevelGrant): string {
  switch (g.kind) {
    case 'hitDieInitial':
      return `HP inicial: ${g.formula ?? ''}`.trim();
    case 'hitDieRoll':
      return `HP: ${g.formula ?? '+1d + CON/2'}`;
    case 'usosMagiaDelta':
      return `Usos de Magia +${g.delta ?? 0}`;
    case 'energiaDelta':
      return `Energia ${g.formula ?? '+RES'}`;
    case 'talentTierUnlock':
      return `Desbloqueia Tier ${g.tier ?? '?'} de talentos`;
    case 'talentXp':
      return `+${g.xp ?? 0} XP de talentos`;
    default:
      return JSON.stringify(g);
  }
}
