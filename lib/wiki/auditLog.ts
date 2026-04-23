/**
 * AuditLog — trilha de ações sensíveis (moderação, mudança de role, ban).
 *
 * Por que um módulo central:
 *   • Centraliza o shape de `action` (string, mas enumerado aqui pra evitar
 *     typos espalhados).
 *   • Garante que toda escrita inclua actorId atual — a action NUNCA aceita
 *     actorId como argumento externo, evita falsificação.
 *   • `meta` fica livre (Json) mas documentamos convenções por ação abaixo.
 *
 * Semântica:
 *   • Escrita é best-effort, depois do commit da mutação principal. Se o
 *     insert no AuditLog falha, logamos no console e seguimos — preferimos
 *     perder uma entrada de auditoria a desfazer a ação do moderador.
 *   • Leitura é via `listRecentAudit()` — o admin panel paginará.
 */

import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// Enumeração das actions conhecidas. String literal pra continuar compatível
// com o schema (que usa `String`), mas nos forçamos a passar por aqui.
export const AUDIT_ACTIONS = {
  // Páginas
  PAGE_LOCK: 'PAGE_LOCK',
  PAGE_UNLOCK: 'PAGE_UNLOCK',
  PAGE_DELETE: 'PAGE_DELETE',
  PAGE_RESTORE: 'PAGE_RESTORE',
  // Revisões
  REVISION_REVERT: 'REVISION_REVERT',
  REVISION_HIDE: 'REVISION_HIDE',
  REVISION_UNHIDE: 'REVISION_UNHIDE',
  // Comentários
  COMMENT_HIDE: 'COMMENT_HIDE',
  COMMENT_UNHIDE: 'COMMENT_UNHIDE',
  COMMENT_DELETE_MOD: 'COMMENT_DELETE_MOD', // deleção por mod, não pelo autor
  // Usuários
  USER_BAN: 'USER_BAN',
  USER_UNBAN: 'USER_UNBAN',
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE'
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditEntityType = 'page' | 'revision' | 'comment' | 'user';

export interface WriteAuditInput {
  actorId: string;
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  /**
   * Metadata livre. Convenções por ação:
   *   • PAGE_LOCK / PAGE_UNLOCK: { slug, reason? }
   *   • PAGE_DELETE / PAGE_RESTORE: { slug, reason? }
   *   • REVISION_REVERT: { pageSlug, fromRevisionId, toRevisionId }
   *   • REVISION_HIDE / UNHIDE: { pageSlug, reason? }
   *   • COMMENT_HIDE / UNHIDE: { pageSlug, reason? }
   *   • COMMENT_DELETE_MOD: { pageSlug, authorHandle?, excerpt }
   *   • USER_BAN / USER_UNBAN: { handle?, email?, reason? }
   *   • USER_ROLE_CHANGE: { handle?, email?, fromRole, toRole }
   */
  meta?: Record<string, unknown>;
}

/**
 * Grava uma entrada de auditoria. Nunca throw — erros são logados mas não
 * propagam. Chame DEPOIS do commit da mutação principal.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[writeAudit] falhou, ignorando:', err, {
      action: input.action,
      entityId: input.entityId
    });
  }
}

/**
 * Lista entradas recentes com o ator, pra admin viewer. Paginação por cursor
 * (createdAt desc + id como tie-breaker).
 */
export interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
  actor: {
    id: string;
    handle: string | null;
    name: string | null;
    email: string | null;
  };
}

export interface ListAuditOptions {
  limit?: number;
  beforeId?: string; // paginação: passa o id da última entrada da página anterior
  action?: AuditAction; // filtra por tipo
  actorId?: string;
}

export async function listRecentAudit(
  opts: ListAuditOptions = {}
): Promise<AuditEntry[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));

  const where: Prisma.AuditLogWhereInput = {};
  if (opts.action) where.action = opts.action;
  if (opts.actorId) where.actorId = opts.actorId;

  // Cursor simples: "entradas anteriores a beforeId" — usamos createdAt < X.
  if (opts.beforeId) {
    const ref = await db.auditLog.findUnique({
      where: { id: opts.beforeId },
      select: { createdAt: true }
    });
    if (ref) where.createdAt = { lt: ref.createdAt };
  }

  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      meta: true,
      createdAt: true,
      actor: {
        select: { id: true, handle: true, name: true, email: true }
      }
    }
  });

  return rows;
}

/**
 * Rótulo human-readable pra ação. Usado no admin viewer.
 */
export function describeAction(action: string): string {
  switch (action) {
    case AUDIT_ACTIONS.PAGE_LOCK:
      return 'Trancou página';
    case AUDIT_ACTIONS.PAGE_UNLOCK:
      return 'Destrancou página';
    case AUDIT_ACTIONS.PAGE_DELETE:
      return 'Excluiu página';
    case AUDIT_ACTIONS.PAGE_RESTORE:
      return 'Restaurou página';
    case AUDIT_ACTIONS.REVISION_REVERT:
      return 'Reverteu revisão';
    case AUDIT_ACTIONS.REVISION_HIDE:
      return 'Ocultou revisão';
    case AUDIT_ACTIONS.REVISION_UNHIDE:
      return 'Re-exibiu revisão';
    case AUDIT_ACTIONS.COMMENT_HIDE:
      return 'Ocultou comentário';
    case AUDIT_ACTIONS.COMMENT_UNHIDE:
      return 'Re-exibiu comentário';
    case AUDIT_ACTIONS.COMMENT_DELETE_MOD:
      return 'Excluiu comentário (mod)';
    case AUDIT_ACTIONS.USER_BAN:
      return 'Baniu usuário';
    case AUDIT_ACTIONS.USER_UNBAN:
      return 'Desbaniu usuário';
    case AUDIT_ACTIONS.USER_ROLE_CHANGE:
      return 'Alterou papel';
    default:
      return action;
  }
}
