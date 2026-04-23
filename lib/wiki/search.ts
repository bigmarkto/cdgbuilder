/**
 * Search — busca full-text nas páginas community.
 *
 * Arquitetura:
 *   • `Page.searchText` é mantido pela aplicação (concat de título + extrato
 *     plaintext do body atual). Atualizado dentro da mesma transaction em
 *     create/update/revert — ver pageActions.ts.
 *   • Indexação acontece no lado do Postgres via índice GIN sobre
 *     `to_tsvector('portuguese', searchText)`. Dicionário português trata
 *     acentos + stemming básico.
 *   • Query usa `websearch_to_tsquery` que aceita sintaxe natural (aspas,
 *     OR, exclusão com `-`). Ranking via `ts_rank_cd`.
 *   • Snippet com `ts_headline` que envolve termos com <mark>.
 *
 * Por que não Prisma full-text nativo (@@fulltext):
 *   • Suportado só em MySQL/MongoDB no Prisma 6. Pra Postgres seguimos com
 *     $queryRaw — temos controle total sobre o dicionário e o parser.
 *
 * Performance:
 *   • GIN index é O(log n) pra lookup; a query grande são os matches.
 *     Limitamos a 50 resultados por página.
 *   • Sanitização: todos os valores user-controlled passam por template-tag
 *     $queryRaw de Prisma (SQL-injection proof) ou via Prisma.sql.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { extractPlaintext } from './renderDoc';

// ---------------------------------------------------------------------------
// Texto indexável — concat de title + plaintext do body
// ---------------------------------------------------------------------------

/**
 * Monta a string que vai alimentar o índice full-text.
 * Inclui title prepended (peso natural alto: aparece primeiro no texto e
 * palavras no início ficam mais próximas no tsvector → ts_rank mais alto).
 */
export function buildSearchText(
  title: string,
  body: unknown,
  opts: { bodyMaxChars?: number } = {}
): string {
  const bodyMaxChars = opts.bodyMaxChars ?? 4000;
  const cleanTitle = title.trim();
  const cleanBody = extractPlaintext(body, bodyMaxChars).trim();
  // Separador com pontuação pra não colar title + body em uma única palavra.
  return cleanBody ? `${cleanTitle}. ${cleanBody}` : cleanTitle;
}

// ---------------------------------------------------------------------------
// Search query
// ---------------------------------------------------------------------------

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  /** Kind (ARTICLE, GUIDE, etc.) — string pra não importar enum cross-module. */
  kind: string;
  /** HTML-safe com <mark> ao redor de termos match. Pode ser null se ts_headline falha. */
  snippet: string | null;
  /** Rank do Postgres — maior = mais relevante. Informativo. */
  rank: number;
  /** Autor do conteúdo atual (current revision). */
  authorHandle: string | null;
  authorName: string | null;
  updatedAt: Date;
}

/**
 * Busca páginas community pelo termo. Retorna até `limit` hits ordenados
 * por relevância.
 *
 * A query respeita:
 *   • `deletedAt IS NULL` (não mostra páginas excluídas)
 *   • `currentRevisionId IS NOT NULL` (não mostra rascunhos puros)
 *   • `searchText IS NOT NULL` (páginas antigas sem backfill não aparecem)
 *
 * Se `query` for vazia/whitespace, retorna array vazio — nunca devolve todos.
 */
export async function searchCommunityPages(
  query: string,
  opts: { limit?: number } = {}
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));

  // websearch_to_tsquery aceita sintaxe tipo Google (aspas, OR, -termo).
  // Se o usuário digita algo que não gera nenhum termo válido, retorna 0 hits.
  // Usamos Prisma.sql pra compor de forma segura e $queryRaw pra executar.
  const rows = await db.$queryRaw<RawHit[]>(Prisma.sql`
    WITH q AS (
      SELECT websearch_to_tsquery('portuguese', ${q}) AS tsq
    )
    SELECT
      p."id",
      p."slug",
      p."title",
      p."kind"::text AS "kind",
      p."updatedAt",
      u."handle" AS "authorHandle",
      u."name"   AS "authorName",
      ts_rank_cd(to_tsvector('portuguese', COALESCE(p."searchText", '')), q.tsq) AS "rank",
      ts_headline(
        'portuguese',
        COALESCE(p."searchText", ''),
        q.tsq,
        'StartSel=<mark>,StopSel=</mark>,MaxWords=25,MinWords=10,ShortWord=2,HighlightAll=false,MaxFragments=2,FragmentDelimiter=" … "'
      ) AS "snippet"
    FROM "Page" p
    CROSS JOIN q
    LEFT JOIN "Revision" r ON r."id" = p."currentRevisionId"
    LEFT JOIN "User" u     ON u."id" = r."authorId"
    WHERE p."deletedAt" IS NULL
      AND p."currentRevisionId" IS NOT NULL
      AND p."searchText" IS NOT NULL
      AND to_tsvector('portuguese', COALESCE(p."searchText", '')) @@ q.tsq
    ORDER BY "rank" DESC, p."updatedAt" DESC
    LIMIT ${limit}
  `);

  // Prisma devolve DECIMAL (rank) como Prisma.Decimal ou string dependendo
  // do driver. Normalizamos pra number.
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    snippet: r.snippet ?? null,
    rank: typeof r.rank === 'number' ? r.rank : Number(r.rank ?? 0),
    authorHandle: r.authorHandle,
    authorName: r.authorName,
    updatedAt: r.updatedAt
  }));
}

interface RawHit {
  id: string;
  slug: string;
  title: string;
  kind: string;
  updatedAt: Date;
  authorHandle: string | null;
  authorName: string | null;
  rank: number | string | null;
  snippet: string | null;
}
