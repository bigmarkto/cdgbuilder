'use client';

import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';
import { renderSheetHtml } from '@/engine/sheet/render';

/**
 * Botão que gera um arquivo .html portátil da ficha e dispara download.
 * Pura manipulação de Blob — não precisa de server action.
 */
export function DownloadSheetButton({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);

  function handleDownload() {
    const html = renderSheetHtml(ctx, character, {
      title: character.name ? `Ficha — ${character.name}` : 'Ficha CDG'
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeName = (character.name || 'ficha-cdg')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const fileName = `${safeName || 'ficha-cdg'}.html`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="px-3 py-1.5 rounded border border-ember-400/60 text-ember-400 hover:bg-ember-400/10"
      title="Baixa um arquivo HTML portátil da ficha, estilizado CDG."
    >
      Baixar ficha HTML
    </button>
  );
}
