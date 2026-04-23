/**
 * CommentThread — server component que carrega os comentários de uma página
 * e delega a renderização interativa ao CommentItem (client).
 *
 * Fica no fim de /wiki/c/[slug]. Se o usuário não estiver logado, mostra
 * os comentários e um CTA pra entrar. Se estiver logado, mostra o form no
 * topo. Ações finas (excluir/esconder/responder) são controladas pelo
 * CommentItem por nó.
 */
import Link from 'next/link';
import { listCommentTree } from '@/lib/wiki/commentRepo';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

export interface CommentThreadProps {
  pageId: string;
  pageSlug: string;
}

export async function CommentThread({ pageId, pageSlug }: CommentThreadProps) {
  const [comments, member] = await Promise.all([
    listCommentTree(pageId),
    getCurrentMember()
  ]);

  const canModerate = member ? hasAtLeast(member.role, 'MODERATOR') : false;

  return (
    <section className="mt-10 pt-6 border-t border-ink-700">
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-ink-50">
          Comentários{' '}
          <span className="text-sm text-ink-400 font-sans">
            ({comments.length + countNested(comments)})
          </span>
        </h2>
      </header>

      {member ? (
        <CommentForm pageId={pageId} />
      ) : (
        <div className="card mb-4 text-sm text-ink-300">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/wiki/c/${pageSlug}`)}`}
            className="text-ember-400 hover:underline"
          >
            Entre
          </Link>{' '}
          para comentar.
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-ink-400 italic">
          Nenhum comentário ainda. Seja o primeiro.
        </p>
      ) : (
        <ul className="divide-y divide-ink-800">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              pageId={pageId}
              currentUserId={member?.id ?? null}
              canModerate={canModerate}
              depth={0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Conta recursivamente replies aninhados pra mostrar total no header.
 */
function countNested(nodes: { replies: unknown[] }[]): number {
  let count = 0;
  for (const node of nodes) {
    const replies = (node as { replies: { replies: unknown[] }[] }).replies;
    count += replies.length + countNested(replies as { replies: unknown[] }[]);
  }
  return count;
}
