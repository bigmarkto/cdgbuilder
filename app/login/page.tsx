/**
 * /login — formulário de entrada por magic-link.
 *
 * Server action chama signIn('resend', { email }) e redireciona para
 * /login/check-email. Como estamos usando database session + Resend,
 * não há senha nem OAuth button nessa fase.
 */
import { redirect } from 'next/navigation';
import { signIn, auth } from '@/auth';

export const metadata = {
  title: 'Entrar — CDG Builder'
};

async function sendMagicLink(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return;
  await signIn('resend', {
    email,
    redirectTo: '/'
  });
}

export default async function LoginPage() {
  // Se já logado, manda direto pra home.
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-serif text-2xl text-ink-50 mb-2">Entrar</h1>
      <p className="text-sm text-ink-300 mb-6">
        Enviamos um link mágico para o seu email. Nada de senha — clique no link
        para entrar. Sua conta é criada automaticamente no primeiro acesso.
      </p>

      <form action={sendMagicLink} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm text-ink-200">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className="px-3 py-2 rounded border border-ink-600 bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-ember-500 text-ink-950 font-medium hover:bg-ember-400"
        >
          Enviar link mágico
        </button>
      </form>

      <p className="mt-6 text-xs text-ink-400">
        Ao entrar, você começa como <strong>leitor</strong>. Contas são promovidas
        para editor conforme você contribui.
      </p>
    </div>
  );
}
