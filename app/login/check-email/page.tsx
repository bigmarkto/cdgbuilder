/**
 * /login/check-email — landing pós-envio de magic-link.
 *
 * Auth.js redireciona pra cá após o signIn(). Sem interação — só instrui
 * o usuário a abrir a caixa de entrada.
 */
export const metadata = {
  title: 'Confira seu email — CDG Builder'
};

export default function CheckEmailPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="font-serif text-2xl text-ink-50 mb-3">Confira seu email</h1>
      <p className="text-sm text-ink-300">
        Enviamos um link para entrar. Ele expira em <strong>24h</strong> e só pode
        ser usado uma vez. Se não chegar, verifique a pasta de spam.
      </p>
      <p className="mt-6 text-xs text-ink-400">
        Pode fechar esta aba — o link abrirá a ficha automaticamente quando
        clicado.
      </p>
    </div>
  );
}
