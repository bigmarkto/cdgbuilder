/**
 * /wiki/c/search — resultado da busca full-text nas páginas community.
 *
 * Query vem via `?q=`. Server component: chama `searchCommunityPages`
 * direto (Postgres faz o trabalho pesado) e renderiza snippets com <mark>.
 *
 * Segurança dos snippets:
 *   • O `searchText` indexado é plaintext (o extractor em renderDoc já
 *     descarta toda HTML). O único HTML que o `ts_headline` devolve é o
 *     <mark>/<mark/> que injetamos via StartSel/StopSel — seguro pra
 *     `dangerouslySetInnerHTML`.
 *   • Mesmo assim, sanitizamos com um allowlist de tags mínimo (apenas
 *     <mark>) como defense-in-depth: se algum conteúdo HTML escapar pro
 *     searchText via bug futuro, o browser não executa scripts.
 */

import Link from 'next/link';
import { searchCommunityPages, type SearchHit } from '@/lib/wiki/search';
import { SearchBar } from '@/components/wiki/SearchBar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Busca — CDG Wiki',
  description: 'Procure entre as páginas community.',
  robots: { index: false }
};

const KIND_LABELS: Record<string, string> = {
  ARTICLE: 'Artigo',
  CHARACTER: 'Personagem',
  LORE: 'Lore',
  GUIDE: 'Guia',
  GLOSSARY: 'Verbete'
};

type SP = { q?: string | string[] };

export default async function SearchPage({
  searchParams
}: {
  searchParams: SP | Promise<SP>;
}) {
  // Next 14+: searchParams pode vir como Promise em alguns modos — `await`
  // é no-op com valor síncrono, seguro nos dois cenários.
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (raw ?? '').trim();

  const hits = q ? await searchCommunityPages(q, { limit: 30 }) : [];

  return (
    <div>
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/wiki" className="hover:text-ember-400">
          Wiki
        </Link>
        <span className="mx-2">/</span>
        <Link href="/wiki/c" className="hover:text-ember-400">
          Comunidade
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">Busca</span>
      </nav>

      <h1 className="font-serif text-3xl text-ink-50 mb-2">Busca</h1>
      <p className="text-ink-300 text-sm mb-4">
        Procure entre páginas community publicadas. Você pode usar aspas pra
        frases exatas (ex:{' '}
        <code className="text-ember-400">&quot;vara mística&quot;</code>),{' '}
        <code className="text-ember-400">OR</code> pra alternativas e{' '}
        <code className="text-ember-400">-termo</code> pra excluir.
      </p>

      <div className="mb-6">
        <SearchBar defaultValue={q} />
      </div>

      {q === '' ? (
        <div className="card">
          <p className="text-ink-300 text-sm">
            Digite um termo acima e aperte Enter pra ver os resultados.
          </p>
        </div>
      ) : hits.length === 0 ? (
        <div className="card">
          <p className="text-ink-200 text-sm">
            Nenhum resultado para <strong className="text-ink-50">{q}</strong>.
          </p>
          <p className="text-ink-400 text-xs mt-2">
            Tente termos mais curtos ou variações — a busca respeita acentos e
            stemming em português, mas palavras raras podem não estar indexadas.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-400 mb-3">
            {hits.length} {hits.length === 1 ? 'resultado' : 'resultados'} para{' '}
            <strong className="text-ink-200">{q}</strong>.
          </p>
          <ul className="space-y-3">
            {hits.map((hit) => (
              <SearchResult key={hit.id} hit={hit} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SearchResult({ hit }: { hit: SearchHit }) {
  const authorLabel = hit.authorHandle
    ? `@${hit.authorHandle}`
    : hit.authorName ?? 'autor anônimo';
  return (
    <li>
      <Link href={`/wiki/c/${hit.slug}`} className="card block">
        <div className="flex items-baseline justify-between gap-2">
          <span className="card-title">{hit.title}</span>
          <span className="card-meta">{KIND_LABELS[hit.kind] ?? hit.kind}</span>
        </div>
        {hit.snippet && (
          <p
            className="text-sm text-ink-200 mt-2 leading-relaxed"
            // Só <mark> vai sair do ts_headline; sanitizeMarkOnly remove qualquer
            // outra tag que tenha sobrado (defense-in-depth).
            dangerouslySetInnerHTML={{ __html: sanitizeMarkOnly(hit.snippet) }}
          />
        )}
        <p className="text-xs text-ink-400 mt-2">
          por {authorLabel}
          {' · '}
          atualizado em{' '}
          {hit.updatedAt.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short'
          })}
        </p>
      </Link>
    </li>
  );
}

/**
 * Allowlist estrito: preserva apenas <mark> e </mark>, descarta qualquer
 * outra tag. Caso o `searchText` contenha HTML por bug futuro, essa camada
 * impede XSS.
 */
function sanitizeMarkOnly(html: string): string {
  // Primeiro escape geral — vira texto puro.
  const escaped = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Reabre só as tags <mark>, que foram escapadas acima.
  return escaped
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}
