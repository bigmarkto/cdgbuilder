/**
 * /settings/profile — edição do próprio perfil (handle/name/bio).
 *
 * Fluxo:
 *   1. Server component busca session + user completo (com handle/bio).
 *   2. Form server action valida + atualiza via Prisma.
 *   3. Erros de validação/unicidade viram query param `?err=...` e são
 *      renderizados acima do form.
 *
 * O handle é único: se o usuário tentar pegar um handle já usado, o Prisma
 * lança P2002 e a gente devolve mensagem amigável.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { validateProfile } from '@/lib/profile';

export const metadata = {
  title: 'Perfil — CDG Builder'
};

export const dynamic = 'force-dynamic';

async function updateProfile(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const result = validateProfile({
    handle: String(formData.get('handle') ?? ''),
    name: String(formData.get('name') ?? ''),
    bio: String(formData.get('bio') ?? '')
  });

  if ('error' in result) {
    redirect(`/settings/profile?err=${encodeURIComponent(result.error.message)}`);
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: result.data
    });
  } catch (err) {
    // P2002 = unique constraint violation. No nosso caso só handle é único pelo
    // usuário; então se estourou, é handle duplicado.
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002') {
      redirect(
        `/settings/profile?err=${encodeURIComponent('Esse nickname já está em uso — escolhe outro.')}`
      );
    }
    throw err;
  }

  revalidatePath('/settings/profile');
  revalidatePath('/');
  redirect('/settings/profile?ok=1');
}

export default async function ProfilePage({
  searchParams
}: {
  searchParams: { err?: string; ok?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, handle: true, name: true, bio: true, role: true, createdAt: true }
  });

  if (!user) {
    // Session existe mas user sumiu (ban hard, delete manual). Manda deslogar.
    redirect('/login');
  }

  const err = searchParams.err;
  const ok = searchParams.ok === '1';

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="font-serif text-2xl text-ink-50 mb-1">Perfil</h1>
      <p className="text-xs text-ink-400 mb-6">
        Conta criada em{' '}
        {user.createdAt.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })}
        {' · '}
        <span className="uppercase tracking-wider">{user.role.toLowerCase()}</span>
      </p>

      {err && (
        <div className="mb-4 px-3 py-2 rounded border border-blood-500 bg-blood-500/10 text-blood-200 text-sm">
          {err}
        </div>
      )}
      {ok && (
        <div className="mb-4 px-3 py-2 rounded border border-ember-500 bg-ember-500/10 text-ember-200 text-sm">
          Perfil atualizado.
        </div>
      )}

      <form action={updateProfile} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm text-ink-200 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={user.email ?? ''}
            disabled
            className="w-full px-3 py-2 rounded border border-ink-700 bg-ink-900/50 text-ink-400 cursor-not-allowed"
          />
          <p className="text-xs text-ink-500 mt-1">
            O email é o seu login. Pra trocar, precisa suporte manual.
          </p>
        </div>

        <div>
          <label htmlFor="handle" className="block text-sm text-ink-200 mb-1">
            Nickname (@handle)
          </label>
          <div className="flex">
            <span className="px-3 py-2 rounded-l border border-r-0 border-ink-600 bg-ink-800 text-ink-400 text-sm">
              @
            </span>
            <input
              id="handle"
              name="handle"
              type="text"
              defaultValue={user.handle ?? ''}
              placeholder="seu-nick"
              pattern="[a-z0-9_\-]{3,24}"
              maxLength={24}
              className="flex-1 px-3 py-2 rounded-r border border-ink-600 bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400"
            />
          </div>
          <p className="text-xs text-ink-500 mt-1">
            3–24 caracteres · letras minúsculas, números, <code>_</code> ou <code>-</code>.
            Usado no seu link público <code>/u/&lt;handle&gt;</code>.
          </p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm text-ink-200 mb-1">
            Nome de exibição
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={user.name ?? ''}
            placeholder="Como você quer aparecer"
            maxLength={60}
            className="w-full px-3 py-2 rounded border border-ink-600 bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400"
          />
          <p className="text-xs text-ink-500 mt-1">Opcional. Até 60 caracteres.</p>
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm text-ink-200 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={user.bio ?? ''}
            maxLength={500}
            rows={4}
            placeholder="Uma linha sobre você, seu personagem favorito, ou o que você mais gosta no sistema..."
            className="w-full px-3 py-2 rounded border border-ink-600 bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400 resize-y"
          />
          <p className="text-xs text-ink-500 mt-1">Opcional. Até 500 caracteres.</p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-ember-500 text-ink-950 font-medium hover:bg-ember-400"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
