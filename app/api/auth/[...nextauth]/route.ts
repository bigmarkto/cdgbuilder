/**
 * Catch-all route do Auth.js v5.
 *
 * Em v5 toda lógica de provider/callbacks vive no root `auth.ts`; esse
 * route só re-exporta os handlers HTTP (GET/POST) que o framework fabricou.
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
