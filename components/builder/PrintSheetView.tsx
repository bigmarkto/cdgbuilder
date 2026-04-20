'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { DataContext } from '@/engine/context';
import { renderSheetHtml } from '@/engine/sheet/render';
import { useBuilderStore } from '@/lib/store';

/**
 * Preview isolado da ficha HTML gerada pelo engine. Renderiza dentro de um
 * <iframe srcDoc> para não contaminar o layout do app com o CSS embutido.
 * Serve como auditoria visual antes de baixar, e também como modelo para
 * imprimir/salvar PDF no próprio navegador (o iframe inclui @media print).
 */
export function PrintSheetView({ ctx }: { ctx: DataContext }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const character = useBuilderStore((s) => s.character);
  const html = useMemo(
    () =>
      hydrated
        ? renderSheetHtml(ctx, character, {
            title: character.name ? `Ficha — ${character.name}` : 'Ficha CDG'
          })
        : '',
    [hydrated, ctx, character]
  );

  function handleDownload() {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeName = (character.name || 'ficha-cdg')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName || 'ficha-cdg'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!hydrated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-ink-300">
        Carregando preview…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-3 gap-2">
        <Link href="/builder/sheet" className="text-sm text-ink-200 hover:text-ember-400">
          ← Voltar à ficha
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded border border-ember-400/60 text-ember-400 hover:bg-ember-400/10"
          >
            Baixar HTML
          </button>
        </div>
      </div>
      <iframe
        title="Preview da ficha CDG (HTML)"
        srcDoc={html}
        className="w-full border border-ink-500 rounded bg-ink-900"
        style={{ height: '85vh' }}
      />
    </div>
  );
}
