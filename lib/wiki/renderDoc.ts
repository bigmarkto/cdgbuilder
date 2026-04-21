/**
 * renderDoc — converte um documento TipTap/ProseMirror em HTML seguro.
 *
 * Por que rolar o próprio:
 *   • @tiptap/html exige jsdom no server-side — peer dep pesada (~5MB) e
 *     ruim em edge runtimes.
 *   • O subconjunto que renderizamos é pequeno (paragraph, heading, listas,
 *     blockquote, codeBlock, hr, hardBreak + marks bold/italic/strike/code/link).
 *
 * Segurança:
 *   • Todo texto passa por escapeHtml().
 *   • href de link é validado contra allowlist de schemes (http/https/mailto
 *     e paths relativos). Qualquer coisa suspeita vira `#`.
 *   • Atributos desconhecidos de marks/nodes são ignorados — nunca repassados
 *     sem validação.
 *
 * Wikilinks:
 *   • Padrão `[[slug]]` ou `[[slug|texto de exibição]]` é detectado DENTRO
 *     de nós text e convertido em anchor tag.
 *   • Se `slug` contém `/`, vira link canonical (`/wiki/<section>/<id>`);
 *     senão comunidade (`/wiki/c/<slug>`).
 *   • O renderer NÃO checa se o alvo existe (isso é responsabilidade do DB
 *     e da rota 404). Aqui a semântica é "tentar ir para".
 */

import type { DocNode, Mark } from './doc';
import { isDoc, EMPTY_DOC } from './doc';

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Valida href de link. Aceita:
 *   • http:// e https://
 *   • mailto:
 *   • paths relativos (começam com / ou sem scheme)
 *   • fragmento (#anchor)
 * Rejeita: javascript:, data:, vbscript:, file: — devolve '#'.
 */
export function sanitizeHref(raw: unknown): string {
  if (typeof raw !== 'string') return '#';
  const trimmed = raw.trim();
  if (!trimmed) return '#';
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  // sem scheme mas não começa com / → relativo à página; aceitar.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return '#';
}

// ---------------------------------------------------------------------------
// Wikilinks: [[slug]] ou [[slug|display]]
// ---------------------------------------------------------------------------

// capturado: slug (sem |) + (opcional) display text
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Validação leve de slug — alfanumérico, _, -, /. Impede XSS via slug inválido.
const WIKILINK_SLUG_RE = /^[a-zA-Z0-9_\-/]+$/;

export function resolveWikilink(slug: string): string {
  if (!WIKILINK_SLUG_RE.test(slug)) return '#';
  const clean = slug.trim();
  if (!clean) return '#';
  // Com "/" → canonical: /wiki/<section>/<id>
  if (clean.includes('/')) return `/wiki/${clean}`;
  // Sem "/" → community: /wiki/c/<slug>
  return `/wiki/c/${clean}`;
}

/**
 * Processa um text node: escapa HTML, depois injeta anchors para wikilinks.
 * Retorna HTML pronto. As marks (bold/italic/etc) são aplicadas por fora
 * via renderMarks().
 */
function renderTextWithWikilinks(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    const [full, slug, display] = match;
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    const href = resolveWikilink(slug);
    const label = escapeHtml(display?.trim() || slug.trim());
    const cls = href === '#' ? 'wikilink wikilink-broken' : 'wikilink';
    parts.push(`<a class="${cls}" href="${href}">${label}</a>`);
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

function renderMarks(inner: string, marks: Mark[] | undefined): string {
  if (!marks || marks.length === 0) return inner;
  // Aplica na ordem do array. Convenção TipTap: marks[0] é o mais interno.
  // Invertido aqui pra que bold + italic produza <strong><em>…</em></strong>.
  return marks.reduceRight<string>((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return `<strong>${acc}</strong>`;
      case 'italic':
        return `<em>${acc}</em>`;
      case 'strike':
        return `<s>${acc}</s>`;
      case 'code':
        return `<code>${acc}</code>`;
      case 'link': {
        const href = sanitizeHref((mark.attrs as { href?: unknown } | undefined)?.href);
        const external =
          href.startsWith('http://') || href.startsWith('https://')
            ? ' rel="nofollow noopener" target="_blank"'
            : '';
        return `<a href="${href}"${external}>${acc}</a>`;
      }
      default:
        return acc; // mark desconhecida é no-op
    }
  }, inner);
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

function renderChildren(children: DocNode[] | undefined): string {
  if (!children) return '';
  return children.map(renderNode).join('');
}

function renderNode(node: DocNode): string {
  if (!node || typeof node.type !== 'string') return '';

  switch (node.type) {
    case 'doc':
      return renderChildren(node.content);

    case 'paragraph':
      return `<p>${renderChildren(node.content)}</p>`;

    case 'heading': {
      const levelRaw = (node.attrs?.level as number | undefined) ?? 2;
      const level = Math.min(6, Math.max(1, Math.floor(levelRaw)));
      return `<h${level}>${renderChildren(node.content)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul>${renderChildren(node.content)}</ul>`;

    case 'orderedList': {
      const start = (node.attrs?.start as number | undefined) ?? 1;
      return `<ol${start !== 1 ? ` start="${start}"` : ''}>${renderChildren(node.content)}</ol>`;
    }

    case 'listItem':
      return `<li>${renderChildren(node.content)}</li>`;

    case 'blockquote':
      return `<blockquote>${renderChildren(node.content)}</blockquote>`;

    case 'horizontalRule':
      return '<hr />';

    case 'hardBreak':
      return '<br />';

    case 'codeBlock': {
      const lang = node.attrs?.language;
      const langAttr = typeof lang === 'string' && /^[a-z0-9_-]+$/i.test(lang)
        ? ` class="language-${lang}"`
        : '';
      // Dentro de codeBlock, apenas texto bruto — sem marks e sem wikilinks.
      const raw = (node.content ?? [])
        .map((c) => (c.type === 'text' && typeof c.text === 'string' ? c.text : ''))
        .join('');
      return `<pre><code${langAttr}>${escapeHtml(raw)}</code></pre>`;
    }

    case 'text': {
      const raw = typeof node.text === 'string' ? node.text : '';
      const inner = renderTextWithWikilinks(raw);
      return renderMarks(inner, node.marks);
    }

    default:
      // Nó desconhecido → renderiza só filhos pra não perder conteúdo.
      return renderChildren(node.content);
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Converte um documento ProseMirror em HTML. Aceita entradas inválidas
 * sem quebrar — cai pra string vazia se root for malformado.
 */
export function renderDoc(input: unknown): string {
  if (!isDoc(input)) {
    if (input == null) return renderNode(EMPTY_DOC);
    // Input não é doc — tenta renderizar EMPTY pra não quebrar layout.
    return renderNode(EMPTY_DOC);
  }
  return renderNode(input);
}

/**
 * Extrai plaintext do documento — útil para previews, meta description,
 * OG tags e busca full-text.
 */
export function extractPlaintext(input: unknown, maxChars = 280): string {
  const parts: string[] = [];
  function walk(node: DocNode) {
    if (!node) return;
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) walk(child);
      // blocos geram quebras naturais
      if (node.type !== 'text') parts.push(' ');
    }
  }
  if (isDoc(input)) walk(input);
  const joined = parts.join('').replace(/\s+/g, ' ').trim();
  return joined.length > maxChars ? joined.slice(0, maxChars - 1) + '…' : joined;
}
