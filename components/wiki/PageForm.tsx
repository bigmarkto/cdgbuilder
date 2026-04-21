'use client';

/**
 * PageForm — orquestra metadata (title/slug/kind/canonicalRef/summary) +
 * o editor TipTap. Client component porque o editor é client.
 *
 * Modos:
 *   mode='create' — pede slug, chama createPage server action
 *   mode='edit'   — slug trancado (não renomeia nessa fase), chama updatePage
 *
 * Auto-slug: em 'create', enquanto o usuário não toca o campo de slug, o
 * valor é derivado do título via slugify(). Primeira edição manual trava.
 *
 * Submit: desabilita botão, aguarda action, redireciona em sucesso ou
 * mostra erro. Erros de campo destacam o input respectivo.
 */

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PageKind } from '@prisma/client';
import { PageEditor } from './PageEditor';
import { slugify } from '@/lib/wiki/slug';
import { createPage, updatePage, type ActionResult } from '@/lib/wiki/pageActions';
import type { DocNode } from '@/lib/wiki/doc';

export interface PageFormProps {
  mode: 'create' | 'edit';
  initial?: {
    pageId?: string;
    title: string;
    slug: string;
    kind: PageKind;
    canonicalRef: string | null;
    body: DocNode | null;
  };
}

const KINDS: { value: PageKind; label: string; hint: string }[] = [
  { value: 'ARTICLE', label: 'Artigo', hint: 'Texto livre — o default.' },
  { value: 'GUIDE', label: 'Guia', hint: 'Tutoriais, builds, dicas de mesa.' },
  { value: 'LORE', label: 'Lore', hint: 'Ambientação, capítulos narrativos.' },
  { value: 'GLOSSARY', label: 'Verbete', hint: 'Definições curtas.' },
  { value: 'CHARACTER', label: 'Personagem', hint: 'Exemplos jogáveis.' }
];

export function PageForm({ mode, initial }: PageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [kind, setKind] = useState<PageKind>(initial?.kind ?? 'ARTICLE');
  const [canonicalRef, setCanonicalRef] = useState(initial?.canonicalRef ?? '');
  const [summary, setSummary] = useState('');
  const bodyRef = useRef<DocNode>(
    initial?.body ?? { type: 'doc', content: [{ type: 'paragraph' }] }
  );

  const [errField, setErrField] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const autoSlug = useMemo(() => slugify(title), [title]);
  const effectiveSlug = slugTouched || mode === 'edit' ? slug : autoSlug;

  const handleEditorChange = useCallback((doc: DocNode) => {
    bodyRef.current = doc;
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setErrField(null);
      setErrMsg(null);

      startTransition(async () => {
        let result: ActionResult;
        if (mode === 'create') {
          result = await createPage({
            title,
            slug: effectiveSlug,
            kind,
            canonicalRef: canonicalRef.trim() || null,
            body: bodyRef.current,
            summary
          });
        } else {
          if (!initial?.pageId) {
            setErrMsg('Estado interno inválido — página sem id.');
            return;
          }
          result = await updatePage({
            pageId: initial.pageId,
            title,
            kind,
            canonicalRef: canonicalRef.trim() || null,
            body: bodyRef.current,
            summary
          });
        }

        if (result.ok) {
          router.push(`/wiki/c/${result.slug}`);
          router.refresh();
        } else {
          setErrField(result.field ?? null);
          setErrMsg(result.error);
        }
      });
    },
    [mode, title, effectiveSlug, kind, canonicalRef, summary, initial?.pageId, router]
  );

  const fieldErr = (name: string) => (errField === name ? 'border-blood-500' : 'border-ink-600');

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {errMsg && (
        <div className="px-3 py-2 rounded border border-blood-500 bg-blood-500/10 text-blood-200 text-sm">
          {errMsg}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm text-ink-200 mb-1">
          Título
        </label>
        <input
          id="title"
          type="text"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full px-3 py-2 rounded border ${fieldErr('title')} bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400`}
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm text-ink-200 mb-1">
          Slug (URL)
          {mode === 'edit' && (
            <span className="ml-2 text-xs text-ink-500">
              (trancado em edições — rollback via histórico)
            </span>
          )}
        </label>
        <div className="flex">
          <span className="px-3 py-2 rounded-l border border-r-0 border-ink-600 bg-ink-800 text-ink-400 text-sm whitespace-nowrap">
            /wiki/c/
          </span>
          <input
            id="slug"
            type="text"
            required
            maxLength={80}
            disabled={mode === 'edit'}
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder={autoSlug || 'meu-artigo'}
            className={`flex-1 px-3 py-2 rounded-r border ${fieldErr('slug')} bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400 disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
        {mode === 'create' && !slugTouched && title && (
          <p className="text-xs text-ink-500 mt-1">
            Slug gerado automaticamente do título — edite para fixar.
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="kind" className="block text-sm text-ink-200 mb-1">
            Tipo
          </label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as PageKind)}
            className={`w-full px-3 py-2 rounded border ${fieldErr('kind')} bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400`}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-500 mt-1">
            {KINDS.find((k) => k.value === kind)?.hint}
          </p>
        </div>

        <div>
          <label htmlFor="canonicalRef" className="block text-sm text-ink-200 mb-1">
            Referência canônica (opcional)
          </label>
          <input
            id="canonicalRef"
            type="text"
            value={canonicalRef}
            onChange={(e) => setCanonicalRef(e.target.value)}
            placeholder="ex: races/agouro"
            className={`w-full px-3 py-2 rounded border ${fieldErr('canonicalRef')} bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400 font-mono text-sm`}
          />
          <p className="text-xs text-ink-500 mt-1">
            Se preencher, a página aparece como &ldquo;Notas da comunidade&rdquo; na página
            canônica correspondente.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm text-ink-200 mb-1">Conteúdo</label>
        <PageEditor initialContent={bodyRef.current} onChange={handleEditorChange} />
        <p className="text-xs text-ink-500 mt-1">
          Use <code className="px-1 bg-ink-800 rounded">[[slug]]</code> ou{' '}
          <code className="px-1 bg-ink-800 rounded">[[races/agouro|Agouros]]</code> pra criar
          links wiki.
        </p>
      </div>

      <div>
        <label htmlFor="summary" className="block text-sm text-ink-200 mb-1">
          Resumo da {mode === 'edit' ? 'edição' : 'criação'} (opcional)
        </label>
        <input
          id="summary"
          type="text"
          maxLength={200}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={mode === 'edit' ? 'ex: corrigi typo, adicionei exemplo…' : 'ex: primeira versão'}
          className="w-full px-3 py-2 rounded border border-ink-600 bg-ink-900 text-ink-50 focus:outline-none focus:border-ember-400 text-sm"
        />
        <p className="text-xs text-ink-500 mt-1">
          Aparece no histórico para ajudar outros editores a entender a mudança.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-ink-700">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded border border-ink-600 text-ink-200 hover:bg-ink-800 text-sm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !title || !effectiveSlug}
          className="px-4 py-2 rounded bg-ember-500 text-ink-950 font-medium hover:bg-ember-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isPending ? 'Salvando…' : mode === 'create' ? 'Criar página' : 'Salvar edição'}
        </button>
      </div>
    </form>
  );
}
