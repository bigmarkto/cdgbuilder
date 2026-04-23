/**
 * /wiki/c — index das páginas community publicadas.
 *
 * Força renderização dinâmica: o conteúdo vem do banco e muda a cada edição.
 * Na Fase 7 vamos adicionar cache com revalidação por tag ("wiki:community").
 */
import Link from 'next/link';
import { listCommunityPages, displayAuthor } from '@/lib/wiki/pageRepo';
import { getCurrentMember, hasAtLeast } from '@/lib/wiki/permissions';
import { SearchBar } from '@/components/wiki/SearchBar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Comunidade — CDG Wiki',
  description: 'Guias, lore e artigos escritos pelos jogadores.'
};

const KIND_LABELS: Record<string, string> = {
  ARTICLE: 'Artigo',
  CHARACTER: 'Personagem',
  LORE: 'Lore',
  GUIDE: 'Guia',
  GLOSSARY: 'Verbete'
};

export default async function CommunityIndex() {
  const [pages, member] = await Promise.all([
    listCommunityPages(),
    getCurrentMember()
  ]);
  const canCreate = member ? hasAtLeast(member.role, 'EDITOR') : false;

  return (
    <div>
      <nav className="text-xs text-ink-400 mb-4">
        <Link href="/wiki" className="hover:text-ember-400">
          Wiki
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-300">Comunidade</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-serif text-3xl text-ink-50">Comunidade</h1>
        {canCreate && (
          <Link
            href="/wiki/c/new"
            className="px-3 py-1.5 rounded bg-ember-500 text-ink-950 text-sm font-medium hover:bg-ember-400 whitespace-nowrap"
          >
            + Nova página
          </Link>
        )}
      </div>
      <p className="text-ink-200 mb-4">
        Páginas escritas pelos jogadores — guias, lore expandida, builds, verbetes.
        Para editar, faça login e use o botão na página. O conteúdo canônico do
        sistema continua em{' '}
        <Link href="/wiki" className="text-ember-400 hover:underline">
          seções específicas
        </Link>
        .
      </p>

      <div className="mb-6">
        <SearchBar />
      </div>

      {pages.length === 0 ? (
        <div className="card">
          <p className="text-ink-300 text-sm">
            Ainda não há páginas publicadas pela comunidade. Quando o editor estiver
            disponível (Fase 3), as primeiras contribuições vão aparecer aqui.
          </p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {pages.map((page) => (
            <li key={page.id}>
              <Link href={`/wiki/c/${page.slug}`} className="card block">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="card-title">{page.title}</span>
                  <span className="card-meta">
                    {KIND_LABELS[page.kind] ?? page.kind}
                  </span>
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  por {displayAuthor(page.author)}
                  {' · '}
                  atualizado em{' '}
                  {page.updatedAt.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short'
                  })}
                  {page.canonicalRef && (
                    <>
                      {' · '}
                      <span className="text-ember-400">
                        extende {page.canonicalRef}
                      </span>
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
