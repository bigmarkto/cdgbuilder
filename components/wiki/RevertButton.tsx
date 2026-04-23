'use client';

/**
 * RevertButton — dispara revertToRevision via server action.
 *
 * Fluxo:
 *   1. Usuário clica
 *   2. window.confirm pergunta de novo (rollback é destrutivo-soft: cria
 *      revisão nova, mas substitui o que o leitor vê)
 *   3. useTransition mostra estado "Restaurando…"
 *   4. Em sucesso → router.push pro reader + refresh
 *   5. Em erro → banner inline (não bloqueia a página de histórico)
 *
 * Precisa ser client porque chama server action com UX de pending. Minúsculo
 * (não carrega TipTap nem form lib).
 */

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revertToRevision } from '@/lib/wiki/pageActions';

export interface RevertButtonProps {
  pageId: string;
  revisionId: string;
  slug: string;
  /** Rótulo do botão — padrão "Restaurar esta versão". */
  label?: string;
  /** Aparência: 'primary' (ember) ou 'ghost' (link-ish). */
  variant?: 'primary' | 'ghost';
}

const VARIANT_CLASSES: Record<NonNullable<RevertButtonProps['variant']>, string> = {
  primary:
    'px-3 py-1.5 rounded bg-ember-500 text-ink-950 font-medium hover:bg-ember-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm',
  ghost:
    'text-ember-400 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed'
};

export function RevertButton({
  pageId,
  revisionId,
  slug,
  label = 'Restaurar esta versão',
  variant = 'primary'
}: RevertButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onClick = useCallback(() => {
    setErr(null);
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Tem certeza? Isso substitui o conteúdo atual da página pelo desta revisão. A revisão atual permanece no histórico.'
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await revertToRevision({ pageId, revisionId });
      if (result.ok) {
        router.push(`/wiki/c/${slug}`);
        router.refresh();
      } else {
        setErr(result.error);
      }
    });
  }, [pageId, revisionId, slug, router]);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={VARIANT_CLASSES[variant]}
      >
        {isPending ? 'Restaurando…' : label}
      </button>
      {err && (
        <span className="text-xs text-blood-300 max-w-xs text-right">{err}</span>
      )}
    </span>
  );
}
