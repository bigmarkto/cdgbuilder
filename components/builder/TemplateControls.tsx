'use client';

/**
 * TemplateControls — publica a ficha ativa como template na biblioteca (2.2).
 *
 * Diferente do ShareControls (link vivo), template é um snapshot estável: o
 * autor publica uma vez (com resumo + tags) e re-publica manualmente quando
 * quiser atualizar. Outros jogadores usam como ponto de partida.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useBuilderStore } from '@/lib/store';
import {
  publishTemplate,
  unpublishTemplate,
  templateStatus
} from '@/lib/builder/templateActions';

type Status = 'loading' | 'anon' | 'idle' | 'published';

export function TemplateControls() {
  const character = useBuilderStore((s) => s.character);
  const localId = character.id;

  const [status, setStatus] = useState<Status>('loading');
  const [slug, setSlug] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    templateStatus({ localId }).then((res) => {
      if (cancelled) return;
      if (!res.ok || !res.loggedIn) setStatus('anon');
      else if (res.published) {
        setStatus('published');
        setSlug(res.slug);
      } else {
        setStatus('idle');
        setSlug(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [localId]);

  const doPublish = useCallback(() => {
    setError(null);
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await publishTemplate({
        localId,
        character: JSON.parse(JSON.stringify(character)),
        summary,
        tags
      });
      if (res.ok) {
        setStatus('published');
        setSlug(res.slug);
      } else {
        setError(res.error);
      }
    });
  }, [localId, character, summary, tagsRaw]);

  const doUnpublish = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await unpublishTemplate({ localId });
      if (res.ok) {
        setStatus('idle');
        setSlug(null);
      } else {
        setError(res.error);
      }
    });
  }, [localId]);

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 p-3 text-sm space-y-2 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Biblioteca</p>
          <p className="font-serif text-base text-ink-50">
            {status === 'published' ? 'Publicado como template' : 'Template'}
          </p>
        </div>
        {status === 'published' && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={doPublish}
              disabled={pending}
              className="px-2 py-1 text-[11px] rounded border border-ink-600 text-ink-200 hover:border-ember-400/60 hover:text-ember-300 disabled:opacity-50"
              title="Re-publica o estado atual da ficha"
            >
              atualizar
            </button>
            <button
              type="button"
              onClick={doUnpublish}
              disabled={pending}
              className="px-2 py-1 text-[11px] rounded border border-ink-600 text-ink-300 hover:text-blood-300 hover:border-blood-400/50 disabled:opacity-50"
            >
              despublicar
            </button>
          </div>
        )}
      </div>

      {status === 'loading' && <p className="text-xs text-ink-400">Carregando…</p>}

      {status === 'anon' && (
        <p className="text-xs text-ink-300">
          <Link href="/login" className="text-ember-400 hover:underline">
            Entre
          </Link>{' '}
          para publicar essa build como template na{' '}
          <Link href="/templates" className="text-ember-400 hover:underline">
            biblioteca
          </Link>
          .
        </p>
      )}

      {status === 'idle' && (
        <div className="space-y-1.5">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Resumo: pra que serve essa build, contra o quê é boa… (opcional)"
            rows={2}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 placeholder:text-ink-500 resize-none"
          />
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="tags separadas por vírgula (ex: melee, fogo, iniciante)"
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 placeholder:text-ink-500"
          />
          <button
            type="button"
            onClick={doPublish}
            disabled={pending}
            className="px-2.5 py-1 text-[11px] rounded border border-ember-400/60 text-ember-300 hover:bg-ember-400/10 disabled:opacity-50"
          >
            Publicar como template
          </button>
        </div>
      )}

      {status === 'published' && slug && (
        <p className="text-xs text-ink-300">
          Disponível em{' '}
          <Link href={`/templates/${slug}`} className="text-ember-400 hover:underline">
            /templates/{slug.slice(0, 8)}…
          </Link>{' '}
          — outros jogadores podem começar a partir dele.
        </p>
      )}

      {error && <p className="text-xs text-blood-300">{error}</p>}
    </section>
  );
}
