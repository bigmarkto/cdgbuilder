/**
 * heartbeat — query rápida pra "movimentar" o banco e zerar o timer de
 * inatividade do Supabase free tier (que pausa projetos sem uso por 7+ dias).
 *
 * Uso:
 *   npx tsx prisma/heartbeat.ts
 *   # ou: npm run db:heartbeat
 *
 * Apenas reads, nada destrutivo. Imprime um resumo do estado do banco.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const [
    users,
    bannedUsers,
    pages,
    deletedPages,
    revisions,
    comments,
    hiddenComments,
    uploads,
    auditEntries
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { bannedAt: { not: null } } }),
    db.page.count(),
    db.page.count({ where: { deletedAt: { not: null } } }),
    db.revision.count(),
    db.comment.count(),
    db.comment.count({ where: { hiddenAt: { not: null } } }),
    db.fileUpload.count(),
    db.auditLog.count()
  ]);

  // Última atividade — pega a entry mais recente de cada tipo.
  const [lastPage, lastComment, lastAudit] = await Promise.all([
    db.page.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { slug: true, updatedAt: true }
    }),
    db.comment.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    db.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { action: true, createdAt: true }
    })
  ]);

  console.log('=== CDG Builder — heartbeat ===');
  console.log(`Conectado: ${new Date().toISOString()}\n`);
  console.log('Tabela            Total    Notáveis');
  console.log('────────────────  ──────   ──────────────────');
  console.log(`User              ${pad(users)}   ${bannedUsers} banidos`);
  console.log(`Page              ${pad(pages)}   ${deletedPages} soft-deletados`);
  console.log(`Revision          ${pad(revisions)}`);
  console.log(`Comment           ${pad(comments)}   ${hiddenComments} ocultos`);
  console.log(`FileUpload        ${pad(uploads)}`);
  console.log(`AuditLog          ${pad(auditEntries)}`);
  console.log();
  if (lastPage) {
    console.log(`Última edição:    /wiki/c/${lastPage.slug} em ${fmt(lastPage.updatedAt)}`);
  }
  if (lastComment) {
    console.log(`Último comentário: ${fmt(lastComment.createdAt)}`);
  }
  if (lastAudit) {
    console.log(`Última auditoria: ${lastAudit.action} em ${fmt(lastAudit.createdAt)}`);
  }
}

function pad(n: number): string {
  return String(n).padStart(6, ' ');
}

function fmt(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

main()
  .catch((err) => {
    console.error('[heartbeat] erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
