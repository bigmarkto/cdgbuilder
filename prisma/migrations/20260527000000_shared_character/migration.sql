-- Categoria 2 — features de site: fichas compartilhadas + biblioteca de templates.
--
-- Tabela SharedCharacter: ponte entre o builder (localStorage) e o banco.
-- Guarda o JSON completo do Character pra links vivos (SHARE) e templates
-- públicos (TEMPLATE). Campos denormalizados (name/raceId/level) servem
-- listagens e as estatísticas agregadas anonimizadas.

-- CreateEnum
CREATE TYPE "SharedKind" AS ENUM ('SHARE', 'TEMPLATE');

-- CreateTable
CREATE TABLE "SharedCharacter" (
    "id" TEXT NOT NULL,
    "kind" "SharedKind" NOT NULL DEFAULT 'SHARE',
    "authorId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raceId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "concept" TEXT,
    "data" JSONB NOT NULL,
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedCharacter_authorId_localId_kind_key" ON "SharedCharacter"("authorId", "localId", "kind");

-- CreateIndex
CREATE INDEX "SharedCharacter_kind_featured_updatedAt_idx" ON "SharedCharacter"("kind", "featured", "updatedAt");

-- CreateIndex
CREATE INDEX "SharedCharacter_authorId_idx" ON "SharedCharacter"("authorId");

-- CreateIndex
CREATE INDEX "SharedCharacter_raceId_idx" ON "SharedCharacter"("raceId");

-- AddForeignKey
ALTER TABLE "SharedCharacter" ADD CONSTRAINT "SharedCharacter_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Segurança: RLS habilitado (consistente com a migração 20260512000000_enable_rls).
-- Todo acesso de dados passa por Prisma (role postgres, BYPASSRLS); o PostgREST
-- anon/authenticated não enxerga nada.
ALTER TABLE "SharedCharacter" ENABLE ROW LEVEL SECURITY;
