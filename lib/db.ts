/**
 * Prisma client singleton — HMR-safe.
 *
 * Em dev, o Next.js recarrega módulos a cada edição, e sem esse guard cada
 * reload cria um novo PrismaClient até estourar o connection pool do Postgres.
 * O truque clássico é guardar a instância no globalThis entre reloads.
 *
 * Em produção (Vercel serverless) cada invocação é uma lambda nova, então
 * o guard é no-op e apenas instanciamos uma vez por cold start.
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __cdg_prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__cdg_prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__cdg_prisma = db;
}
