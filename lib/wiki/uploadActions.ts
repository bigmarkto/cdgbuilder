'use server';

/**
 * Server actions para uploads de imagem (fluxo direto via signed URL).
 *
 * Por que dividir em prepare + finalize:
 *   Antes, o browser mandava o File inteiro via FormData pro server action,
 *   que por sua vez reenviava ao Supabase. Dois trânsitos de rede, body
 *   limit de 1MB do Next 14, thread do Node bloqueado durante upload. Uploads
 *   de 3-4MB ficavam MUITO lentos e podiam travar outras requests.
 *
 *   Agora:
 *     1. Client chama `prepareUpload({ fileName, mimeType, size })` — action
 *        valida auth/role/MIME/size, gera path único + signed URL com token,
 *        devolve tudo em <100ms.
 *     2. Client dá PUT direto no `signedUrl` via XHR (com progress events).
 *        O arquivo vai cliente → Supabase, sem passar pelo Node.
 *     3. Client chama `finalizeUpload({ storagePath, mimeType, sizeBytes })`
 *        pra gravar o registro FileUpload no banco.
 *
 *   Se finalize falha (ou client fecha a aba), o arquivo fica órfão no bucket.
 *   Um cron futuro pode varrer paths sem FileUpload correspondente.
 *
 * Limites e restrições continuam os mesmos: EDITOR+, 4MB max, MIME allowlist.
 */

import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { requireRole, PermissionError } from './permissions';
import {
  STORAGE_BUCKET,
  getStorage,
  buildStoragePath,
  publicUrlFor,
  createSignedUploadUrl
} from './storage';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
};

export type PrepareUploadResult =
  | {
      ok: true;
      uploadUrl: string;
      token: string;
      storagePath: string;
      publicUrl: string;
      maxBytes: number;
    }
  | { ok: false; error: string };

export type FinalizeUploadResult =
  | { ok: true; uploadId: string; url: string }
  | { ok: false; error: string };

/**
 * Mantido como compat shim — assinatura antiga pra qualquer código legado
 * que ainda chame com FormData. Internamente agora usa o fluxo novo.
 * TODO: remover quando ninguém mais importar.
 */
export type UploadResult =
  | { ok: true; url: string; uploadId: string; width?: number; height?: number }
  | { ok: false; error: string };

/**
 * Valida metadata + auth e devolve uma URL assinada pra upload direto.
 * Não toca o arquivo — o client faz o PUT.
 */
export async function prepareUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<PrepareUploadResult> {
  try {
    await requireRole('EDITOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para enviar imagens.'
            : 'Sua conta não tem permissão para enviar imagens.'
      };
    }
    throw err;
  }

  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Metadata inválida.' };
  }

  const { mimeType, size } = input;

  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return { ok: false, error: 'Tamanho de arquivo inválido.' };
  }
  if (size > MAX_BYTES) {
    return {
      ok: false,
      error: `Arquivo muito grande (máximo ${Math.round(MAX_BYTES / 1024 / 1024)}MB).`
    };
  }

  const ext = ALLOWED_MIME[mimeType];
  if (!ext) {
    return {
      ok: false,
      error: `Formato não suportado (${mimeType || 'desconhecido'}). Use PNG, JPEG, WebP, GIF ou SVG.`
    };
  }

  const fileKey = randomUUID();
  const storagePath = buildStoragePath(fileKey, ext);

  let signed;
  try {
    signed = await createSignedUploadUrl(storagePath);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[prepareUpload] signed URL failed:', err);
    return {
      ok: false,
      error:
        'Uploads estão temporariamente indisponíveis. Avise um administrador.'
    };
  }

  const publicUrl = publicUrlFor(storagePath);

  return {
    ok: true,
    uploadUrl: signed.signedUrl,
    token: signed.token,
    storagePath,
    publicUrl,
    maxBytes: MAX_BYTES
  };
}

/**
 * Grava o registro FileUpload após o PUT direto pelo client.
 * Revalida auth + MIME + tamanho pra não confiar cegamente no browser,
 * e confere que o arquivo realmente está no bucket no path declarado.
 */
export async function finalizeUpload(input: {
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<FinalizeUploadResult> {
  let member;
  try {
    member = await requireRole('EDITOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para enviar imagens.'
            : 'Sua conta não tem permissão para enviar imagens.'
      };
    }
    throw err;
  }

  const { storagePath, mimeType, sizeBytes } = input ?? ({} as typeof input);

  if (typeof storagePath !== 'string' || !storagePath || storagePath.includes('..')) {
    return { ok: false, error: 'Caminho de arquivo inválido.' };
  }
  if (!ALLOWED_MIME[mimeType]) {
    return { ok: false, error: 'Formato não suportado.' };
  }
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return { ok: false, error: 'Tamanho inválido.' };
  }

  // Confirma que o arquivo realmente existe no bucket — evita registrar
  // uploads falsos se o client chamar finalize sem ter feito o PUT.
  try {
    const storage = getStorage();
    // Lista o diretório pra ver se o objeto está lá. Leve e barato.
    const slash = storagePath.lastIndexOf('/');
    const dir = slash >= 0 ? storagePath.slice(0, slash) : '';
    const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
    const { data: listing, error: listErr } = await storage.storage
      .from(STORAGE_BUCKET)
      .list(dir, { limit: 100, search: name });
    if (listErr) {
      // eslint-disable-next-line no-console
      console.error('[finalizeUpload] list failed:', listErr);
      return { ok: false, error: 'Falha ao confirmar envio do arquivo.' };
    }
    const found = listing?.some((entry) => entry.name === name);
    if (!found) {
      return {
        ok: false,
        error: 'Arquivo não encontrado no bucket — o envio pode ter falhado.'
      };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[finalizeUpload] verify failed:', err);
    return { ok: false, error: 'Falha ao confirmar envio do arquivo.' };
  }

  const url = publicUrlFor(storagePath);

  const record = await db.fileUpload.create({
    data: {
      uploaderId: member.id,
      url,
      storagePath,
      mimeType,
      sizeBytes
    },
    select: { id: true, url: true }
  });

  return { ok: true, uploadId: record.id, url: record.url };
}

/**
 * Compat: versão antiga que recebe FormData. Encaminha pro novo fluxo
 * mas ainda com duplo trânsito — evite usar em código novo. Mantida só
 * pra não quebrar callers legados até a remoção formal.
 *
 * @deprecated Use prepareUpload + PUT direto + finalizeUpload.
 */
export async function uploadImage(formData: FormData): Promise<UploadResult> {
  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return { ok: false, error: 'Arquivo não enviado.' };
  }
  if (fileEntry.size === 0) {
    return { ok: false, error: 'Arquivo vazio.' };
  }

  const prep = await prepareUpload({
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    size: fileEntry.size
  });
  if (!prep.ok) return { ok: false, error: prep.error };

  // Server-side fetch → Supabase (trânsito único do ponto de vista do Node,
  // mas ainda bloqueia o thread). Aceitável porque esse path é deprecated.
  try {
    const bytes = await fileEntry.arrayBuffer();
    const putRes = await fetch(prep.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': fileEntry.type },
      body: bytes
    });
    if (!putRes.ok) {
      return { ok: false, error: `Falha ao enviar (HTTP ${putRes.status}).` };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[uploadImage] PUT failed:', err);
    return { ok: false, error: 'Falha ao enviar o arquivo. Tente de novo.' };
  }

  const fin = await finalizeUpload({
    storagePath: prep.storagePath,
    mimeType: fileEntry.type,
    sizeBytes: fileEntry.size
  });
  if (!fin.ok) return { ok: false, error: fin.error };

  return { ok: true, url: fin.url, uploadId: fin.uploadId };
}
