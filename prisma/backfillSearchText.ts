/**
 * Backfill — popula `Page.searchText` pra páginas que já existiam antes
 * da Fase 7.
 *
 * Uso:
 *   npx tsx prisma/backfillSearchText.ts
 *   npx tsx prisma/backfillSearchText.ts --force   # recomputa tudo (ignora existente)
 *   npx tsx prisma/backfillSearchText.ts --dry     # só imprime o que faria
 *
 * Estratégia:
 *   • Varre `Page` em lotes de 50, ordenados por id.
 *   • Pra cada página: carrega currentRevision.body, extrai plaintext,
 *     monta searchText = "title. plaintext_body" e grava.
 *   • Pula páginas sem currentRevision (draft puro) ou deletedAt (mantém
 *     searchText NULL — elas não aparecem em busca).
 *   • Idempotente: por padrão só atualiza se `searchText IS NULL`. Com
 *     `--force`, sempre recomputa.
 *
 * Segurança: script standalone. Não toca autenticação nem permissões,
 * então só rode local/staging com credenciais admin.
 */
import { PrismaClient } from '@prisma/client';
import { buildSearchText } from '../lib/wiki/search';

const db = new PrismaClient();

const BATCH = 50;

/**
 * Query tipada — isolar em função nomeada evita que o TS explore
 * o generic profundíssimo do Prisma in-place e solte TS7022
 * (self-referenced implicit any).
 */
async function fetchBatch(opts: { force: boolean; cursor: string | undefined }) {
  const { force, cursor } = opts;
  const base = {
    where: {
      deletedAt: null,
      currentRevisionId: { not: null as null },
      ...(force ? {} : { searchText: null })
    },
    select: {
      id: true,
      slug: true,
      title: true,
      searchText: true,
      currentRevision: { select: { body: true } }
    },
    orderBy: { id: 'asc' as const },
    take: BATCH
  };
  if (cursor) {
    return db.page.findMany({ ...base, skip: 1, cursor: { id: cursor } });
  }
  return db.page.findMany(base);
}

async function main() {
  const force = process.argv.includes('--force');
  const dry = process.argv.includes('--dry');

  console.log(
    `[backfill] modo=${force ? 'force (recompute tudo)' : 'só nulos'} dry=${dry}`
  );

  let cursor: string | undefined = undefined;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const pages = await fetchBatch({ force, cursor });
    if (pages.length === 0) break;

    for (const p of pages) {
      scanned++;
      if (!p.currentRevision) {
        skipped++;
        continue;
      }
      const next = buildSearchText(p.title, p.currentRevision.body);
      if (!force && p.searchText === next) {
        skipped++;
        continue;
      }
      if (dry) {
        console.log(
          `[backfill][dry] ${p.slug} — ${next.length} chars (antes: ${p.searchText?.length ?? 0})`
        );
        updated++;
        continue;
      }
      await db.page.update({
        where: { id: p.id },
        data: { searchText: next }
      });
      updated++;
      if (updated % 20 === 0) {
        console.log(`[backfill] ${updated} atualizadas…`);
      }
    }

    cursor = pages[pages.length - 1].id;
    if (pages.length < BATCH) break;
  }

  console.log(
    `[backfill] done — scanned=${scanned} updated=${updated} skipped=${skipped}`
  );
}

main()
  .catch((err) => {
    console.error('[backfill] erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
