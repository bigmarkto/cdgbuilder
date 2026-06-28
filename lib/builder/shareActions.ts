'use server';

/**
 * Server actions de compartilhamento de fichas (Categoria 2.1 — link vivo).
 *
 * Fluxo:
 *   • enableShare  — autor liga o compartilhamento de uma ficha local. Cria a
 *     row SHARE e devolve o slug público.
 *   • syncShare    — chamado (debounced) pelo builder a cada edição enquanto a
 *     ficha está compartilhada. Atualiza `data` + campos denormalizados. No-op
 *     se a ficha não está mais compartilhada (autor desligou em outra aba).
 *   • disableShare — autor para de compartilhar. Remove a row.
 *   • shareStatus  — o builder pergunta no load se a ficha já tem link.
 *
 * Auth: todas exigem login (READER+). A ficha pertence sempre ao autor logado
 * — `authorId_localId_kind` garante idempotência e impede mexer na de outro.
 *
 * Nunca throw no caminho feliz: retornam { ok } como as outras actions.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentMember } from '@/lib/wiki/permissions';
import { extractCharacterMeta as extractMeta } from './meta';

export type ShareResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type ShareStatusResult =
  | { ok: true; loggedIn: boolean; shared: boolean; slug: string | null }
  | { ok: false; error: string };

async function requireLogin() {
  const member = await getCurrentMember();
  if (!member) return null;
  return member;
}

export async function enableShare(input: {
  localId: string;
  character: unknown;
}): Promise<ShareResult> {
  const member = await requireLogin();
  if (!member) return { ok: false, error: 'Entre para compartilhar sua ficha.' };

  if (typeof input.localId !== 'string' || !input.localId) {
    return { ok: false, error: 'Ficha inválida.' };
  }
  const meta = extractMeta(input.character, input.localId);
  if ('error' in meta) return { ok: false, error: meta.error };

  const row = await db.sharedCharacter.upsert({
    where: {
      authorId_localId_kind: { authorId: member.id, localId: input.localId, kind: 'SHARE' }
    },
    create: {
      kind: 'SHARE',
      authorId: member.id,
      localId: input.localId,
      name: meta.name,
      raceId: meta.raceId,
      level: meta.level,
      concept: meta.concept,
      data: input.character as object
    },
    update: {
      name: meta.name,
      raceId: meta.raceId,
      level: meta.level,
      concept: meta.concept,
      data: input.character as object
    },
    select: { id: true }
  });

  return { ok: true, slug: row.id };
}

export async function syncShare(input: {
  localId: string;
  character: unknown;
}): Promise<ShareResult> {
  const member = await requireLogin();
  if (!member) return { ok: false, error: 'Sessão expirada.' };

  if (typeof input.localId !== 'string' || !input.localId) {
    return { ok: false, error: 'Ficha inválida.' };
  }
  const meta = extractMeta(input.character, input.localId);
  if ('error' in meta) return { ok: false, error: meta.error };

  // updateMany pra não falhar se a row não existe (autor desligou o share).
  const res = await db.sharedCharacter.updateMany({
    where: { authorId: member.id, localId: input.localId, kind: 'SHARE' },
    data: {
      name: meta.name,
      raceId: meta.raceId,
      level: meta.level,
      concept: meta.concept,
      data: input.character as object
    }
  });

  if (res.count === 0) {
    return { ok: false, error: 'Essa ficha não está sendo compartilhada.' };
  }

  // Revalida a página pública pra o leitor ver a versão nova.
  const existing = await db.sharedCharacter.findUnique({
    where: {
      authorId_localId_kind: { authorId: member.id, localId: input.localId, kind: 'SHARE' }
    },
    select: { id: true }
  });
  if (existing) revalidatePath(`/ficha/${existing.id}`);

  return { ok: true, slug: existing?.id ?? '' };
}

export async function disableShare(input: { localId: string }): Promise<ShareResult> {
  const member = await requireLogin();
  if (!member) return { ok: false, error: 'Sessão expirada.' };

  const res = await db.sharedCharacter.deleteMany({
    where: { authorId: member.id, localId: input.localId, kind: 'SHARE' }
  });
  if (res.count === 0) {
    return { ok: false, error: 'Essa ficha não estava sendo compartilhada.' };
  }
  return { ok: true, slug: '' };
}

export async function shareStatus(input: { localId: string }): Promise<ShareStatusResult> {
  const member = await requireLogin();
  if (!member) return { ok: true, loggedIn: false, shared: false, slug: null };

  const row = await db.sharedCharacter.findUnique({
    where: {
      authorId_localId_kind: { authorId: member.id, localId: input.localId, kind: 'SHARE' }
    },
    select: { id: true }
  });
  return { ok: true, loggedIn: true, shared: !!row, slug: row?.id ?? null };
}
