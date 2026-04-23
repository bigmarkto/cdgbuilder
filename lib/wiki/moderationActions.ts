'use server';

/**
 * Server actions de moderação em nível de página.
 *
 * Separadas de `pageActions.ts` porque o público alvo é diferente (MOD/ADMIN
 * vs. EDITOR) e porque todas escrevem AuditLog — a separação deixa claro o
 * perfil de quem pode chamar cada grupo.
 *
 * Ações:
 *   • lockPage (MOD+)      — congela edições; EDITOR vê erro ao salvar.
 *   • unlockPage (MOD+)    — destranca.
 *   • softDeletePage (ADMIN) — marca deletedAt; a página some da listagem
 *     e do reader, mas revisions/comments permanecem no banco pra possível
 *     restore.
 *   • restorePage (ADMIN)  — zera deletedAt.
 *   • hideRevision (MOD+)  — troca status da revisão pra HIDDEN. Se era a
 *     currentRevisionId, promove a revisão pública anterior como atual.
 *   • unhideRevision (MOD+) — volta pra PUBLISHED.
 *
 * Todas retornam `{ ok: true }` ou `{ ok: false, error }`. Nunca throw em
 * fluxo esperado.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireRole, PermissionError } from './permissions';
import { writeAudit, AUDIT_ACTIONS } from './auditLog';

export type ModActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// lockPage / unlockPage
// ---------------------------------------------------------------------------

export async function lockPage(input: {
  pageId: string;
  reason?: string;
}): Promise<ModActionResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const page = await db.page.findUnique({
    where: { id: input.pageId },
    select: { id: true, slug: true, locked: true, deletedAt: true }
  });
  if (!page || page.deletedAt) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  if (page.locked) {
    return { ok: false, error: 'Essa página já está trancada.' };
  }

  const reason = input.reason?.trim() || null;
  await db.page.update({
    where: { id: page.id },
    data: { locked: true, lockedReason: reason }
  });

  await writeAudit({
    actorId: member.id,
    action: AUDIT_ACTIONS.PAGE_LOCK,
    entityType: 'page',
    entityId: page.id,
    meta: { slug: page.slug, reason }
  });

  revalidatePath('/wiki/c');
  revalidatePath(`/wiki/c/${page.slug}`);
  return { ok: true };
}

export async function unlockPage(input: {
  pageId: string;
}): Promise<ModActionResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const page = await db.page.findUnique({
    where: { id: input.pageId },
    select: { id: true, slug: true, locked: true, deletedAt: true }
  });
  if (!page || page.deletedAt) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  if (!page.locked) {
    return { ok: false, error: 'Essa página já está destrancada.' };
  }

  await db.page.update({
    where: { id: page.id },
    data: { locked: false, lockedReason: null }
  });

  await writeAudit({
    actorId: member.id,
    action: AUDIT_ACTIONS.PAGE_UNLOCK,
    entityType: 'page',
    entityId: page.id,
    meta: { slug: page.slug }
  });

  revalidatePath('/wiki/c');
  revalidatePath(`/wiki/c/${page.slug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// softDeletePage / restorePage
// ---------------------------------------------------------------------------

export async function softDeletePage(input: {
  pageId: string;
  reason?: string;
}): Promise<ModActionResult> {
  let member;
  try {
    member = await requireRole('ADMIN', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const page = await db.page.findUnique({
    where: { id: input.pageId },
    select: { id: true, slug: true, canonicalRef: true, deletedAt: true }
  });
  if (!page) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  if (page.deletedAt) {
    return { ok: false, error: 'Essa página já está excluída.' };
  }

  const reason = input.reason?.trim() || null;
  await db.page.update({
    where: { id: page.id },
    data: { deletedAt: new Date() }
  });

  await writeAudit({
    actorId: member.id,
    action: AUDIT_ACTIONS.PAGE_DELETE,
    entityType: 'page',
    entityId: page.id,
    meta: { slug: page.slug, reason }
  });

  revalidatePath('/wiki/c');
  revalidatePath(`/wiki/c/${page.slug}`);
  if (page.canonicalRef) revalidatePath(`/wiki/${page.canonicalRef}`);
  return { ok: true };
}

export async function restorePage(input: {
  pageId: string;
}): Promise<ModActionResult> {
  let member;
  try {
    member = await requireRole('ADMIN', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const page = await db.page.findUnique({
    where: { id: input.pageId },
    select: { id: true, slug: true, canonicalRef: true, deletedAt: true }
  });
  if (!page) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  if (!page.deletedAt) {
    return { ok: false, error: 'Essa página não está excluída.' };
  }

  await db.page.update({
    where: { id: page.id },
    data: { deletedAt: null }
  });

  await writeAudit({
    actorId: member.id,
    action: AUDIT_ACTIONS.PAGE_RESTORE,
    entityType: 'page',
    entityId: page.id,
    meta: { slug: page.slug }
  });

  revalidatePath('/wiki/c');
  revalidatePath(`/wiki/c/${page.slug}`);
  if (page.canonicalRef) revalidatePath(`/wiki/${page.canonicalRef}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// hideRevision / unhideRevision
// ---------------------------------------------------------------------------

/**
 * Oculta uma revisão. Se era a atual, promove a revisão PUBLISHED mais
 * recente anterior como nova current. Se não há nenhuma, a página fica sem
 * currentRevisionId (reader fallback pra doc vazio).
 */
export async function hideRevision(input: {
  revisionId: string;
  reason?: string;
}): Promise<ModActionResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const rev = await db.revision.findUnique({
    where: { id: input.revisionId },
    select: {
      id: true,
      status: true,
      pageId: true,
      page: {
        select: { id: true, slug: true, currentRevisionId: true, deletedAt: true }
      }
    }
  });
  if (!rev || rev.page.deletedAt) {
    return { ok: false, error: 'Revisão não encontrada.' };
  }
  if (rev.status === 'HIDDEN') {
    return { ok: false, error: 'Essa revisão já está oculta.' };
  }

  const wasCurrent = rev.page.currentRevisionId === rev.id;

  await db.$transaction(async (tx) => {
    await tx.revision.update({
      where: { id: rev.id },
      data: { status: 'HIDDEN' }
    });

    if (wasCurrent) {
      // Encontra a revisão PUBLISHED mais recente anterior pra promover.
      const replacement = await tx.revision.findFirst({
        where: {
          pageId: rev.pageId,
          id: { not: rev.id },
          status: 'PUBLISHED'
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      });
      await tx.page.update({
        where: { id: rev.pageId },
        data: { currentRevisionId: replacement?.id ?? null }
      });
    }
  });

  const reason = input.reason?.trim() || null;
  await writeAudit({
    actorId: member.id,
    action: AUDIT_ACTIONS.REVISION_HIDE,
    entityType: 'revision',
    entityId: rev.id,
    meta: { pageSlug: rev.page.slug, wasCurrent, reason }
  });

  revalidatePath(`/wiki/c/${rev.page.slug}`);
  revalidatePath(`/wiki/c/${rev.page.slug}/history`);
  return { ok: true };
}

export async function unhideRevision(input: {
  revisionId: string;
}): Promise<ModActionResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const rev = await db.revision.findUnique({
    where: { id: input.revisionId },
    select: {
      id: true,
      status: true,
      page: { select: { slug: true, deletedAt: true } }
    }
  });
  if (!rev || rev.page.deletedAt) {
    return { ok: false, error: 'Revisão não encontrada.' };
  }
  if (rev.status !== 'HIDDEN') {
    return { ok: false, error: 'Essa revisão não está oculta.' };
  }

  await db.revision.update({
    where: { id: rev.id },
    data: { status: 'PUBLISHED' }
  });

  await writeAudit({
    actorId: member.id,
    action: AUDIT_ACTIONS.REVISION_UNHIDE,
    entityType: 'revision',
    entityId: rev.id,
    meta: { pageSlug: rev.page.slug }
  });

  revalidatePath(`/wiki/c/${rev.page.slug}`);
  revalidatePath(`/wiki/c/${rev.page.slug}/history`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function permErrorMsg(err: PermissionError): string {
  return err.code === 'not-authenticated'
    ? 'Você precisa entrar para executar essa ação.'
    : 'Sua conta não tem permissão para essa ação.';
}
