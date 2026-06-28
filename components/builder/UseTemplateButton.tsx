'use client';

/**
 * UseTemplateButton — "começar a partir de" um template (2.2).
 *
 * Importa o JSON do template como uma NOVA ficha no roster local (id fresco,
 * via store.importJson) e leva pro builder. Não toca o template original nem
 * a ficha ativa anterior.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBuilderStore } from '@/lib/store';

export function UseTemplateButton({ data }: { data: unknown }) {
  const router = useRouter();
  const importJson = useBuilderStore((s) => s.importJson);
  const [error, setError] = useState<string | null>(null);

  const onUse = useCallback(() => {
    setError(null);
    const res = importJson(JSON.stringify(data));
    if (!res.ok) {
      setError(res.error ?? 'Falha ao importar template.');
      return;
    }
    router.push('/builder');
  }, [data, importJson, router]);

  return (
    <div>
      <button
        type="button"
        onClick={onUse}
        className="inline-block px-4 py-2 rounded bg-ember-500 text-ink-950 text-sm font-medium hover:bg-ember-400"
      >
        Começar a partir deste template →
      </button>
      {error && <p className="mt-1 text-xs text-blood-300">{error}</p>}
    </div>
  );
}
