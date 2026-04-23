/**
 * docToLines — serializa um documento TipTap/ProseMirror em linhas de texto
 * com prefixos estruturais, pra alimentar o diff.
 *
 * A ideia: cada bloco vira 1..N linhas, e marcadores no início (`# `, `- `,
 * `> `, `\`\`\``) deixam óbvio no diff quando a estrutura mudou, não só o
 * texto. Ex: transformar parágrafo em heading vira uma deleção + adição,
 * não um "same".
 *
 * Convenções (inspiradas em Markdown, mas só pra visualização — não é
 * round-trip):
 *   • heading nível N → "N-octothorpes + espaço + texto" ("## Título")
 *   • paragraph → texto cru
 *   • bulletList item → "- texto"
 *   • orderedList item → "<i>. texto" (numeração reiniciada pelo nó)
 *   • blockquote → prefixa cada linha interna com "> "
 *   • codeBlock → fence "```" + linhas de código + "```"
 *   • horizontalRule → "---"
 *   • hardBreak → colapsa pra espaço dentro da mesma linha
 *
 * Aninhamentos profundos (lista dentro de lista dentro de blockquote)
 * continuam funcionando via concatenação de prefixos — não é perfeito
 * mas produz diff legível.
 */

import type { DocNode } from './doc';
import { isDoc } from './doc';

/**
 * Concatena o texto de todos os descendentes `text` de um nó, ignorando
 * marks (o diff é estrutural + textual; cor/negrito mudam via estrutura
 * própria quando necessário). hardBreak vira espaço pra não explodir
 * um parágrafo em várias linhas.
 */
function blockText(node: DocNode): string {
  const parts: string[] = [];
  function walk(n: DocNode) {
    if (!n) return;
    if (n.type === 'text' && typeof n.text === 'string') {
      parts.push(n.text);
      return;
    }
    if (n.type === 'hardBreak') {
      parts.push(' ');
      return;
    }
    if (n.content) {
      for (const child of n.content) walk(child);
    }
  }
  walk(node);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

export function docToLines(input: unknown): string[] {
  if (!isDoc(input)) return [];
  const out: string[] = [];

  function emitBlock(node: DocNode, prefix: string) {
    if (!node || typeof node.type !== 'string') return;

    switch (node.type) {
      case 'paragraph': {
        const text = blockText(node);
        out.push(prefix + text); // parágrafo vazio vira linha vazia, ok
        return;
      }
      case 'heading': {
        const levelRaw = (node.attrs?.level as number | undefined) ?? 2;
        const level = Math.min(6, Math.max(1, Math.floor(levelRaw)));
        out.push(prefix + '#'.repeat(level) + ' ' + blockText(node));
        return;
      }
      case 'codeBlock': {
        const lang = node.attrs?.language;
        const langStr = typeof lang === 'string' && /^[a-z0-9_-]+$/i.test(lang) ? lang : '';
        out.push(prefix + '```' + langStr);
        const raw = (node.content ?? [])
          .map((c) => (c.type === 'text' && typeof c.text === 'string' ? c.text : ''))
          .join('');
        for (const line of raw.split('\n')) out.push(prefix + line);
        out.push(prefix + '```');
        return;
      }
      case 'horizontalRule':
        out.push(prefix + '---');
        return;
      case 'blockquote':
        for (const child of node.content ?? []) emitBlock(child, prefix + '> ');
        return;
      case 'bulletList':
        for (const item of node.content ?? []) {
          if (item.type === 'listItem') emitListItem(item, prefix, '- ');
        }
        return;
      case 'orderedList': {
        const start = (node.attrs?.start as number | undefined) ?? 1;
        let i = start;
        for (const item of node.content ?? []) {
          if (item.type === 'listItem') emitListItem(item, prefix, `${i}. `);
          i++;
        }
        return;
      }
      default:
        // Nó desconhecido — processa filhos pra não sumir conteúdo no diff.
        for (const child of node.content ?? []) emitBlock(child, prefix);
    }
  }

  function emitListItem(item: DocNode, prefix: string, bullet: string) {
    const children = item.content ?? [];
    if (children.length === 0) {
      out.push(prefix + bullet);
      return;
    }
    // Primeiro filho paragraph: sua linha recebe o bullet.
    // Filhos subsequentes (listas aninhadas, etc.) ganham indent de 2 espaços.
    const [first, ...rest] = children;
    if (first.type === 'paragraph') {
      out.push(prefix + bullet + blockText(first));
    } else {
      // Bullet vazio e o primeiro filho desce pra sublinha indentada.
      out.push(prefix + bullet);
      emitBlock(first, prefix + '  ');
    }
    for (const child of rest) emitBlock(child, prefix + '  ');
  }

  for (const node of input.content ?? []) emitBlock(node, '');
  return out;
}
