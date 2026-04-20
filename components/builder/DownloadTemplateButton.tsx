'use client';

import type { DataContext } from '@/engine/context';
import { renderTemplateHtml } from '@/engine/sheet/template';

/**
 * Baixa um arquivo HTML em branco da ficha CDG — um modelo genérico que
 * pode ser reaberto depois, impresso, ou usado para importar Character JSON
 * offline (o próprio HTML contém um importador em vanilla JS).
 *
 * Diferença do DownloadSheetButton: esse exporta a ficha do personagem
 * atual com derivados calculados; este emite um esqueleto em branco.
 */
export function DownloadTemplateButton({ ctx }: { ctx: DataContext }) {
  function handleDownload() {
    const html = renderTemplateHtml(ctx);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'cdg-ficha-modelo.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="px-3 py-1.5 rounded border border-ink-500 text-ink-200 hover:text-ember-400 text-sm"
      title="Baixa um HTML genérico em branco que aceita Character JSON via import."
    >
      Baixar modelo (em branco)
    </button>
  );
}
