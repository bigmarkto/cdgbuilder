'use server';

/**
 * Server actions da biblioteca de templates (Categoria 2.2).
 *
 *   • publishTemplate   — qualquer logado publica a ficha ativa como template.
 *     Snapshot estável (NÃO é vivo como o SHARE). Re-publicar atualiza.
 *   • unpublishTemplate — autor remove o próprio template.
 *   • templateStatus    — o builder pergunta se a ficha já é template.
 *   • setTemplateFeatured / hideTemplate — moderação (MOD+), com audit.
 *
 * Reusa o model SharedCharacter com kind=TEMPLATE. Auth: publicar exige login
 * (READER+); destacar/ocultar exige MODERATOR+.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentMember, requireRole, PermissionError } from '@/lib/wiki/permissions';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/wiki/auditLog';
import { extractCharacterMeta, normalizeTags } from './meta';

export type TemplateResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type TemplateStatusResult =
  | { ok: true; loggedIn: boolean; published: boolean; slug: string | null }
  | { ok: false; error: string };

const MAX_SUMMARY = 600;

export async function publishTemplate(input: {
  localId: string;
  character: unknown;
  summary?: string;
  tags?: string[];
}): Promise<TemplateResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: 'Entre para publicar um template.' };

  if (typeof input.localId !== 'string' || !input.localId) {
    return { ok: false, error: 'Ficha inválida.' };
  }
  const meta = extractCharacterMeta(input.character, input.localId);
  if ('error' in meta) return { ok: false, error: meta.error };

  const summary =
    typeof input.summary === 'string' && input.summary.trim()
      ? input.summary.trim().slice(0, MAX_SUMMARY)
      : null;
  const tags = normalizeTags(input.tags);

  const row = await db.sharedCharacter.upsert({
    where: {
      authorId_localId_kind: { authorId: member.id, localId: input.localId, kind: 'TEMPLATE' }
    },
    create: {
      kind: 'TEMPLATE',
      authorId: member.id,
      localId: input.localId,
      name: meta.name,
      raceId: meta.raceId,
      level: meta.level,
      concept: meta.concept,
      data: input.character as object,
      summary,
      tags
    },
    update: {
      name: meta.name,
      raceId: meta.raceId,
      level: meta.level,
      concept: meta.concept,
      data: input.character as object,
      summary,
      tags
      // featured NÃO é tocado aqui — só moderação muda.
    },
    select: { id: true }
  });

  revalidatePath('/templates');
  revalidatePath(`/templates/${row.id}`);
  return { ok: true, slug: row.id };
}

export async function unpublishTemplate(input: { localId: string }): Promise<TemplateResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: 'Sessão expirada.' };

  const res = await db.sharedCharacter.deleteMany({
    where: { authorId: member.id, localId: input.localId, kind: 'TEMPLATE' }
  });
  if (res.count === 0) return { ok: false, error: 'Essa ficha não está publicada.' };

  revalidatePath('/templates');
  return { ok: true, slug: '' };
}

export async function templateStatus(input: {
  localId: string;
}): Promise<TemplateStatusResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: true, loggedIn: false, published: false, slug: null };

  const row = await db.sharedCharacter.findUnique({
    where: {
      authorId_localId_kind: { authorId: member.id, localId: input.localId, kind: 'TEMPLATE' }
    },
    select: { id: true }
  });
  return { ok: true, loggedIn: true, published: !!row, slug: row?.id ?? null };
}

// ---------------------------------------------------------------------------
// Moderação
// ---------------------------------------------------------------------------

export async function setTemplateFeatured(input: {
  id: string;
  featured: boolean;
}): Promise<TemplateResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: 'Essa ação exige permissão de moderação.' };
    }
    throw err;
  }

  const tpl = await db.sharedCharacter.findUnique({
    where: { id: input.id },
    select: { id: true, kind: true, name: true, featured: true }
  });
  if (!tpl || tpl.kind !== 'TEMPLATE') {
    return { ok: false, error: 'Template não encontrado.' };
  }
  if (tpl.featured === input.featured) {
    return { ok: true, slug: tpl.id }; // idempotente
  }

  await db.sharedCharacter.update({
    where: { id: tpl.id },
    data: { featured: input.featured }
  });

  await writeAudit({
    actorId: member.id,
    action: input.featured ? AUDIT_ACTIONS.TEMPLATE_FEATURE : AUDIT_ACTIONS.TEMPLATE_UNFEATURE,
    entityType: 'page',
    entityId: tpl.id,
    meta: { name: tpl.name }
  });

  revalidatePath('/templates');
  revalidatePath(`/templates/${tpl.id}`);
  return { ok: true, slug: tpl.id };
}

export async function hideTemplate(input: {
  id: string;
  reason?: string;
}): Promise<TemplateResult> {
  let member;
  try {
    member = await requireRole('MODERATOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: 'Essa ação exige permissão de moderação.' };
    }
    throw err;
  }

  const tpl = await db.sharedCharacter.findUnique({
    where: { id: input.id },
    select: { id: true, kind: true, name: true, hiddenAt: true }
  });
  if (!tpl || tpl.kind !== 'TEMPLATE') {
    return { ok: false, error: 'Template não encontrado.' };
  }

  await db.sharedCharacter.update({
    where: { id: tpl.id },
    data: {
      hiddenAt: tpl.hiddenAt ? null : new Date(),
      hiddenReason: tpl.hiddenAt ? null : input.reason?.trim() || null,
      featured: tpl.hiddenAt ? undefined : false
    }
  });

  if (!tpl.hiddenAt) {
    await writeAudit({
      actorId: member.id,
      action: AUDIT_ACTIONS.TEMPLATE_HIDE,
      entityType: 'page',
      entityId: tpl.id,
      meta: { name: tpl.name, reason: input.reason?.trim() || null }
    });
  }

  revalidatePath('/templates');
  revalidatePath(`/templates/${tpl.id}`);
  return { ok: true, slug: tpl.id };
}
