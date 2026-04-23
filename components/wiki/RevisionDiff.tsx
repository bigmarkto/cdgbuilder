/**
 * RevisionDiff — renderiza um diff linha-a-linha entre duas revisões.
 *
 * Recebe os chunks já agrupados (runs de mesmo tipo viram um bloco só).
 * Convenção visual:
 *   • del — fundo avermelhado, "-" no gutter
 *   • add — fundo esverdeado, "+" no gutter
 *   • same — fundo neutro, " " no gutter (contexto)
 *
 * Server component puro — sem interatividade, só HTML. Não sanitiza pq as
 * linhas são texto plano extraído via docToLines() (que concatena só text
 * nodes do ProseMirror). Mesmo assim, escapa HTML por defesa em profundidade.
 */
import type { DiffChunk } from '@/lib/wiki/diff';
import { escapeHtml } from '@/lib/wiki/renderDoc';

export interface RevisionDiffProps {
  groups: Array<{ type: DiffChunk['type']; lines: string[] }>;
}

const ROW_CLASSES: Record<DiffChunk['type'], string> = {
  same: 'bg-ink-900/40 text-ink-300',
  add: 'bg-emerald-900/30 text-emerald-100',
  del: 'bg-blood-900/30 text-blood-100'
};

const GUTTER_CHAR: Record<DiffChunk['type'], string> = {
  same: ' ',
  add: '+',
  del: '-'
};

const GUTTER_CLASSES: Record<DiffChunk['type'], string> = {
  same: 'text-ink-500',
  add: 'text-emerald-400',
  del: 'text-blood-400'
};

export function RevisionDiff({ groups }: RevisionDiffProps) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-ink-400 italic">
        Nenhuma diferença textual entre essas duas revisões.
      </p>
    );
  }

  return (
    <div className="rounded border border-ink-700 bg-ink-950/60 font-mono text-sm overflow-hidden">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.lines.map((line, li) => (
            <div
              key={`${gi}-${li}`}
              className={`flex ${ROW_CLASSES[group.type]}`}
            >
              <span
                className={`flex-shrink-0 w-6 text-center select-none ${GUTTER_CLASSES[group.type]}`}
                aria-hidden="true"
              >
                {GUTTER_CHAR[group.type]}
              </span>
              <pre
                className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{
                  __html: line.length === 0 ? '&nbsp;' : escapeHtml(line)
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
