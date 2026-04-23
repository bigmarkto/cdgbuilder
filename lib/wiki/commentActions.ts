'use server';

/**
 * Server actions para comentários.
 *
 * Regras:
 *   • Criar: qualquer user autenticado e não banido (READER+). Body 1..4000.
 *   • Responder: mesmo, exige parentId pertence à mesma página.
 *   • Excluir: autor próprio ou MOD+. Hard delete (onDelete: Cascade em
 *     replies — a thread inteira some se um pai for deletado).
 *   • Esconder/desesconder: MOD+. Soft-hide via hiddenAt + hiddenReason.
 *     O nó permanece pra thread não quebrar visualmente.
 *
 * Actions NUNCA throw em fluxo esperado; sempre retornam { ok: boolean }.
 * Cliente decide como mostrar.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireRole, PermissionError, hasAtLeast } from './permissions';
import { writeAudit, AUDIT_ACTIONS } from './auditLog';

export type CommentActionResult =
  | { ok: true }
  | { ok: false; error: string };

const MAX_BODY = 4000;
const MIN_BODY = 1;

/**
 * Cria um comentário (top-level ou reply).
 * parentId opcional — se passado, deve existir e pertencer ao mesmo pageId.
 */
export async function createComment(input: {
  pageId: string;
  parentId?: string | null;
  body: string;
}): Promise<CommentActionResult> {
  let member;
  try {
    member = await requireRole('READER', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para comentar.'
            : 'Sua conta não pode comentar agora.'
      };
    }
    throw err;
  }

  const body = input.body.trim();
  if (body.length < MIN_BODY) {
    return { ok: false, error: 'Comentário vazio.' };
  }
  if (body.length > MAX_BODY) {
    return { ok: false, error: `Comentário muito longo (máximo ${MAX_BODY} caracteres).` };
  }

  const page = await db.page.findUnique({
    where: { id: input.pageId },
    select: { id: true, slug: true, locked: true, deletedAt: true }
  });
  if (!page || page.deletedAt) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  // Locked bloqueia edição de página, mas comentários continuam abertos —
  // decisão explícita pra manter o canal de feedback. Se no futuro quisermos
  // trancar também comentários, trocar o check acima.

  // Valida parentId, se fornecido.
  if (input.parentId) {
    const parent = await db.comment.findUnique({
      where: { id: input.parentId },
      select: { id: true, pageId: true }
    });
    if (!parent || parent.pageId !== page.id) {
      return { ok: false, error: 'Comentário pai não encontrado.' };
    }
  }

  await db.comment.create({
    data: {
      pageId: page.id,
      authorId: member.id,
      parentId: input.parentId ?? null,
      body
    }
  });

  revalidatePath(`/wiki/c/${page.slug}`);
  return { ok: true };
}

/**
 * Deleta um comentário. Cascata em replies (ver schema).
 * Autor próprio OU MOD+.
 */
export async function deleteComment(input: { commentId: string }): Promise<CommentActionResult> {
  let member;
  try {
    member = await requireRole('READER', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para excluir comentários.'
            : 'Sem permissão.'
      };
    }
    throw err;
  }

  const comment = await db.comment.findUnique({
    where: { id: input.commentId },
    select: {
      id: true,
      authorId: true,
      body: true,
      author: { select: { handle: true } },
      page: { select: { slug: true, deletedAt: true } }
    }
  });
  if (!comment || comment.page.deletedAt) {
    return { ok: false, error: 'Comentário não encontrado.' };
  }

  const isOwner = comment.authorId === member.id;
  const isMod = hasAtLeast(member.role, 'MODERATOR');
  if (!isOwner && !isMod) {
    return { ok: false, error: 'Você só pode excluir seus próprios comentários.' };
  }

  await db.comment.delete({ where: { id: comment.id } });

  // Só registra auditoria quando a deleção foi ato de moderação (não o próprio
  // autor limpando). Inclui um excerpt pra contextualizar o que foi removido.
  if (!isOwner && isMod) {
    await writeAudit({
      actorId: member.id,
      action: AUDIT_ACTIONS.COMMENT_DELETE_MOD,
      entityType: 'comment',
      entityId: comment.id,
      meta: {
        pageSlug: comment.page.slug,
        authorHandle: comment.author.handle ?? null,
        excerpt: comment.body.slice(0, 240)
      }
    });
  }

  revalidatePath(`/wiki/c/${comment.page.slug}`);
  return { ok: true };
}

/**
 * Esconde/mostra um comentário (toggle). Só MODERATOR+.
 * Não apaga — apenas sinaliza pro renderer ocultar o body pra não-MODs.
 */
export async function toggleHideComment(input: {
  commentId: string;
  reason?: string;
}): Promise<CommentActionResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Faça login como moderador.'
            : 'Essa ação exige permissão de moderação.'
      };
    }
    throw err;
  }

  const comment = await db.comment.findUnique({
    where: { id: input.commentId },
    select: {
      id: true,
      hiddenAt: true,
      page: { select: { slug: true, deletedAt: true } }
    }
  });
  if (!comment || comment.page.deletedAt) {
    return { ok: false, error: 'Comentário não encontrado.' };
  }

  const willHide = comment.hiddenAt === null;
  await db.comment.update({
    where: { id: comment.id },
    data: willHide
      ? { hiddenAt: new Date(), hiddenReason: input.reason?.trim() || null }
      : { hiddenAt: null, hiddenReason: null }
  });

  await writeAudit({
    actorId: member.id,
    action: willHide ? AUDIT_ACTIONS.COMMENT_HIDE : AUDIT_ACTIONS.COMMENT_UNHIDE,
    entityType: 'comment',
    entityId: comment.id,
    meta: {
      pageSlug: comment.page.slug,
      reason: input.reason?.trim() || null
    }
  });

  revalidatePath(`/wiki/c/${comment.page.slug}`);
  return { ok: true };
}
