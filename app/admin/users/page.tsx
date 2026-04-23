/**
 * /admin/users — lista de usuários com ações administrativas inline.
 *
 * Server component busca os usuários; as ações (ban/unban/setRole) ficam em
 * um client component dedicado (UserRow) que usa useTransition.
 *
 * Ordenação: ADMIN primeiro, depois por createdAt desc. Pagina simples por
 * slice de 100 pra MVP — quando o volume crescer, adiciona cursor.
 */

import type { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentMember } from '@/lib/wiki/permissions';
import { UserRow } from '@/components/admin/UserRow';

export default async function UsersAdminPage({
  searchParams
}: {
  searchParams?: { q?: string };
}) {
  const [me, users] = await Promise.all([
    getCurrentMember(),
    loadUsers(searchParams?.q ?? '')
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-50">Usuários</h1>
        <p className="text-sm text-ink-400 mt-1">
          Gestão de papéis e banimentos. Alterações ficam registradas no{' '}
          <a href="/admin/audit" className="text-ember-400 hover:underline">
            audit log
          </a>
          .
        </p>
      </header>

      <form method="get" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={searchParams?.q ?? ''}
          placeholder="Buscar por @handle, email ou nome…"
          className="w-full md:w-80 px-3 py-1.5 rounded border border-ink-600 bg-ink-900 text-ink-50 text-sm focus:outline-none focus:border-ember-400"
        />
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-ink-400">Nenhum usuário encontrado.</p>
      ) : (
        <div className="rounded border border-ink-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/60 text-xs uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-left">Papel</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Entrou</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={{
                    id: u.id,
                    email: u.email,
                    handle: u.handle,
                    name: u.name,
                    role: u.role,
                    bannedAt: u.bannedAt?.toISOString() ?? null,
                    bannedReason: u.bannedReason,
                    createdAt: u.createdAt.toISOString()
                  }}
                  isSelf={u.id === me?.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        Mostrando {users.length} usuário{users.length === 1 ? '' : 's'} (máx 100).
      </p>
    </div>
  );
}

async function loadUsers(query: string) {
  const q = query.trim();
  const where =
    q.length > 0
      ? {
          OR: [
            { handle: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : undefined;

  return db.user.findMany({
    where,
    // ADMIN no topo, depois por data decrescente.
    orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      email: true,
      handle: true,
      name: true,
      role: true,
      bannedAt: true,
      bannedReason: true,
      createdAt: true
    }
  }) as Promise<
    Array<{
      id: string;
      email: string | null;
      handle: string | null;
      name: string | null;
      role: Role;
      bannedAt: Date | null;
      bannedReason: string | null;
      createdAt: Date;
    }>
  >;
}
