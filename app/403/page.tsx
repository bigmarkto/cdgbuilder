/**
 * /403 — página de "acesso negado".
 *
 * Renderizada quando `requireRole()` decide que o usuário está logado mas
 * não tem o papel necessário pra acessar a rota. Não usamos status 403 HTTP
 * porque é uma redirect-target (a rota original já respondeu com 307);
 * isso aqui é só a tela final.
 *
 * Bloqueado de indexação por robots — não há razão pra esses endpoints
 * aparecerem em SERP.
 */
import Link from 'next/link';

export const metadata = {
  title: 'Acesso negado — CDG',
  robots: { index: false, follow: false }
};

export default function ForbiddenPage({
  searchParams
}: {
  searchParams: { from?: string };
}) {
  const from = searchParams.from;
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-blood-400 mb-2">403</p>
      <h1 className="font-serif text-3xl text-ink-50 mb-3">Acesso negado</h1>
      <p className="text-ink-200 mb-6">
        Você está logado, mas sua conta não tem permissão para abrir essa
        página. Se acha que isso é um erro, peça pra um admin promover seu
        papel.
      </p>
      {from && (
        <p className="text-xs text-ink-400 mb-6">
          tentava acessar:{' '}
          <code className="text-ember-400 break-all">{from}</code>
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <Link
          href="/"
          className="px-4 py-2 rounded border border-ember-400 text-ember-400 hover:bg-ember-400/10"
        >
          Voltar ao início
        </Link>
        <Link
          href="/wiki"
          className="px-4 py-2 rounded border border-ink-600 text-ink-200 hover:bg-ink-800"
        >
          Ir pra wiki
        </Link>
      </div>
    </div>
  );
}
