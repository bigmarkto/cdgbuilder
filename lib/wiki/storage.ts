/**
 * Storage — cliente Supabase Storage (server-side, service role).
 *
 * Server-only por design:
 *   • Usa SERVICE_ROLE_KEY (bypassa RLS) — NUNCA embarcar no bundle client.
 *   • Nomeado sem prefixo `next-safe-server` mas só é importado de server
 *     actions, então o Next não vai inclui-lo no bundle client.
 *
 * Bucket convencional: `wiki-uploads` (público para leitura via URL).
 *
 * Setup no dashboard Supabase (uma vez por ambiente):
 *   1. Storage → New bucket → "wiki-uploads", público
 *   2. Policies → opcionalmente restringir INSERT pra service_role
 *
 * Variáveis de ambiente necessárias:
 *   • NEXT_PUBLIC_SUPABASE_URL   — https://<project>.supabase.co
 *   • SUPABASE_SERVICE_ROLE_KEY  — dashboard > Project Settings > API
 *
 * Se qualquer uma faltar, getStorage() lança com mensagem clara pra dev
 * reconhecer o problema no log. A uploadAction captura e devolve erro
 * amigável pro usuário.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET = 'wiki-uploads';

let cached: SupabaseClient | null = null;

/**
 * Lazy singleton — evita criar client no cold start se ninguém usa storage.
 * Reaproveita a mesma instância em dev pra não vazar handles no HMR.
 */
export function getStorage(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase Storage não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.'
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}

/**
 * Gera path único pra um upload: `<yyyy-mm>/<cuid>.<ext>`.
 * O particionamento mensal ajuda se um dia precisarmos listar/limpar por período.
 */
export function buildStoragePath(id: string, extension: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extension.toLowerCase().replace(/^\.+/, '').replace(/[^a-z0-9]/g, '');
  return `${yyyy}-${mm}/${id}.${ext}`;
}

/**
 * URL pública de um arquivo no bucket. Não valida existência.
 */
export function publicUrlFor(path: string): string {
  const storage = getStorage();
  const { data } = storage.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Gera uma URL assinada de UPLOAD — o browser faz PUT direto no Supabase
 * sem passar pelo nosso Node. Evita o duplo trânsito (client → Next → bucket)
 * e desbloqueia o thread do server durante uploads grandes.
 *
 * Fluxo:
 *   1. Server action chama isso e devolve `{ signedUrl, token, path }` pro client.
 *   2. Client dá PUT via XHR/fetch em `signedUrl` com o arquivo no body.
 *   3. Depois que o PUT termina, client chama `finalizeUpload()` pra persistir
 *      o registro FileUpload no banco.
 *
 * A URL tem TTL curto (default do Supabase ~2h). Se cair um upload no meio,
 * o arquivo fica órfão no bucket sem row correspondente — aceitável pro MVP,
 * um cron futuro pode varrer.
 */
export async function createSignedUploadUrl(
  path: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const storage = getStorage();
  const { data, error } = await storage.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(
      `Falha ao gerar signed upload URL: ${error?.message ?? 'resposta vazia'}`
    );
  }
  return data;
}
