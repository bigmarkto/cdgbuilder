// Fixtures mínimos pros testes de actions / combat / casting.
// Não é um arquivo de teste (sem describe) — só helpers importados.

import type { DataContext } from '../context';
import type { Character } from '../character';
import { emptyCharacter } from '../character';
import type { ActionsTable } from '../actions';
import type { CombatTable } from '../combat';

/** Tabela de ranks idêntica à de data/proficiencies/index.json. */
export const RANKS = [
  { id: 'nenhum', name: 'Nenhum', bonus: -4 },
  { id: 'assertivo', name: 'Assertivo', bonus: 0 },
  { id: 'aprendiz', name: 'Aprendiz', bonus: 2 },
  { id: 'treinado', name: 'Treinado', bonus: 4 },
  { id: 'profissional', name: 'Profissional', bonus: 6 },
  { id: 'expert', name: 'Expert', bonus: 8 },
  { id: 'mestre', name: 'Mestre', bonus: 10 }
];

export const ACOES: ActionsTable = {
  id: 'economia-de-acoes',
  baseBudget: { standard: 1, move: 1, bonus: 1, reaction: 1 }
};

export const COMBATE: CombatTable = {
  id: 'modelo-de-combate',
  categories: [
    { id: 'corpo', name: 'Corpo-a-corpo', toHitAttr: 'POT', damageAttr: 'POT', damageFactor: 1, defaultProficiency: 'luta-armada' },
    { id: 'desarmado', name: 'Desarmado', toHitAttr: 'POT', damageAttr: 'POT', damageFactor: 1, defaultProficiency: 'luta-desarmada', baseDamage: '1d4' },
    { id: 'acuidade', name: 'Acuidade', toHitAttr: 'AGI', damageAttr: 'AGI', damageFactor: 1, defaultProficiency: 'luta-armada' },
    { id: 'distancia', name: 'À distância', toHitAttr: 'AGI', damageAttr: 'AGI', damageFactor: 0.5, defaultProficiency: 'atirar' },
    { id: 'conjuracao', name: 'Conjuração', toHitAttr: null, damageAttr: null, damageFactor: 0, defaultProficiency: null }
  ]
};

export const INTENSITIES = [
  { id: 'leve', name: 'Leve', dice: '1d6', controlDT: 10, costModifier: 0 },
  { id: 'moderado', name: 'Moderado', dice: '2d8', controlDT: 14, costModifier: 1 },
  { id: 'forte', name: 'Forte', dice: '3d10', controlDT: 18, costModifier: 2 },
  { id: 'devastador', name: 'Devastador', dice: '4d12', controlDT: 22, costModifier: 3 }
];

export const UNTRAINED_RULES = {
  trainedThreshold: 1,
  manaSurchargeByIntensity: { leve: 1, moderado: 2, forte: 3, devastador: 4 }
};

/** Monta um DataContext mínimo. Sem raça → atributos = attributesBase puro. */
export function makeCtx(extra?: Partial<DataContext>): DataContext {
  return {
    system: { baseSpeed: 9 },
    creation: {},
    derived: {},
    races: [],
    proficiencies: { ranks: RANKS },
    vertentes: [
      {
        id: 'braseira',
        name: 'Braseira',
        governingAttributes: ['PRE', 'CON', 'PER']
      }
    ],
    rules: { acoes: ACOES, combate: COMBATE },
    ...extra
  } as unknown as DataContext;
}

/** Personagem de teste com atributos definidos e proficiências opcionais. */
export function makeChar(
  attributesBase: Partial<Character['attributesBase']>,
  proficiencies: Record<string, number> = {}
): Character {
  const c = emptyCharacter();
  c.attributesBase = { ...c.attributesBase, ...attributesBase };
  c.proficiencies = proficiencies;
  return c;
}
