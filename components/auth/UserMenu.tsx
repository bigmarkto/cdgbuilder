/**
 * UserMenu — controle de auth no header.
 *
 * Server component: chama auth() direto, não precisa de client boundary.
 * Label preferencial: @handle > name > email. O link "Perfil" leva pra
 * /settings/profile onde o usuário ajusta nickname/bio.
 */
import Link from 'next/link';
import { auth, signOut } from '@/auth';

async function doSignOut() {
  'use server';
  await signOut({ redirectTo: '/' });
}

export async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 rounded text-ink-200 hover:bg-ink-800 hover:text-ink-50 transition-colors"
      >
        Entrar
      </Link>
    );
  }

  const { email, name, handle, role } = session.user;
  const label = handle ? `@${handle}` : name || email || 'Usuário';
  const isStaff = role === 'ADMIN' || role === 'MODERATOR';
  const needsNick = !handle;

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/settings/profile"
        className="px-3 py-1.5 rounded text-ink-200 hover:bg-ink-800 hover:text-ink-50 transition-colors text-sm"
        title={email ?? undefined}
      >
        {label}
        {isStaff && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-ember-400">
            {role === 'ADMIN' ? 'admin' : 'mod'}
          </span>
        )}
        {needsNick && (
          <span
            className="ml-1.5 text-[10px] uppercase tracking-wider text-blood-400"
            title="Clique pra escolher um nickname"
          >
            novo
          </span>
        )}
      </Link>
      <form action={doSignOut}>
        <button
          type="submit"
          className="px-3 py-1.5 rounded text-ink-300 hover:bg-ink-800 hover:text-ink-50 transition-colors text-sm"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
