'use client';

/**
 * UserRow — linha do /admin/users com ações ban/unban/setRole.
 *
 * Client component porque precisa de useTransition pra feedback das actions
 * e selects controlados.
 *
 * Proteções visuais:
 *   • Se a linha é o próprio admin logado: controles desabilitados + dica.
 *   • ADMIN alvo: botão "banir" escondido (a action rejeita de toda forma).
 *   • Sem confirmação pra setRole simples; `ban` e `delete` pedem confirm.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { banUser, unbanUser, setUserRole } from '@/lib/wiki/userModActions';

export interface UserRowProps {
  user: {
    id: string;
    email: string | null;
    handle: string | null;
    name: string | null;
    role: Role;
    bannedAt: string | null;
    bannedReason: string | null;
    createdAt: string;
  };
  isSelf: boolean;
}

const ROLE_OPTIONS: Role[] = ['READER', 'EDITOR', 'MODERATOR', 'ADMIN'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function UserRow({ user, isSelf }: UserRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(user.role);
  const isBanned = user.bannedAt !== null;

  const displayName = user.handle
    ? `@${user.handle}`
    : user.name || user.email || '(sem nome)';

  const onRoleChange = (next: Role) => {
    if (next === role) return;
    setErr(null);
    const prev = role;
    setRole(next); // optimistic
    startTransition(async () => {
      const result = await setUserRole({ userId: user.id, role: next });
      if (!result.ok) {
        setRole(prev);
        setErr(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const onBan = () => {
    const reason = window.prompt(
      `Motivo do ban de ${displayName}? (opcional — aparece no audit log)`,
      ''
    );
    if (reason === null) return; // cancel
    if (!window.confirm(`Confirma banir ${displayName}?`)) return;
    setErr(null);
    startTransition(async () => {
      const result = await banUser({ userId: user.id, reason: reason || undefined });
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });
  };

  const onUnban = () => {
    if (!window.confirm(`Remover ban de ${displayName}?`)) return;
    setErr(null);
    startTransition(async () => {
      const result = await unbanUser({ userId: user.id });
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });
  };

  return (
    <tr className="border-t border-ink-800">
      <td className="px-3 py-2 align-top">
        <div className="text-ink-100 font-medium">{displayName}</div>
        {user.email && user.email !== displayName && (
          <div className="text-xs text-ink-500">{user.email}</div>
        )}
        {isSelf && (
          <div className="text-[10px] uppercase tracking-wider text-ember-400 mt-0.5">
            você
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          disabled={isPending || isSelf || isBanned}
          className="px-2 py-1 rounded border border-ink-600 bg-ink-900 text-ink-100 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            isSelf
              ? 'Você não pode alterar o próprio papel'
              : isBanned
                ? 'Desbane antes de alterar o papel'
                : 'Alterar papel'
          }
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        {isBanned ? (
          <div>
            <span className="text-blood-400 text-xs font-medium">banido</span>
            {user.bannedReason && (
              <div
                className="text-[11px] text-ink-500 italic truncate max-w-[180px]"
                title={user.bannedReason}
              >
                {user.bannedReason}
              </div>
            )}
          </div>
        ) : (
          <span className="text-ink-500 text-xs">ativo</span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-xs text-ink-400">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-3 py-2 align-top text-right">
        {isBanned ? (
          <button
            type="button"
            onClick={onUnban}
            disabled={isPending || isSelf}
            className="text-xs text-ember-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            desbanir
          </button>
        ) : (
          <button
            type="button"
            onClick={onBan}
            disabled={isPending || isSelf || user.role === 'ADMIN'}
            title={
              user.role === 'ADMIN'
                ? 'Não é possível banir ADMIN. Rebaixe primeiro.'
                : undefined
            }
            className="text-xs text-blood-300 hover:text-blood-200 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            banir
          </button>
        )}
        {err && <div className="mt-1 text-xs text-blood-400">{err}</div>}
      </td>
    </tr>
  );
}
