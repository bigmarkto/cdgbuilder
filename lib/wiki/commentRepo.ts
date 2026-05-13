/**
 * commentRepo — queries Prisma para comentários de páginas community.
 *
 * Estratégia de carregamento:
 *   • Busca todos os comentários visíveis da página numa query só (uma FK)
 *     e monta a árvore em memória. É muito mais barato que N queries de
 *     replies e o volume esperado por página é baixo (dezenas, não milhares).
 *   • Comentários `hiddenAt != null` continuam no resultado pra não quebrar
 *     a árvore de replies — mas o body é zerado server-side quando o viewer
 *     não é MOD+. O placeholder "[removido pela moderação]" vive no client.
 *
 * Regras de visibilidade:
 *   • `hiddenAt != null` + não-MOD → body retornado como '' (zerado aqui no
 *     server pra NUNCA ir no payload RSC). Estrutura preservada.
 *   • MOD+ vê body original com badge "oculto" pra poder desfazer.
 *
 * Privacidade: nunca passar o `body` original pra clientes não-MOD. O bug
 * histórico era que o componente client recebia o body completo via props
 * (que vai no RSC payload), e o componente só escondia no JSX — devassável
 * via DevTools. Agora zeramos aqui.
 */
import { db } from '@/lib/db';

export interface CommentNode {
  id: string;
  pageId: string;
  parentId: string | null;
  body: string;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    handle: string | null;
    name: string | null;
  };
  replies: CommentNode[];
}

export interface ListCommentTreeOptions {
  /**
   * Se true, o body de comentários ocultos é retornado intacto (pra UI de
   * moderação que precisa ler o que foi escondido pra decidir desfazer).
   * Se false (default), body de hidden vira '' antes de sair do server.
   */
  canModerate?: boolean;
}

/**
 * Carrega todos os comentários de uma página e monta a árvore.
 * Ordena top-level por createdAt asc (mais antigos primeiro — conversa
 * lê como fio), replies também asc dentro de cada thread.
 */
export async function listCommentTree(
  pageId: string,
  opts: ListCommentTreeOptions = {}
): Promise<CommentNode[]> {
  const canModerate = opts.canModerate ?? false;

  const rows = await db.comment.findMany({
    where: { pageId },
    select: {
      id: true,
      pageId: true,
      parentId: true,
      body: true,
      hiddenAt: true,
      hiddenReason: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, handle: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  const sanitized = rows.map((row) => sanitizeHiddenBody(row, canModerate));

  // Index por id pra resolver relações.
  const byId = new Map<string, CommentNode>();
  for (const row of sanitized) {
    byId.set(row.id, { ...row, replies: [] });
  }

  // Liga replies aos pais; top-level fica solto num array.
  const roots: CommentNode[] = [];
  for (const row of sanitized) {
    const node = byId.get(row.id)!;
    if (row.parentId && byId.has(row.parentId)) {
      byId.get(row.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Zera o `body` de um comentário oculto quando o viewer não é MOD+.
 * Exposta separada da query pra ficar testável sem mockar Prisma.
 *
 * `hiddenReason` é preservada porque o placeholder no client renderiza
 * "[comentário removido: <razão>]" — a razão é meta da moderação, não
 * conteúdo do autor.
 */
export function sanitizeHiddenBody<T extends { body: string; hiddenAt: Date | null }>(
  row: T,
  canModerate: boolean
): T {
  if (row.hiddenAt && !canModerate) {
    return { ...row, body: '' };
  }
  return row;
}

/**
 * Busca 1 comentário por id — usado por actions pra validar ownership
 * ou existência antes de mutar.
 */
export async function getCommentById(id: string) {
  return db.comment.findUnique({
    where: { id },
    select: {
      id: true,
      pageId: true,
      parentId: true,
      authorId: true,
      hiddenAt: true,
      page: { select: { id: true, slug: true, locked: true, deletedAt: true } }
    }
  });
}

/**
 * Conta comentários visíveis de uma página — usado pra mostrar "N comentários"
 * no reader antes de carregar a árvore inteira.
 */
export async function countComments(pageId: string): Promise<number> {
  return db.comment.count({ where: { pageId } });
}
