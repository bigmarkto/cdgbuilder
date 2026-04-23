'use client';

/**
 * CommentForm — textarea + submit pra criar comentários ou replies.
 *
 * Props:
 *   • pageId — FK obrigatória
 *   • parentId — se passado, vira um reply form
 *   • onDone — callback pós-sucesso (ex: fechar o form de reply)
 *   • autoFocus — pra reply forms que acabaram de abrir
 *
 * Usa useTransition pra estado pending. Ctrl/Cmd+Enter envia.
 * Limite 4000 chars com contador visual perto dos 90%.
 */

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createComment } from '@/lib/wiki/commentActions';

export interface CommentFormProps {
  pageId: string;
  parentId?: string | null;
  onDone?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}

const MAX_BODY = 4000;

export function CommentForm({
  pageId,
  parentId,
  onDone,
  autoFocus,
  compact
}: CommentFormProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = body.trim();
  const tooLong = body.length > MAX_BODY;
  const disabled = isPending || trimmed.length === 0 || tooLong;

  const submit = useCallback(() => {
    if (disabled) return;
    setErr(null);
    startTransition(async () => {
      const result = await createComment({ pageId, parentId, body: trimmed });
      if (result.ok) {
        setBody('');
        router.refresh();
        onDone?.();
      } else {
        setErr(result.error);
      }
    });
  }, [disabled, pageId, parentId, trimmed, router, onDone]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submit();
    },
    [submit]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const remaining = MAX_BODY - body.length;
  const showCounter = body.length > MAX_BODY * 0.9;

  return (
    <form onSubmit={onSubmit} className={compact ? 'space-y-2' : 'space-y-2 mb-4'}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={parentId ? 'Responder…' : 'Deixe um comentário…'}
        autoFocus={autoFocus}
        rows={compact ? 2 : 3}
        className={`w-full px-3 py-2 rounded border ${tooLong ? 'border-blood-500' : 'border-ink-600'} bg-ink-900 text-ink-50 text-sm focus:outline-none focus:border-ember-400 resize-y`}
      />
      {err && (
        <div className="text-xs text-blood-300">{err}</div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${tooLong ? 'text-blood-400' : 'text-ink-500'}`}>
          {showCounter ? `${remaining} chars restantes` : 'Ctrl+Enter envia'}
        </span>
        <div className="flex gap-2">
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="px-3 py-1 rounded border border-ink-600 text-ink-200 hover:bg-ink-800 text-xs"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={disabled}
            className="px-3 py-1 rounded bg-ember-500 text-ink-950 text-xs font-medium hover:bg-ember-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Enviando…' : parentId ? 'Responder' : 'Comentar'}
          </button>
        </div>
      </div>
    </form>
  );
}
