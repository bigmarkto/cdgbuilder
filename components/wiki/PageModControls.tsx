'use client';

/**
 * PageModControls — botões inline de moderação/admin no cabeçalho da página.
 *
 * Props:
 *   • role do caller: 'MODERATOR' | 'ADMIN' — define quais botões aparecem.
 *   • locked atual da página (pra alternar label lock/unlock)
 *
 * Ações:
 *   • Trancar / Destrancar (MOD+)
 *   • Excluir (ADMIN apenas) — soft delete
 *
 * Todas pedem confirm e coletam motivo via prompt (exceto unlock que não
 * requer razão). Após sucesso, router.refresh() pra buscar o novo estado.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { lockPage, unlockPage, softDeletePage } from '@/lib/wiki/moderationActions';

export interface PageModControlsProps {
  pageId: string;
  slug: string;
  locked: boolean;
  lockedReason: string | null;
  canAdmin: boolean; // true → também mostra Excluir
}

export function PageModControls({
  pageId,
  slug,
  locked,
  lockedReason,
  canAdmin
}: PageModControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onLock = () => {
    const reason = window.prompt('Motivo do trancamento (opcional):', '');
    if (reason === null) return;
    setErr(null);
    startTransition(async () => {
      const result = await lockPage({ pageId, reason: reason || undefined });
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });
  };

  const onUnlock = () => {
    if (!window.confirm('Destrancar essa página?')) return;
    setErr(null);
    startTransition(async () => {
      const result = await unlockPage({ pageId });
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });
  };

  const onDelete = () => {
    const reason = window.prompt(
      `Motivo da exclusão de "${slug}"? (opcional — aparece no audit log)`,
      ''
    );
    if (reason === null) return;
    if (!window.confirm(`EXCLUIR a página "${slug}"? Ela some da listagem (soft delete; pode ser restaurada depois).`)) return;
    setErr(null);
    startTransition(async () => {
      const result = await softDeletePage({ pageId, reason: reason || undefined });
      if (!result.ok) setErr(result.error);
      else {
        // Sumiu: manda pra index, não faz sentido ficar na página que não existe mais.
        router.replace('/wiki/c');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {locked ? (
        <button
          type="button"
          onClick={onUnlock}
          disabled={isPending}
          title={lockedReason ? `Motivo do lock: ${lockedReason}` : undefined}
          className="text-ember-400 hover:underline disabled:opacity-50"
        >
          destrancar
        </button>
      ) : (
        <button
          type="button"
          onClick={onLock}
          disabled={isPending}
          className="text-ember-400 hover:underline disabled:opacity-50"
        >
          trancar
        </button>
      )}

      {canAdmin && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="text-blood-300 hover:text-blood-200 hover:underline disabled:opacity-50"
        >
          excluir página
        </button>
      )}

      {err && <span className="text-blood-400">{err}</span>}
    </div>
  );
}
