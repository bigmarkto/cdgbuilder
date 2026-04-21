/**
 * Admin CLI — promove um usuário a EDITOR, MODERATOR ou ADMIN.
 *
 * Uso:
 *   npx tsx prisma/promote.ts <email> <role>
 *
 * Exemplos:
 *   npx tsx prisma/promote.ts bigmarkto5916@gmail.com ADMIN
 *   npx tsx prisma/promote.ts fulano@example.com EDITOR
 *
 * Bootstrap: se não existe nenhum ADMIN no sistema e você rodar sem args,
 * promove o primeiro User criado a ADMIN automaticamente. Útil pra subir
 * o primeiro ADMIN depois do primeiro login.
 */
import { PrismaClient, type Role } from '@prisma/client';

const VALID_ROLES: Role[] = ['READER', 'EDITOR', 'MODERATOR', 'ADMIN'];

const db = new PrismaClient();

async function bootstrapFirstAdmin() {
  const existingAdmin = await db.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) {
    console.log(`[promote] Já existe ADMIN: ${existingAdmin.email}. Nada a fazer.`);
    return;
  }
  const firstUser = await db.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!firstUser) {
    console.error('[promote] Nenhum usuário no sistema. Faça login antes de rodar.');
    process.exit(1);
  }
  const updated = await db.user.update({
    where: { id: firstUser.id },
    data: { role: 'ADMIN' }
  });
  console.log(`[promote] Primeiro ADMIN do sistema: ${updated.email}`);
}

async function promoteByEmail(email: string, role: Role) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`[promote] Usuário não encontrado: ${email}`);
    process.exit(1);
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: { role }
  });
  console.log(`[promote] ${updated.email} → ${updated.role}`);
}

async function main() {
  const [, , emailArg, roleArg] = process.argv;

  if (!emailArg) {
    await bootstrapFirstAdmin();
    return;
  }

  const role = (roleArg ?? 'EDITOR').toUpperCase() as Role;
  if (!VALID_ROLES.includes(role)) {
    console.error(
      `[promote] Role inválida: "${roleArg}". Válidas: ${VALID_ROLES.join(', ')}`
    );
    process.exit(1);
  }
  await promoteByEmail(emailArg, role);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
