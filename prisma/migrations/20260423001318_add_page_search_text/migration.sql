-- Fase 7: busca full-text em páginas community.
--
-- Adiciona coluna textual `searchText` e um índice GIN usando tsvector
-- em português. A coluna é mantida em nível de aplicação (ver pageActions.ts)
-- pra não depender de trigger SQL — o Postgres só lê o tsvector em query time
-- via expression index.

ALTER TABLE "Page" ADD COLUMN "searchText" TEXT;

-- Índice GIN sobre a tsvector calculada em query time.
-- O dicionário 'portuguese' vem built-in no Postgres e trata acentos
-- (agouro == Agouro) e stemming básico (correndo → correr).
CREATE INDEX "Page_searchText_tsv_idx"
  ON "Page"
  USING GIN (to_tsvector('portuguese', COALESCE("searchText", '')));
