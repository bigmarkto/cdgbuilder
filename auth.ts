/**
 * Auth.js v5 (NextAuth beta) — configuração root.
 *
 * Fluxo: magic-link por email (passwordless). O provider Resend envia um
 * link de verificação; ao clicar, o Auth.js cria/reencontra o User via
 * PrismaAdapter e emite uma sessão persistida em Session (strategy "database").
 *
 * Por que database session e não JWT:
 *   • Permite invalidar sessão server-side (ban, logout remoto) sem esperar
 *     expiração do token.
 *   • Simplifica ler role do User em cada request sem sincronizar claims.
 *
 * Role default = READER; promoções para EDITOR/MODERATOR/ADMIN são manuais
 * via SQL ou admin panel (Fase 6).
 */
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';

const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' },
  trustHost: true,
  pages: {
    signIn: '/login',
    verifyRequest: '/login/check-email'
  },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: FROM
    })
  ],
  callbacks: {
    // Injeta id + role na session para uso em server components / API routes.
    // Types aumentados em types/next-auth.d.ts.
    async session({ session, user }) {
      if (session.user && user) {
        const u = user as typeof user & {
          role?: 'READER' | 'EDITOR' | 'MODERATOR' | 'ADMIN';
          handle?: string | null;
          bannedAt?: Date | null;
        };
        session.user.id = u.id;
        session.user.role = u.role ?? 'READER';
        session.user.handle = u.handle ?? null;
        session.user.bannedAt = u.bannedAt ?? null;
      }
      return session;
    }
  },
  events: {
    // Log discreto — ajuda debugar magic-link em dev.
    async signIn({ user, isNewUser }) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[auth] signIn ${user.email} (new=${isNewUser})`);
      }
    }
  }
});
