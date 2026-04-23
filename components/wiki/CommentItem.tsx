'use client';

/**
 * CommentItem — nó da árvore de comentários com UI interativa:
 *   • Botão "responder" abre um CommentForm inline
 *   • Menu de ações (... ) com "excluir" (autor/MOD+) e "esconder"/"mostrar" (MOD+)
 *   • Replies renderizados recursivamente (componente se autorreferencia)
 *
 * Client component porque precisa de estado de UI (form aberto) e useTransition
 * pra actions. Recebe `currentUserId` + `canModerate` da árvore pai —
 * a árvore (server component) é quem consulta o member atual.
 *
 * hiddenAt !== null com canModerate=false → mostra placeholder ("[removido]")
 * em vez do body. Replies continuam visíveis.
 *
 * Optimistic UI:
 *   Usuários em regiões longe do Supabase viam ~600ms de botão travado por
 *   clique (round-trip + revalidatePath + re-fetch da árvore). Agora a UI
 *   flipa instantaneamente via estado local; a action roda em background,
 *   e se falha reverte + mostra erro. Na próxima navegação o server rehidrata
 *   com a verdade canônica.
 */

import { useCallback, useState, useTransition } from 'react';
import type { CommentNode } from '@/lib/wiki/commentRepo';
import { deleteComment, toggleHideComment } from '@/lib/wiki/commentActions';
import { CommentForm } from './CommentForm';

export interface CommentItemProps {
  comment: CommentNode;
  pageId: string;
  currentUserId: string | null;
  canModerate: boolean;
  /** Profundidade (0 = top-level). Limita reply UI em níveis profundos. */
  depth: number;
}

const MAX_REPLY_DEPTH = 4; // após isso, "responder" responde ao pai mais próximo

function displayAuthor(author: { handle: string | null; name: string | null }) {
  if (author.handle) return `@${author.handle}`;
  if (author.name) return author.name;
  return 'anônimo';
}

function formatDate(d: Date) {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function CommentItem({
  comment,
  pageId,
  currentUserId,
  canModerate,
  depth
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionErr, setActionErr] = useState<string | null>(null);

  // Estado local optimista — flipa instantaneamente no clique, revert em caso
  // de falha. Não precisa de router.refresh(): o estado local já reflete o
  // resultado esperado e a próxima navegação rehidrata do servidor.
  const [localHidden, setLocalHidden] = useState(comment.hiddenAt !== null);
  const [localDeleted, setLocalDeleted] = useState(false);

  const isOwner = currentUserId !== null && comment.author.id === currentUserId;
  const canDelete = isOwner || canModerate;

  const onDelete = useCallback(() => {
    if (typeof window !== 'undefined' && !window.confirm('Excluir este comentário? As respostas também serão excluídas.')) return;
    setActionErr(null);
    setLocalDeleted(true); // optimistic: some da UI na hora
    startTransition(async () => {
      const result = await deleteComment({ commentId: comment.id });
      if (!result.ok) {
        setLocalDeleted(false); // revert
        setActionErr(result.error);
      }
    });
  }, [comment.id]);

  const onToggleHide = useCallback(() => {
    setActionErr(null);
    const prev = localHidden;
    setLocalHidden(!prev); // optimistic: flipa label + badge na hora
    startTransition(async () => {
      const result = await toggleHideComment({ commentId: comment.id });
      if (!result.ok) {
        setLocalHidden(prev); // revert
        setActionErr(result.error);
      }
    });
  }, [comment.id, localHidden]);

  // Se o nó foi deletado optimisticamente, some da árvore (os replies vão
  // junto — o cascata do DB vai honrar isso assim que a action terminar).
  if (localDeleted) return null;

  // Se profundo demais, o reply vai pro pai (inverte parentId pra parentId do pai).
  const replyTargetParentId =
    depth >= MAX_REPLY_DEPTH ? comment.parentId : comment.id;

  const isHidden = localHidden;
  const showBody = !isHidden || canModerate;

  return (
    <li className="py-2">
      <div
        className={`group ${isHidden ? 'opacity-60' : ''}`}
      >
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span>
            <span className="text-ink-200 font-medium">{displayAuthor(comment.author)}</span>
            <span className="text-ink-500"> · {formatDate(comment.createdAt)}</span>
            {comment.updatedAt.getTime() !== comment.createdAt.getTime() && (
              <span className="text-ink-500 italic"> (editado)</span>
            )}
          </span>
          {isHidden && (
            <span className="text-[10px] uppercase tracking-wider text-blood-400">
              oculto
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-ink-100 whitespace-pre-wrap break-words">
          {showBody ? (
            comment.body
          ) : (
            <em className="text-ink-400">
              [comentário removido pela moderação
              {comment.hiddenReason ? `: ${comment.hiddenReason}` : ''}]
            </em>
          )}
        </div>

        <div className="mt-1 flex items-center gap-3 text-xs">
          {currentUserId && !isHidden && (
            <button
              type="button"
              onClick={() => setIsReplying((v) => !v)}
              className="text-ember-400 hover:underline"
            >
              {isReplying ? 'cancelar' : 'responder'}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="text-ink-400 hover:text-blood-300 disabled:opacity-50"
            >
              excluir
            </button>
          )}
          {canModerate && (
            <button
              type="button"
              onClick={onToggleHide}
              disabled={isPending}
              className="text-ink-400 hover:text-ember-400 disabled:opacity-50"
            >
              {isHidden ? 'mostrar' : 'esconder'}
            </button>
          )}
        </div>

        {actionErr && (
          <p className="mt-1 text-xs text-blood-300">{actionErr}</p>
        )}

        {isReplying && (
          <div className="mt-3 pl-3 border-l-2 border-ink-700">
            <CommentForm
              pageId={pageId}
              parentId={replyTargetParentId}
              onDone={() => setIsReplying(false)}
              autoFocus
              compact
            />
          </div>
        )}
      </div>

      {comment.replies.length > 0 && (
        <ul className="mt-2 pl-4 border-l border-ink-800 space-y-1">
          {comment.replies.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              pageId={pageId}
              currentUserId={currentUserId}
              canModerate={canModerate}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
