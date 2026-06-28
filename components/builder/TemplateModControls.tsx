'use client';

/**
 * TemplateModControls — destacar/ocultar template (MOD+). Inline na página do
 * template. Só renderizado quando o servidor confirma canModerate.
 */

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setTemplateFeatured, hideTemplate } from '@/lib/builder/templateActions';

export function TemplateModControls({
  id,
  featured,
  hidden
}: {
  id: string;
  featured: boolean;
  hidden: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleFeatured = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await setTemplateFeatured({ id, featured: !featured });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }, [id, featured, router]);

  const toggleHidden = useCallback(() => {
    setError(null);
    const reason = hidden ? undefined : window.prompt('Motivo de ocultar (opcional):') ?? undefined;
    startTransition(async () => {
      const res = await hideTemplate({ id, reason });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }, [id, hidden, router]);

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className="text-[10px] uppercase tracking-wider text-ink-400">mod</span>
      <button
        type="button"
        onClick={toggleFeatured}
        disabled={pending}
        className="px-2 py-0.5 rounded border border-ink-600 text-ink-200 hover:border-ember-400/60 hover:text-ember-300 disabled:opacity-50"
      >
        {featured ? 'remover destaque' : 'destacar'}
      </button>
      <button
        type="button"
        onClick={toggleHidden}
        disabled={pending}
        className="px-2 py-0.5 rounded border border-ink-600 text-ink-300 hover:text-blood-300 hover:border-blood-400/50 disabled:opacity-50"
      >
        {hidden ? 're-exibir' : 'ocultar'}
      </button>
      {error && <span className="text-blood-300">{error}</span>}
    </div>
  );
}
