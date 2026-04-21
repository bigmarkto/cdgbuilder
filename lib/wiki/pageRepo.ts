/**
 * pageRepo — queries Prisma para páginas community.
 *
 * Tudo aqui é server-side. Mantido em um módulo só pra facilitar teste e
 * evitar espalhar `prisma.page.findMany(...)` por várias rotas.
 *
 * Regras de visibilidade:
 *   • `deletedAt != null` → invisível para todos (soft delete)
 *   • `currentRevisionId == null` → invisível (rascunho sem publicação)
 *   • `currentRevision.status != PUBLISHED` → invisível
 *
 * No futuro (Fase 6) moderação adiciona `locked`, mas locked ainda é
 * visível — só impede edições.
 */
import { db } from '@/lib/db';
import type { PageKind } from '@prisma/client';

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  kind: true,
  canonicalRef: true,
  locked: true,
  deletedAt: true,
  updatedAt: true,
  createdAt: true,
  author: { select: { id: true, handle: true, name: true } },
  currentRevision: { select: { id: true, createdAt: true, summary: true } }
} as const;

const fullSelect = {
  ...summarySelect,
  currentRevision: {
    select: {
      id: true,
      body: true,
      summary: true,
      createdAt: true,
      author: { select: { id: true, handle: true, name: true } }
    }
  }
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lista páginas community publicadas, ordenadas por última edição.
 * Suporta filtro opcional por kind.
 */
export async function listCommunityPages(opts?: { kind?: PageKind; limit?: number }) {
  return db.page.findMany({
    where: {
      deletedAt: null,
      currentRevisionId: { not: null },
      ...(opts?.kind ? { kind: opts.kind } : {})
    },
    select: summarySelect,
    orderBy: { updatedAt: 'desc' },
    take: opts?.limit ?? 100
  });
}

/**
 * Busca uma página community pelo slug + revisão atual.
 * Retorna null se não existe, está deletada, ou não tem revisão publicada.
 */
export async function getCommunityPageBySlug(slug: string) {
  const page = await db.page.findUnique({
    where: { slug },
    select: fullSelect
  });
  if (!page) return null;
  if (page.deletedAt) return null;
  if (!page.currentRevision) return null;
  return page;
}

/**
 * Busca uma página community pelo canonicalRef (ex: "races/agouro").
 * Usado pra injetar "Notas da comunidade" em páginas canonical.
 */
export async function getCommunityPageByCanonicalRef(canonicalRef: string) {
  const page = await db.page.findUnique({
    where: { canonicalRef },
    select: fullSelect
  });
  if (!page) return null;
  if (page.deletedAt) return null;
  if (!page.currentRevision) return null;
  return page;
}

/**
 * Lista revisões de uma página (histórico). Só retorna se a página existe
 * e está visível (não deletada).
 */
export async function listRevisions(pageId: string) {
  return db.revision.findMany({
    where: { pageId },
    select: {
      id: true,
      summary: true,
      status: true,
      createdAt: true,
      author: { select: { id: true, handle: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Busca uma revisão específica (pra visualizar histórico).
 * Retorna também a página pra validar que a revisão pertence à slug correto.
 */
export async function getRevisionById(revisionId: string) {
  return db.revision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      body: true,
      summary: true,
      status: true,
      createdAt: true,
      author: { select: { id: true, handle: true, name: true } },
      page: {
        select: {
          id: true,
          slug: true,
          title: true,
          deletedAt: true,
          currentRevisionId: true
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Formatadores compartilhados
// ---------------------------------------------------------------------------

/**
 * Nome exibido do autor: @handle > name > email-user-part > "anônimo".
 */
export function displayAuthor(author: { handle: string | null; name: string | null }) {
  if (author.handle) return `@${author.handle}`;
  if (author.name) return author.name;
  return 'anônimo';
}
