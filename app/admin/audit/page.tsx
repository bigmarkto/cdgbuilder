/**
 * /admin/audit — viewer do AuditLog.
 *
 * Paginação por cursor via querystring `?before=<id>`. Filtro opcional por
 * ação via `?action=USER_BAN`. Sem sort-order customizado: sempre desc por
 * createdAt (mais novo primeiro).
 *
 * Render é server-side puro — ação é só leitura, não precisa de client.
 */

import Link from 'next/link';
import { listRecentAudit, describeAction, AUDIT_ACTIONS, type AuditAction } from '@/lib/wiki/auditLog';

const PAGE_SIZE = 50;

// Lista fixa pra o dropdown de filtro. Mantido sincronizado com AUDIT_ACTIONS.
const FILTER_OPTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'Todas as ações' },
  { value: AUDIT_ACTIONS.PAGE_LOCK, label: describeAction(AUDIT_ACTIONS.PAGE_LOCK) },
  { value: AUDIT_ACTIONS.PAGE_UNLOCK, label: describeAction(AUDIT_ACTIONS.PAGE_UNLOCK) },
  { value: AUDIT_ACTIONS.PAGE_DELETE, label: describeAction(AUDIT_ACTIONS.PAGE_DELETE) },
  { value: AUDIT_ACTIONS.PAGE_RESTORE, label: describeAction(AUDIT_ACTIONS.PAGE_RESTORE) },
  { value: AUDIT_ACTIONS.REVISION_REVERT, label: describeAction(AUDIT_ACTIONS.REVISION_REVERT) },
  { value: AUDIT_ACTIONS.REVISION_HIDE, label: describeAction(AUDIT_ACTIONS.REVISION_HIDE) },
  { value: AUDIT_ACTIONS.REVISION_UNHIDE, label: describeAction(AUDIT_ACTIONS.REVISION_UNHIDE) },
  { value: AUDIT_ACTIONS.COMMENT_HIDE, label: describeAction(AUDIT_ACTIONS.COMMENT_HIDE) },
  { value: AUDIT_ACTIONS.COMMENT_UNHIDE, label: describeAction(AUDIT_ACTIONS.COMMENT_UNHIDE) },
  { value: AUDIT_ACTIONS.COMMENT_DELETE_MOD, label: describeAction(AUDIT_ACTIONS.COMMENT_DELETE_MOD) },
  { value: AUDIT_ACTIONS.USER_BAN, label: describeAction(AUDIT_ACTIONS.USER_BAN) },
  { value: AUDIT_ACTIONS.USER_UNBAN, label: describeAction(AUDIT_ACTIONS.USER_UNBAN) },
  { value: AUDIT_ACTIONS.USER_ROLE_CHANGE, label: describeAction(AUDIT_ACTIONS.USER_ROLE_CHANGE) }
];

function isAuditAction(value: string): value is AuditAction {
  return Object.values(AUDIT_ACTIONS).includes(value as AuditAction);
}

export default async function AuditPage({
  searchParams
}: {
  searchParams?: { before?: string; action?: string };
}) {
  const actionFilter =
    searchParams?.action && isAuditAction(searchParams.action)
      ? searchParams.action
      : undefined;

  const entries = await listRecentAudit({
    limit: PAGE_SIZE,
    beforeId: searchParams?.before,
    action: actionFilter
  });

  const last = entries[entries.length - 1];
  const hasMore = entries.length === PAGE_SIZE;

  const buildHref = (beforeId?: string) => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (beforeId) params.set('before', beforeId);
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : '/admin/audit';
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-50">Audit log</h1>
        <p className="text-sm text-ink-400 mt-1">
          Trilha de ações sensíveis. Ordem: mais recente primeiro.
        </p>
      </header>

      <form method="get" className="mb-4 flex flex-wrap gap-2 items-center">
        <label className="text-xs text-ink-400">
          Filtrar por ação:
          <select
            name="action"
            defaultValue={actionFilter ?? ''}
            className="ml-2 px-2 py-1 rounded border border-ink-600 bg-ink-900 text-ink-100 text-xs"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="px-3 py-1 rounded bg-ember-500 text-ink-950 text-xs font-medium hover:bg-ember-400"
        >
          Aplicar
        </button>
        {actionFilter && (
          <Link
            href="/admin/audit"
            className="text-xs text-ink-400 hover:text-ember-400"
          >
            limpar
          </Link>
        )}
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-ink-400">
          Nenhuma entrada{actionFilter ? ' com esse filtro' : ''}.
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-ink-800 bg-ink-900/40 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-ink-100 font-medium">
                    {describeAction(entry.action)}
                  </span>
                  <span className="ml-2 text-xs text-ink-500">
                    por{' '}
                    <span className="text-ink-300">
                      {entry.actor.handle
                        ? `@${entry.actor.handle}`
                        : entry.actor.name || entry.actor.email || 'desconhecido'}
                    </span>
                  </span>
                </div>
                <time className="text-xs text-ink-500 font-mono">
                  {entry.createdAt.toLocaleString('pt-BR')}
                </time>
              </div>
              {entry.meta !== null && entry.meta !== undefined && (
                <MetaBlock meta={entry.meta} />
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href={buildHref()} className="text-ink-400 hover:text-ember-400">
          ⇤ primeira página
        </Link>
        {hasMore && last && (
          <Link
            href={buildHref(last.id)}
            className="text-ember-400 hover:underline"
          >
            próxima página →
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Renderiza meta como key: value em chips. Se o objeto é complexo demais
 * (array, nested), cai pra JSON stringify.
 */
function MetaBlock({ meta }: { meta: unknown }) {
  if (typeof meta !== 'object' || meta === null) {
    return (
      <div className="mt-1 text-xs text-ink-400 font-mono">{String(meta)}</div>
    );
  }

  const entries = Object.entries(meta as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-400">
      {entries.map(([k, v]) => (
        <span key={k}>
          <span className="text-ink-500">{k}:</span>{' '}
          <span className="text-ink-200 font-mono break-all">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </span>
      ))}
    </div>
  );
}
