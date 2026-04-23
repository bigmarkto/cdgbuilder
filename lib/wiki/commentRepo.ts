/**
 * commentRepo — queries Prisma para comentários de páginas community.
 *
 * Estratégia de carregamento:
 *   • Busca todos os comentários visíveis da página numa query só (uma FK)
 *     e monta a árvore em memória. É muito mais barato que N queries de
 *     replies e o volume esperado por página é baixo (dezenas, não milhares).
 *   • Comentários `hiddenAt != null` são retornados mesmo assim, mas sem
 *     body — o cliente pode mostrar um placeholder ("[removido pela mod]").
 *     Mantêm o nó pra não quebrar a árvore de replies.
 *
 * Regras de visibilidade:
 *   • `hiddenAt != null` + não-MOD → body escondido ("[removido]"); filhos
 *     continuam visíveis normalmente
 *   • MOD+ vê body original com badge "oculto" pra poder desfazer
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

/**
 * Carrega todos os comentários de uma página e monta a árvore.
 * Ordena top-level por createdAt asc (mais antigos primeiro — conversa
 * lê como fio), replies também asc dentro de cada thread.
 */
export async function listCommentTree(pageId: string): Promise<CommentNode[]> {
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

  // Index por id pra resolver relações.
  const byId = new Map<string, CommentNode>();
  for (const row of rows) {
    byId.set(row.id, { ...row, replies: [] });
  }

  // Liga replies aos pais; top-level fica solto num array.
  const roots: CommentNode[] = [];
  for (const row of rows) {
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
