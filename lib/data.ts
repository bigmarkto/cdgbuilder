import fs from 'node:fs';
import path from 'node:path';
import type { CollectionId, EntityBase, Race, Tree, Vertente, Pacto, Scar, ProficiencyIndex, SystemConstants, Derived, Creation } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function readJson<T = unknown>(abs: string): T {
  return JSON.parse(fs.readFileSync(abs, 'utf8')) as T;
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

export function loadCollection<T = EntityBase>(col: CollectionId): T[] {
  const dir = path.join(DATA_DIR, col);
  return listJsonFiles(dir).map((f) => readJson<T>(path.join(dir, f)));
}

export function loadCollectionRaw(col: CollectionId): Record<string, unknown>[] {
  return loadCollection<Record<string, unknown>>(col);
}

export function loadEntity<T = EntityBase>(col: CollectionId, id: string): T | null {
  const direct = path.join(DATA_DIR, col, `${id}.json`);
  if (fs.existsSync(direct)) return readJson<T>(direct);

  // Fallback: search index.json (or any other file) for a matching id / nested entity list.
  for (const f of listJsonFiles(path.join(DATA_DIR, col))) {
    const data = readJson<Record<string, unknown>>(path.join(DATA_DIR, col, f));
    if (data?.id === id) return data as T;
    const nested = findNestedById(data, id);
    if (nested) return nested as T;
  }
  return null;
}

function findNestedById(obj: unknown, id: string): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findNestedById(item, id);
      if (found) return found;
    }
    return null;
  }
  const record = obj as Record<string, unknown>;
  if (record.id === id) return record;
  for (const v of Object.values(record)) {
    if (v && typeof v === 'object') {
      const found = findNestedById(v, id);
      if (found) return found;
    }
  }
  return null;
}

export function collectionSummary(col: CollectionId): Array<{ id: string; name: string; description?: string; source?: string; file: string }> {
  const dir = path.join(DATA_DIR, col);
  return listJsonFiles(dir).map((f) => {
    const data = readJson<EntityBase>(path.join(dir, f));
    return {
      id: String(data.id ?? f.replace(/\.json$/, '')),
      name: String(data.name ?? data.id ?? f),
      description: typeof data.description === 'string' ? data.description : undefined,
      source: typeof data.source === 'string' ? data.source : undefined,
      file: f
    };
  });
}

// Typed helpers for frequently-used collections:
export const loadRaces = () => loadCollection<Race>('races');
export const loadTrees = () => loadCollection<Tree>('trees');
export const loadVertentes = () => loadCollection<Vertente>('vertentes');
export const loadPactos = () => loadCollection<Pacto>('pactos');
export const loadScars = () => loadCollection<Scar>('scars');

export function loadSystem(): SystemConstants | null {
  return loadEntity<SystemConstants>('meta', 'sistema');
}
export function loadDerived(): Derived | null {
  return loadEntity<Derived>('meta', 'valores-derivados');
}
export function loadCreation(): Creation | null {
  return loadEntity<Creation>('meta', 'criacao');
}
export function loadProficiencyIndex(): ProficiencyIndex | null {
  return loadEntity<ProficiencyIndex>('proficiencies', 'sistema-proficiencias') ?? loadEntity<ProficiencyIndex>('proficiencies', 'proficiencias') ?? loadCollection<ProficiencyIndex>('proficiencies')[0] ?? null;
}

/** Tabela de progressão (níveis/XP). Lê data/progression/niveis.json. */
export function loadProgression(): Record<string, unknown> | null {
  return (
    loadEntity<Record<string, unknown>>('progression', 'niveis') ??
    (loadCollection<Record<string, unknown>>('progression')[0] ?? null)
  );
}

/** Grants por nível (destilado, machine-readable). Sprint E.
 *  Lê data/progression/levelup-grants.json. */
export function loadLevelGrants(): Record<string, unknown> | null {
  return loadEntity<Record<string, unknown>>('progression', 'levelup-grants');
}

/** Sistema de conjurações (Lei Universal da Energia Cósmica).
 *  Lê data/vertentes/system.json. */
export function loadVertenteSystem(): Record<string, unknown> | null {
  return loadEntity<Record<string, unknown>>('vertentes', 'system')
    ?? loadEntity<Record<string, unknown>>('vertentes', 'sistema-energia-cosmica');
}

/** Pacote de regras Vale Desperto v2.0 (port). Lê data/rules/*.json.
 *  Retorna null para cada módulo ausente — o caller é responsável por lidar com opcionais. */
export function loadRulesBundle(): {
  degrees: Record<string, unknown> | null;
  conditions: Record<string, unknown> | null;
  cover: Record<string, unknown> | null;
  trauma: Record<string, unknown> | null;
  fall: Record<string, unknown> | null;
  sizes: Record<string, unknown> | null;
  acoes: Record<string, unknown> | null;
  combate: Record<string, unknown> | null;
} {
  return {
    degrees: loadEntity<Record<string, unknown>>('rules', 'graus-de-sucesso'),
    conditions: loadEntity<Record<string, unknown>>('rules', 'condicoes'),
    cover: loadEntity<Record<string, unknown>>('rules', 'cobertura'),
    trauma: loadEntity<Record<string, unknown>>('rules', 'trauma'),
    fall: loadEntity<Record<string, unknown>>('rules', 'dano-de-queda'),
    sizes: loadEntity<Record<string, unknown>>('rules', 'tamanhos'),
    // Balanceamento 1.2 / 1.4 — economia de ações e modelo de combate.
    acoes: loadEntity<Record<string, unknown>>('rules', 'acoes'),
    combate: loadEntity<Record<string, unknown>>('rules', 'combate')
  };
}
