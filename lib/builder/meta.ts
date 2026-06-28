/**
 * meta — validação e extração dos campos denormalizados de um Character JSON
 * vindo do cliente. Pura (sem 'use server'); compartilhada por shareActions
 * e templateActions.
 */

// Teto defensivo: o Character serializado é pequeno (<50KB típico). 400KB
// cobre fichas gigantes com folga e barra payloads abusivos.
export const MAX_DATA_BYTES = 400 * 1024;
const MAX_LEVEL = 12;

export interface CharacterMeta {
  localId: string;
  name: string;
  raceId: string | null;
  level: number;
  concept: string | null;
}

/**
 * Valida o payload e extrai meta. Não confia na estrutura — só no que provar.
 * Retorna `{ error }` se inválido. `id` do JSON precisa bater com `localId`.
 */
export function extractCharacterMeta(
  data: unknown,
  localId: string
): CharacterMeta | { error: string } {
  if (!data || typeof data !== 'object') {
    return { error: 'Ficha inválida.' };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { error: 'Ficha não serializável.' };
  }
  if (serialized.length > MAX_DATA_BYTES) {
    return { error: 'Ficha grande demais para publicar.' };
  }

  const c = data as Record<string, unknown>;
  if (typeof c.id !== 'string' || c.id !== localId) {
    return { error: 'Identificador da ficha não confere.' };
  }

  const name =
    typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 120) : 'Sem nome';
  const raceId = typeof c.raceId === 'string' && c.raceId ? c.raceId : null;
  const levelRaw = typeof c.level === 'number' ? Math.floor(c.level) : 1;
  const level = Math.max(1, Math.min(MAX_LEVEL, levelRaw));
  const concept =
    typeof c.concept === 'string' && c.concept.trim() ? c.concept.trim().slice(0, 240) : null;

  return { localId, name, raceId, level, concept };
}

/** Normaliza tags: minúsculas, sem duplicar, máx 6, cada uma ≤ 24 chars. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const clean = t.trim().toLowerCase().slice(0, 24);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= 6) break;
  }
  return out;
}
