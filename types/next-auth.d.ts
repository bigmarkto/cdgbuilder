/**
 * Augmentação de tipos do next-auth — adiciona id/role/bannedAt ao session.user
 * para usarmos em server components sem casts.
 */
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'READER' | 'EDITOR' | 'MODERATOR' | 'ADMIN';
      handle: string | null;
      bannedAt: Date | null;
    } & DefaultSession['user'];
  }
}
