'use client';

/**
 * RevisionModButton — botão inline pra esconder/re-exibir revisão (MOD+).
 *
 * Uso: dentro da view da revisão (/wiki/c/:slug/history/:revisionId).
 * Pede motivo via prompt ao esconder. Unhide não precisa.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { hideRevision, unhideRevision } from '@/lib/wiki/moderationActions';

export interface RevisionModButtonProps {
  revisionId: string;
  hidden: boolean;
}

export function RevisionModButton({ revisionId, hidden }: RevisionModButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onHide = () => {
    const reason = window.prompt('Motivo da ocultação (opcional):', '');
    if (reason === null) return;
    setErr(null);
    startTransition(async () => {
      const result = await hideRevision({ revisionId, reason: reason || undefined });
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });
  };

  const onUnhide = () => {
    if (!window.confirm('Re-exibir essa revisão?')) return;
    setErr(null);
    startTransition(async () => {
      const result = await unhideRevision({ revisionId });
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      {hidden ? (
        <button
          type="button"
          onClick={onUnhide}
          disabled={isPending}
          className="text-xs text-ember-400 hover:underline disabled:opacity-50"
        >
          re-exibir revisão
        </button>
      ) : (
        <button
          type="button"
          onClick={onHide}
          disabled={isPending}
          className="text-xs text-blood-300 hover:text-blood-200 hover:underline disabled:opacity-50"
        >
          ocultar revisão
        </button>
      )}
      {err && <span className="text-xs text-blood-400">{err}</span>}
    </span>
  );
}
