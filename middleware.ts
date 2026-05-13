/**
 * Middleware — gating barato no edge antes do RSC executar.
 *
 * Não substitui as checagens server-side: cada server action / page ainda
 * chama requireRole() porque o middleware confia só no cookie e isso é
 * frágil (cookie pode estar stale, ou apontar pra session deletada por ban).
 * Aqui só fazemos um pré-filtro: se nem cookie tem, redireciona já.
 *
 * Por que não fazer a verificação completa aqui:
 *   • O middleware roda no Edge Runtime (Vercel) — sem acesso ao Prisma
 *     client com binary engine, e os imports da camada `lib/db` quebram.
 *   • A checagem real (role + bannedAt re-lidos do banco) precisa rodar
 *     no nó/serverless. A pages/actions fazem isso.
 *
 * Cobertura:
 *   • /admin/** → exige cookie de sessão; sem cookie, redirect pra /login.
 *   • /settings/** → mesmo.
 *   • Resto fica aberto — a página decide.
 */

import { NextResponse, type NextRequest } from 'next/server';

// Auth.js v5 sets one of these cookie names depending on https/dev. We
// just check for presence — not validity.
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  // Compat: alguns deploys antigos do NextAuth v4 ainda usam esse nome.
  'next-auth.session-token',
  '__Secure-next-auth.session-token'
];

const PROTECTED_PREFIXES = ['/admin', '/settings'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSession) return NextResponse.next();

  // Sem cookie → manda direto pra /login com callbackUrl. Evita um round-trip
  // de RSC só pra ver que precisa autenticar.
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Casa /admin e /settings + qualquer subrota.
    '/admin/:path*',
    '/settings/:path*'
  ]
};
