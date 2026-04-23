'use server';

/**
 * Server actions para criação e edição de páginas community.
 *
 * Todas as actions:
 *   1. Re-verificam auth + role via requireRole('EDITOR', mode='throw').
 *   2. Validam input estruturalmente (slug, canonicalRef, body shape).
 *   3. Persistem via transaction Prisma (Page + Revision + update currentRevisionId).
 *   4. Revalidam paths afetados (reader, index, eventual canonical).
 *   5. Retornam `{ ok: true, slug }` ou `{ ok: false, error }` — o cliente
 *      decide como exibir. Server actions nunca throw em caminho feliz.
 *
 * O body é JSON TipTap/ProseMirror. Validamos com isDoc() — não executamos
 * renderDoc aqui porque o render é resp. do reader. Se algum ataque chegar
 * com JSON malformado, fica no banco mas o reader renderiza como doc vazio
 * (renderDoc tem fallback defensivo).
 */

import { revalidatePath } from 'next/cache';
import type { PageKind } from '@prisma/client';
import { db } from '@/lib/db';
import { requireRole, PermissionError } from './permissions';
import { isDoc, type DocNode } from './doc';
import { isValidSlug } from './slug';
import { parseCanonicalRef } from './canonicalRef';
import { writeAudit, AUDIT_ACTIONS } from './auditLog';
import { buildSearchText } from './search';

export type ActionResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; field?: string };

const VALID_KINDS: readonly PageKind[] = ['ARTICLE', 'CHARACTER', 'LORE', 'GUIDE', 'GLOSSARY'];

type CreateInput = {
  title: string;
  slug: string;
  kind: PageKind;
  canonicalRef?: string | null;
  body: unknown; // TipTap JSON do editor
  summary?: string;
};

type UpdateInput = {
  pageId: string;
  title: string;
  kind: PageKind;
  canonicalRef?: string | null;
  body: unknown;
  summary?: string;
};

/**
 * Validação compartilhada. Devolve `{ data }` pronto pra persistência ou
 * `{ error }` com field apontado. Não toca o banco.
 */
function validateInput(input: {
  title: string;
  slug?: string;
  kind: PageKind;
  canonicalRef?: string | null;
  body: unknown;
}): { data: {
  title: string;
  slug?: string;
  kind: PageKind;
  canonicalRef: string | null;
  body: DocNode;
}} | { error: string; field?: string } {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) {
    return { error: 'Título deve ter entre 2 e 120 caracteres.', field: 'title' };
  }

  if (input.slug !== undefined) {
    if (!isValidSlug(input.slug)) {
      return {
        error:
          'Slug inválido — use apenas letras minúsculas, números e hífens (3–80 chars).',
        field: 'slug'
      };
    }
    // Slugs reservados (rotas estáticas da seção /wiki/c/*).
    const reserved = ['new', 'c', 'index', 'search'];
    if (reserved.includes(input.slug)) {
      return { error: 'Esse slug é reservado — escolhe outro.', field: 'slug' };
    }
  }

  if (!VALID_KINDS.includes(input.kind)) {
    return { error: 'Tipo de página inválido.', field: 'kind' };
  }

  let canonicalRef: string | null = null;
  if (input.canonicalRef) {
    const trimmed = input.canonicalRef.trim();
    if (trimmed) {
      const parsed = parseCanonicalRef(trimmed);
      if (!parsed) {
        return {
          error:
            'Referência canônica inválida — use o formato "<seção>/<id>" e confirma que existe.',
          field: 'canonicalRef'
        };
      }
      canonicalRef = `${parsed.section}/${parsed.id}`;
    }
  }

  if (!isDoc(input.body)) {
    return { error: 'Conteúdo do editor em formato inválido.', field: 'body' };
  }

  return {
    data: {
      title,
      slug: input.slug,
      kind: input.kind,
      canonicalRef,
      body: input.body
    }
  };
}

// ---------------------------------------------------------------------------
// createPage
// ---------------------------------------------------------------------------

export async function createPage(input: CreateInput): Promise<ActionResult> {
  let member;
  try {
    member = await requireRole('EDITOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para criar páginas.'
            : 'Sua conta não tem permissão para criar páginas.'
      };
    }
    throw err;
  }

  const validation = validateInput(input);
  if ('error' in validation) return { ok: false, error: validation.error, field: validation.field };

  const { title, slug, kind, canonicalRef, body } = validation.data;

  try {
    const searchText = buildSearchText(title, body);

    const page = await db.$transaction(async (tx) => {
      const created = await tx.page.create({
        data: {
          slug: slug!,
          title,
          kind,
          canonicalRef,
          authorId: member.id,
          searchText
        }
      });
      const revision = await tx.revision.create({
        data: {
          pageId: created.id,
          authorId: member.id,
          body: body as unknown as object,
          summary: input.summary?.trim() || 'Criação da página.',
          status: 'PUBLISHED'
        }
      });
      return tx.page.update({
        where: { id: created.id },
        data: { currentRevisionId: revision.id }
      });
    });

    revalidatePath('/wiki/c');
    revalidatePath(`/wiki/c/${page.slug}`);
    if (canonicalRef) revalidatePath(`/wiki/${canonicalRef}`);

    return { ok: true, slug: page.slug };
  } catch (err) {
    return mapPrismaError(err);
  }
}

// ---------------------------------------------------------------------------
// updatePage
// ---------------------------------------------------------------------------

export async function updatePage(input: UpdateInput): Promise<ActionResult> {
  let member;
  try {
    member = await requireRole('EDITOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para editar páginas.'
            : 'Sua conta não tem permissão para editar páginas.'
      };
    }
    throw err;
  }

  const existing = await db.page.findUnique({
    where: { id: input.pageId },
    select: { id: true, slug: true, locked: true, deletedAt: true, canonicalRef: true }
  });
  if (!existing || existing.deletedAt) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  if (existing.locked && member.role !== 'MODERATOR' && member.role !== 'ADMIN') {
    return {
      ok: false,
      error: 'Essa página está trancada pela moderação e não pode ser editada agora.'
    };
  }

  const validation = validateInput({ ...input, slug: undefined });
  if ('error' in validation) return { ok: false, error: validation.error, field: validation.field };

  const { title, kind, canonicalRef, body } = validation.data;

  try {
    const searchText = buildSearchText(title, body);

    const page = await db.$transaction(async (tx) => {
      const revision = await tx.revision.create({
        data: {
          pageId: existing.id,
          authorId: member.id,
          body: body as unknown as object,
          summary: input.summary?.trim() || 'Edição sem resumo.',
          status: 'PUBLISHED'
        }
      });
      return tx.page.update({
        where: { id: existing.id },
        data: {
          title,
          kind,
          canonicalRef,
          currentRevisionId: revision.id,
          searchText
        }
      });
    });

    revalidatePath('/wiki/c');
    revalidatePath(`/wiki/c/${page.slug}`);
    revalidatePath(`/wiki/c/${page.slug}/history`);
    // Revalida a canonical nova e a antiga (se mudou o ref).
    if (canonicalRef) revalidatePath(`/wiki/${canonicalRef}`);
    if (existing.canonicalRef && existing.canonicalRef !== canonicalRef) {
      revalidatePath(`/wiki/${existing.canonicalRef}`);
    }

    return { ok: true, slug: page.slug };
  } catch (err) {
    return mapPrismaError(err);
  }
}

// ---------------------------------------------------------------------------
// revertToRevision — rollback para uma revisão anterior
// ---------------------------------------------------------------------------

type RevertInput = {
  pageId: string;
  revisionId: string;
  summary?: string;
};

/**
 * Rollback: cria uma NOVA revisão com o body da revisão alvo e a promove
 * a currentRevision. Imutabilidade preservada — a revisão alvo continua
 * intacta no histórico, e a revisão que era current vira apenas uma entrada
 * anterior na trilha (status permanece PUBLISHED).
 *
 * Permite que um EDITOR+ "desfaça" uma edição recente sem perder auditoria.
 * Locked ainda bloqueia (exceto MODERATOR/ADMIN). Proíbe reverter para a
 * própria currentRevision (no-op).
 */
export async function revertToRevision(input: RevertInput): Promise<ActionResult> {
  let member;
  try {
    member = await requireRole('EDITOR', { mode: 'throw' });
  } catch (err) {
    if (err instanceof PermissionError) {
      return {
        ok: false,
        error:
          err.code === 'not-authenticated'
            ? 'Você precisa entrar para restaurar revisões.'
            : 'Sua conta não tem permissão para restaurar revisões.'
      };
    }
    throw err;
  }

  const [page, target] = await Promise.all([
    db.page.findUnique({
      where: { id: input.pageId },
      select: {
        id: true,
        slug: true,
        title: true,
        locked: true,
        deletedAt: true,
        canonicalRef: true,
        currentRevisionId: true
      }
    }),
    db.revision.findUnique({
      where: { id: input.revisionId },
      select: { id: true, pageId: true, body: true, createdAt: true, author: { select: { handle: true, name: true } } }
    })
  ]);

  if (!page || page.deletedAt) {
    return { ok: false, error: 'Página não encontrada.' };
  }
  if (!target || target.pageId !== page.id) {
    return { ok: false, error: 'Revisão não encontrada ou não pertence a essa página.' };
  }
  if (page.locked && member.role !== 'MODERATOR' && member.role !== 'ADMIN') {
    return {
      ok: false,
      error: 'Essa página está trancada pela moderação e não pode ser editada agora.'
    };
  }
  if (target.id === page.currentRevisionId) {
    return { ok: false, error: 'Essa já é a revisão atual — nada a restaurar.' };
  }

  // Monta summary automático se não veio — aparece no histórico explicando
  // de onde veio o conteúdo.
  const authorLabel = target.author.handle
    ? `@${target.author.handle}`
    : target.author.name ?? 'autor anônimo';
  const ts = target.createdAt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const autoSummary = `Revertido para revisão de ${authorLabel} em ${ts}.`;

  try {
    // Revert reusa o body da revisão alvo; title da página não muda aqui,
    // mas o searchText precisa ser recomputado porque o body mudou.
    const searchText = buildSearchText(page.title, target.body);

    const updated = await db.$transaction(async (tx) => {
      const revision = await tx.revision.create({
        data: {
          pageId: page.id,
          authorId: member.id,
          body: target.body as unknown as object,
          summary: input.summary?.trim() || autoSummary,
          status: 'PUBLISHED'
        }
      });
      return tx.page.update({
        where: { id: page.id },
        data: { currentRevisionId: revision.id, searchText }
      });
    });

    await writeAudit({
      actorId: member.id,
      action: AUDIT_ACTIONS.REVISION_REVERT,
      entityType: 'page',
      entityId: page.id,
      meta: {
        pageSlug: updated.slug,
        fromRevisionId: page.currentRevisionId,
        toRevisionId: target.id
      }
    });

    revalidatePath('/wiki/c');
    revalidatePath(`/wiki/c/${updated.slug}`);
    revalidatePath(`/wiki/c/${updated.slug}/history`);
    if (page.canonicalRef) revalidatePath(`/wiki/${page.canonicalRef}`);

    return { ok: true, slug: updated.slug };
  } catch (err) {
    return mapPrismaError(err);
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mapPrismaError(err: unknown): ActionResult {
  // P2002 = unique constraint. No nosso caso: slug OU canonicalRef.
  if (err instanceof Error && 'code' in err) {
    const code = (err as { code?: string }).code;
    const meta = (err as { meta?: { target?: string[] | string } }).meta;
    if (code === 'P2002') {
      const target = Array.isArray(meta?.target) ? meta?.target.join(',') : meta?.target ?? '';
      if (target.includes('slug')) {
        return { ok: false, error: 'Já existe uma página com essa slug.', field: 'slug' };
      }
      if (target.includes('canonicalRef')) {
        return {
          ok: false,
          error:
            'Já existe uma página community ligada a essa entidade canônica. Edite a existente.',
          field: 'canonicalRef'
        };
      }
      return { ok: false, error: 'Conflito: valor duplicado.' };
    }
  }
  // eslint-disable-next-line no-console
  console.error('[pageActions] unexpected error:', err);
  return { ok: false, error: 'Erro interno ao salvar. Tente novamente.' };
}
