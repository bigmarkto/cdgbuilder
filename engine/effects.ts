// Effects engine — modificadores empilháveis que pendem de raças, proficiências,
// sub-proficiências, talentos, conjurações, poderes e pactos.
//
// Modelo: `EffectModifier { target, op, value, source, condition? }`.
// Resolver: aplica em pipeline `base → set(override) → +add → clamp(min,max)`.
//
// Notas:
//   - O tipo `Modifier` já existe em `lib/types.ts` e descreve o shape no JSON de
//     dados. Esta camada é a representação NORMALIZADA que a engine consome.
//   - `set` segue last-wins por ordem de inserção (não há prioridades por fonte
//     ainda). Se duas fontes tentam `set` no mesmo alvo, a segunda vence.
//   - `grant` carrega valores não-numéricos (ids, flags). Não entra no pipeline
//     numérico — é coletado separadamente via `resolveGrants`.

import type { Modifier as DataModifier } from '@/lib/types';

export type EffectOp = 'add' | 'set' | 'min' | 'max' | 'grant';

export interface EffectSource {
  kind: 'race' | 'trait' | 'subtype' | 'proficiency' | 'subProficiency' | 'tree' | 'talent' | 'conjuration' | 'power' | 'pacto' | 'scar' | 'custom';
  id: string;
  name?: string;
}

export interface EffectModifier {
  /** Alvo do modificador (ex: 'attr.POT', 'derived.DP', 'prof.luta-armada', 'resistance.fire'). */
  target: string;
  op: EffectOp;
  value: number | string;
  source: EffectSource;
  /** Ativo sob condição narrativa (documentação — engine não avalia). */
  condition?: string;
}

export interface ResolvedNumber {
  value: number;
  /** Mods contribuintes, úteis para UI/tooltip. */
  contributors: EffectModifier[];
}

/**
 * Aplica mods numéricos sobre `base` filtrando pelo `target`.
 *   - `set` (último vence) sobrepõe antes dos adds;
 *   - `add` soma;
 *   - `min` eleva o piso (mais restritivo vence);
 *   - `max` baixa o teto (mais restritivo vence);
 *   - `grant` é ignorado aqui (use `resolveGrants`).
 */
export function resolveNumber(
  base: number,
  mods: readonly EffectModifier[],
  target: string
): ResolvedNumber {
  const relevant = mods.filter((m) => m.target === target);
  const contributors: EffectModifier[] = [];

  let value = base;
  const sets = relevant.filter((m) => m.op === 'set');
  if (sets.length > 0) {
    const last = sets[sets.length - 1];
    const n = toNumber(last.value);
    if (n !== null) {
      value = n;
      contributors.push(last);
    }
  }

  for (const m of relevant) {
    if (m.op !== 'add') continue;
    const n = toNumber(m.value);
    if (n === null) continue;
    value += n;
    contributors.push(m);
  }

  let floor: number | null = null;
  for (const m of relevant) {
    if (m.op !== 'min') continue;
    const n = toNumber(m.value);
    if (n === null) continue;
    floor = floor === null ? n : Math.max(floor, n);
    contributors.push(m);
  }
  if (floor !== null && value < floor) value = floor;

  let ceiling: number | null = null;
  for (const m of relevant) {
    if (m.op !== 'max') continue;
    const n = toNumber(m.value);
    if (n === null) continue;
    ceiling = ceiling === null ? n : Math.min(ceiling, n);
    contributors.push(m);
  }
  if (ceiling !== null && value > ceiling) value = ceiling;

  return { value, contributors };
}

/** Lista de grants (ids/flags) que atuam sobre o `target`. Mantém duplicatas por fonte. */
export function resolveGrants(mods: readonly EffectModifier[], target: string): EffectModifier[] {
  return mods.filter((m) => m.op === 'grant' && m.target === target);
}

/** Todos os targets únicos referenciados por esta pilha de mods. */
export function listTargets(mods: readonly EffectModifier[]): string[] {
  const set = new Set<string>();
  for (const m of mods) set.add(m.target);
  return [...set];
}

/**
 * Converte um Modifier no formato do JSON de dados para a forma normalizada.
 * Heurística permissiva — o JSON ainda tem variação. Retorna null se
 * indecodificável.
 */
export function normalizeDataModifier(
  raw: DataModifier,
  source: EffectSource
): EffectModifier | null {
  const target = targetFromData(raw);
  if (!target) return null;
  const op = opFromData(raw);
  const value = valueFromData(raw, op);
  if (value === null) return null;
  const out: EffectModifier = { target, op, value, source };
  if (raw.text) out.condition = raw.text;
  return out;
}

function targetFromData(raw: DataModifier): string | null {
  // Ex: { type: 'attribute', attr: 'POT', value: 1 } → 'attr.POT'
  //     { type: 'proficiency', id: 'luta-armada', rankDelta: 1 } → 'prof.luta-armada'
  //     { type: 'resistance', damageType: 'fogo', value: '50%' } → 'resistance.fogo'
  //     { type: 'speed', value: 12 } → 'speed'
  //     { type: 'derived', id: 'DP', value: 1 } → 'derived.DP'
  //     { type: 'grant', id: 'darkvision' } → 'grant.darkvision'
  switch (raw.type) {
    case 'attribute':
      return raw.attr ? `attr.${raw.attr}` : null;
    case 'proficiency':
      return raw.id ? `prof.${raw.id}` : null;
    case 'subProficiency':
      return raw.id ? `sub.${raw.id}` : null;
    case 'derived':
      return raw.id ? `derived.${raw.id}` : raw.target ?? null;
    case 'resistance':
      return raw.damageType ? `resistance.${raw.damageType}` : null;
    case 'immunity':
      return raw.damageType ? `immunity.${raw.damageType}` : null;
    case 'speed':
      return 'speed';
    case 'grant':
      return raw.id ? `grant.${raw.id}` : null;
    case 'custom':
    default:
      return raw.target ?? null;
  }
}

function opFromData(raw: DataModifier): EffectOp {
  // Heurística: rankDelta/value numérico → add; grant → grant; explicit 'set' na string.
  if (raw.type === 'grant') return 'grant';
  if (raw.type === 'immunity') return 'set';
  if (typeof raw.value === 'string' && /^set:/i.test(raw.value)) return 'set';
  return 'add';
}

function valueFromData(raw: DataModifier, op: EffectOp): number | string | null {
  if (raw.type === 'proficiency' && typeof raw.rankDelta === 'number') return raw.rankDelta;
  if (typeof raw.value === 'number') return raw.value;
  if (typeof raw.value === 'string') {
    if (op === 'grant') return raw.value;
    if (op === 'set') return raw.value.replace(/^set:/i, '').trim();
    const n = Number(raw.value);
    return Number.isFinite(n) ? n : raw.value;
  }
  if (raw.id && op === 'grant') return raw.id;
  return null;
}

function toNumber(v: number | string): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
