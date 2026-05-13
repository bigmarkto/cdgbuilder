/**
 * Permissões do wiki community.
 *
 * Hierarquia:
 *   READER (default) — lê, comenta (Fase 5)
 *   EDITOR          — lê + cria/edita páginas
 *   MODERATOR       — + lock/hide/unlock + esconder comentários
 *   ADMIN           — + promover roles + ban + audit log
 *
 * Design: nunca confiamos só em `session.user.role` — em toda action
 * destrutiva, chamamos requireRole() que re-busca o User do banco. Isso
 * protege de tokens antigos quando a role foi revogada server-side.
 */
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { auth } from '@/auth';
import { db } from '@/lib/db';

const ROLE_WEIGHT: Record<Role, number> = {
  READER: 0,
  EDITOR: 1,
  MODERATOR: 2,
  ADMIN: 3
};

export function hasAtLeast(actual: Role, required: Role): boolean {
  return ROLE_WEIGHT[actual] >= ROLE_WEIGHT[required];
}

/**
 * Valor server-trusted: role + bannedAt re-lidos do banco.
 * Se o usuário não está logado ou está banido, é como se não tivesse papel.
 */
export async function getCurrentMember() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, handle: true, name: true, role: true, bannedAt: true }
  });
  if (!user) return null;
  if (user.bannedAt) return null;
  return user;
}

/**
 * Exige `required` role. Se não tiver, redireciona (dentro de RSC) ou throw
 * PermissionError (dentro de server action — aí o action handler decide
 * como lidar).
 *
 * mode='redirect' é o default, adequado para pages. Em server actions
 * preferimos mode='throw' pra poder devolver erro via return.
 *
 * Targets do redirect:
 *   • not-authenticated → /login (com callbackUrl se opts.callbackUrl).
 *   • insufficient-role → /403 (página dedicada com link de volta).
 */
export async function requireRole(
  required: Role,
  opts: {
    mode?: 'redirect' | 'throw';
    loginPath?: string;
    /** Opcional: passa pra /403?from=… ajudar o usuário a entender onde caiu. */
    callbackUrl?: string;
  } = {}
) {
  const mode = opts.mode ?? 'redirect';
  const member = await getCurrentMember();

  if (!member) {
    if (mode === 'throw') throw new PermissionError('not-authenticated');
    redirect(opts.loginPath ?? '/login');
  }

  if (!hasAtLeast(member.role, required)) {
    if (mode === 'throw') throw new PermissionError('insufficient-role');
    const url = opts.callbackUrl
      ? `/403?from=${encodeURIComponent(opts.callbackUrl)}`
      : '/403';
    redirect(url);
  }

  return member;
}

export class PermissionError extends Error {
  constructor(public readonly code: 'not-authenticated' | 'insufficient-role') {
    super(code);
    this.name = 'PermissionError';
  }
}
