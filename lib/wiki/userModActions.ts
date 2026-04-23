'use server';

/**
 * Server actions de moderação em nível de usuário.
 *
 * Todas exigem ADMIN. Escrevem AuditLog com os rótulos do alvo (handle/email)
 * pra que o histórico continue legível mesmo se a conta for depois renomeada.
 *
 * Ações:
 *   • banUser — marca User.bannedAt. A próxima chamada de getCurrentMember()
 *     devolve null, revogando sessão no server (as actions e RSC bloqueiam;
 *     o cookie de sessão ainda existe mas vira ineficaz).
 *   • unbanUser — zera.
 *   • setUserRole — muda role. Proibido:
 *       - auto-alteração (admin não muda o próprio papel)
 *       - rebaixar o último ADMIN (senão fica sem admin)
 */

import { revalidatePath } from 'next/cache';
import type { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { requireRole, PermissionError } from './permissions';
import { writeAudit, AUDIT_ACTIONS } from './auditLog';

export type UserModResult =
  | { ok: true }
  | { ok: false; error: string };

const VALID_ROLES: readonly Role[] = ['READER', 'EDITOR', 'MODERATOR', 'ADMIN'];

// ---------------------------------------------------------------------------
// banUser / unbanUser
// ---------------------------------------------------------------------------

export async function banUser(input: {
  userId: string;
  reason?: string;
}): Promise<UserModResult> {
  let actor;
  try {
    actor = await requireRole('ADMIN', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  if (input.userId === actor.id) {
    return { ok: false, error: 'Você não pode banir a si mesmo.' };
  }

  const target = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, handle: true, bannedAt: true, role: true }
  });
  if (!target) {
    return { ok: false, error: 'Usuário não encontrado.' };
  }
  if (target.bannedAt) {
    return { ok: false, error: 'Esse usuário já está banido.' };
  }
  if (target.role === 'ADMIN') {
    return {
      ok: false,
      error: 'Não é possível banir outro admin. Remova o papel ADMIN antes.'
    };
  }

  const reason = input.reason?.trim() || null;
  await db.user.update({
    where: { id: target.id },
    data: { bannedAt: new Date(), bannedReason: reason }
  });

  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.USER_BAN,
    entityType: 'user',
    entityId: target.id,
    meta: {
      handle: target.handle ?? null,
      email: target.email ?? null,
      reason
    }
  });

  revalidatePath('/admin/users');
  return { ok: true };
}

export async function unbanUser(input: { userId: string }): Promise<UserModResult> {
  let actor;
  try {
    actor = await requireRole('ADMIN', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  const target = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, handle: true, bannedAt: true }
  });
  if (!target) {
    return { ok: false, error: 'Usuário não encontrado.' };
  }
  if (!target.bannedAt) {
    return { ok: false, error: 'Esse usuário não está banido.' };
  }

  await db.user.update({
    where: { id: target.id },
    data: { bannedAt: null, bannedReason: null }
  });

  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.USER_UNBAN,
    entityType: 'user',
    entityId: target.id,
    meta: { handle: target.handle ?? null, email: target.email ?? null }
  });

  revalidatePath('/admin/users');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setUserRole
// ---------------------------------------------------------------------------

export async function setUserRole(input: {
  userId: string;
  role: Role;
}): Promise<UserModResult> {
  let actor;
  try {
    actor = await requireRole('ADMIN', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: permErrorMsg(err) };
    }
    throw err;
  }

  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: 'Papel inválido.' };
  }

  if (input.userId === actor.id) {
    return {
      ok: false,
      error: 'Você não pode alterar seu próprio papel. Peça a outro admin.'
    };
  }

  const target = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, email: true, handle: true, bannedAt: true }
  });
  if (!target) {
    return { ok: false, error: 'Usuário não encontrado.' };
  }
  if (target.bannedAt) {
    return {
      ok: false,
      error: 'Desbane o usuário antes de alterar o papel.'
    };
  }
  if (target.role === input.role) {
    return { ok: false, error: 'O usuário já tem esse papel.' };
  }

  // Proteção contra rebaixamento do último ADMIN — deixa o sistema sem dono.
  if (target.role === 'ADMIN' && input.role !== 'ADMIN') {
    const adminCount = await db.user.count({
      where: { role: 'ADMIN', bannedAt: null }
    });
    if (adminCount <= 1) {
      return {
        ok: false,
        error:
          'Esse é o único ADMIN do sistema. Promova outro ADMIN antes de rebaixar este.'
      };
    }
  }

  const fromRole = target.role;
  await db.user.update({
    where: { id: target.id },
    data: { role: input.role }
  });

  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
    entityType: 'user',
    entityId: target.id,
    meta: {
      handle: target.handle ?? null,
      email: target.email ?? null,
      fromRole,
      toRole: input.role
    }
  });

  revalidatePath('/admin/users');
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
