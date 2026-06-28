/**
 * sharedRepo — queries Prisma para fichas compartilhadas e templates.
 *
 * Server-side. Centraliza o acesso ao model SharedCharacter (ver schema).
 * Visibilidade: linhas com `hiddenAt != null` (moderadas) ficam ocultas pro
 * público; o autor e mods veem via caminhos próprios.
 */
import { db } from '@/lib/db';
import type { SharedKind } from '@prisma/client';

export interface SharedCharacterView {
  id: string;
  kind: SharedKind;
  name: string;
  raceId: string | null;
  level: number;
  concept: string | null;
  data: unknown; // Character JSON — validado/desserializado pelo caller
  summary: string | null;
  tags: string[];
  featured: boolean;
  hiddenAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  author: { id: string; handle: string | null; name: string | null };
}

const viewSelect = {
  id: true,
  kind: true,
  name: true,
  raceId: true,
  level: true,
  concept: true,
  data: true,
  summary: true,
  tags: true,
  featured: true,
  hiddenAt: true,
  updatedAt: true,
  createdAt: true,
  author: { select: { id: true, handle: true, name: true } }
} as const;

/**
 * Busca uma ficha compartilhada/template pelo slug público.
 * Retorna null se não existe ou está oculta pela moderação.
 */
export async function getSharedById(id: string): Promise<SharedCharacterView | null> {
  const row = await db.sharedCharacter.findUnique({
    where: { id },
    select: viewSelect
  });
  if (!row) return null;
  if (row.hiddenAt) return null;
  return row as SharedCharacterView;
}

/**
 * Status de compartilhamento de uma ficha local para um autor. Usado pelo
 * builder pra saber se deve mostrar "compartilhar" ou "parar de compartilhar".
 */
export async function getShareForOwner(
  authorId: string,
  localId: string
): Promise<{ id: string } | null> {
  return db.sharedCharacter.findUnique({
    where: { authorId_localId_kind: { authorId, localId, kind: 'SHARE' } },
    select: { id: true }
  });
}

/**
 * Lista templates publicados. Destaques primeiro, depois mais recentes.
 * `featuredOnly` filtra só os curados. Paginação simples por take/skip.
 */
export async function listTemplates(opts?: {
  featuredOnly?: boolean;
  raceId?: string;
  take?: number;
}): Promise<SharedCharacterView[]> {
  const take = Math.min(60, Math.max(1, opts?.take ?? 40));
  const rows = await db.sharedCharacter.findMany({
    where: {
      kind: 'TEMPLATE',
      hiddenAt: null,
      ...(opts?.featuredOnly ? { featured: true } : {}),
      ...(opts?.raceId ? { raceId: opts.raceId } : {})
    },
    select: viewSelect,
    orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
    take
  });
  return rows as SharedCharacterView[];
}

/**
 * Agregação anonimizada pras estatísticas globais (2.6). Conta sobre tudo que
 * foi tornado público (SHARE + TEMPLATE), sem expor autoria.
 */
export async function aggregateStats(): Promise<{
  total: number;
  byRace: Array<{ raceId: string | null; count: number }>;
  byLevel: Array<{ level: number; count: number }>;
}> {
  const [total, byRaceRaw, byLevelRaw] = await Promise.all([
    db.sharedCharacter.count({ where: { hiddenAt: null } }),
    db.sharedCharacter.groupBy({
      by: ['raceId'],
      where: { hiddenAt: null },
      _count: { _all: true },
      orderBy: { _count: { raceId: 'desc' } }
    }),
    db.sharedCharacter.groupBy({
      by: ['level'],
      where: { hiddenAt: null },
      _count: { _all: true },
      orderBy: { level: 'asc' }
    })
  ]);

  return {
    total,
    byRace: byRaceRaw.map((r) => ({ raceId: r.raceId, count: r._count._all })),
    byLevel: byLevelRaw.map((r) => ({ level: r.level, count: r._count._all }))
  };
}
