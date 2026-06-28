/**
 * /login — entrada por login social (Discord).
 *
 * Um botão, um clique: a server action chama signIn('discord') e o Auth.js
 * redireciona pro OAuth do Discord e de volta. Sem senha, sem email.
 * Respeita ?callbackUrl (usado pelo middleware ao barrar rotas protegidas).
 */
import { redirect } from 'next/navigation';
import { signIn, auth } from '@/auth';

export const metadata = {
  title: 'Entrar — CDG Builder'
};

// Mensagens amigáveis pros códigos de erro que o Auth.js devolve via ?error=.
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'Esse email já está vinculado a outra forma de login. Use o mesmo método de antes.',
  OAuthSignin: 'Não foi possível iniciar o login com o Discord. Tente de novo.',
  OAuthCallback: 'O Discord recusou o login. Tente de novo.',
  Configuration:
    'O login está mal configurado no servidor (credenciais do Discord ausentes). Avise o administrador.',
  AccessDenied: 'Acesso negado. Sua conta pode estar suspensa.',
  default: 'Algo deu errado ao entrar. Tente novamente.'
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await auth();
  if (session?.user) {
    redirect(searchParams.callbackUrl || '/');
  }

  const callbackUrl = searchParams.callbackUrl || '/';
  const error = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.default
    : null;

  async function signInDiscord() {
    'use server';
    await signIn('discord', { redirectTo: callbackUrl });
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-serif text-2xl text-ink-50 mb-2">Entrar</h1>
      <p className="text-sm text-ink-300 mb-6">
        Entre com sua conta do Discord — um clique, sem senha. Sua conta no CDG é
        criada automaticamente no primeiro acesso.
      </p>

      {error && (
        <div className="mb-4 rounded border border-blood-400/50 bg-blood-500/10 px-3 py-2 text-sm text-blood-200">
          {error}
        </div>
      )}

      <form action={signInDiscord}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded font-medium text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#5865F2' }}
        >
          <DiscordIcon />
          Entrar com Discord
        </button>
      </form>

      <p className="mt-6 text-xs text-ink-400">
        Ao entrar, você começa como <strong>leitor</strong>. Contas são promovidas
        para editor conforme você contribui.
      </p>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
