/**
 * /admin — área administrativa restrita a ADMIN.
 *
 * Layout server-side que:
 *   1. Re-verifica role ANTES de qualquer filho ser renderizado (redirect
 *      pra home caso contrário; não expõe que existe uma rota `/admin`).
 *   2. Mostra sidebar com navegação fixa entre sub-páginas.
 *
 * MODERATOR não acessa esse layout — ações de mod rodam inline em páginas
 * (lock/hide). `/admin/*` é só ADMIN pra evitar exposição acidental do
 * viewer de audit + gestão de usuários.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/wiki/permissions';

export const metadata: Metadata = {
  title: 'Admin — CDG',
  robots: { index: false, follow: false }
};

// Força dynamic pra garantir que a checagem de role roda a cada navegação.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // requireRole em modo redirect manda pra home se não for ADMIN.
  await requireRole('ADMIN');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
      <aside className="border-b md:border-b-0 md:border-r border-ink-700 pb-4 md:pb-0 md:pr-4">
        <h2 className="font-serif text-lg text-ink-50 mb-3">Administração</h2>
        <nav className="flex flex-row md:flex-col gap-1 text-sm">
          <SideLink href="/admin/users">Usuários</SideLink>
          <SideLink href="/admin/audit">Audit log</SideLink>
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}

function SideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded text-ink-200 hover:bg-ink-800 hover:text-ink-50 transition-colors"
    >
      {children}
    </Link>
  );
}
