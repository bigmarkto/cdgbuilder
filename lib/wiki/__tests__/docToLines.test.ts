import { describe, expect, it } from 'vitest';
import { docToLines } from '../docToLines';
import type { DocNode } from '../doc';

// Helper pra construir docs sem poluir os casos.
function doc(...content: DocNode[]): DocNode {
  return { type: 'doc', content };
}
function p(text: string): DocNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}
function h(level: number, text: string): DocNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}
function bullet(...items: string[]): DocNode {
  return {
    type: 'bulletList',
    content: items.map((t) => ({
      type: 'listItem',
      content: [p(t)]
    }))
  };
}

describe('docToLines', () => {
  it('returns empty for non-doc input', () => {
    expect(docToLines(null)).toEqual([]);
    expect(docToLines({})).toEqual([]);
    expect(docToLines({ type: 'paragraph' })).toEqual([]);
  });

  it('serializes paragraphs as plain lines', () => {
    const d = doc(p('primeiro'), p('segundo'));
    expect(docToLines(d)).toEqual(['primeiro', 'segundo']);
  });

  it('prefixes headings with # markers by level', () => {
    const d = doc(h(1, 'Topo'), h(2, 'Meio'), h(3, 'Fundo'));
    expect(docToLines(d)).toEqual(['# Topo', '## Meio', '### Fundo']);
  });

  it('serializes bullet lists with - prefix', () => {
    const d = doc(bullet('a', 'b', 'c'));
    expect(docToLines(d)).toEqual(['- a', '- b', '- c']);
  });

  it('serializes ordered lists with numeric prefix', () => {
    const d = doc({
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [p('primeiro')] },
        { type: 'listItem', content: [p('segundo')] }
      ]
    });
    expect(docToLines(d)).toEqual(['1. primeiro', '2. segundo']);
  });

  it('respects orderedList.start attr', () => {
    const d = doc({
      type: 'orderedList',
      attrs: { start: 5 },
      content: [{ type: 'listItem', content: [p('cinco')] }]
    });
    expect(docToLines(d)).toEqual(['5. cinco']);
  });

  it('prefixes blockquote lines with >', () => {
    const d = doc({
      type: 'blockquote',
      content: [p('citado'), p('outra')]
    });
    expect(docToLines(d)).toEqual(['> citado', '> outra']);
  });

  it('wraps codeBlock in fences and preserves content', () => {
    const d = doc({
      type: 'codeBlock',
      attrs: { language: 'ts' },
      content: [{ type: 'text', text: 'const x = 1;\nconst y = 2;' }]
    });
    expect(docToLines(d)).toEqual(['```ts', 'const x = 1;', 'const y = 2;', '```']);
  });

  it('emits --- for horizontalRule', () => {
    const d = doc(p('antes'), { type: 'horizontalRule' }, p('depois'));
    expect(docToLines(d)).toEqual(['antes', '---', 'depois']);
  });

  it('collapses hardBreak to space within a paragraph', () => {
    const d = doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'linha 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'linha 2' }
      ]
    });
    expect(docToLines(d)).toEqual(['linha 1 linha 2']);
  });

  it('makes structural changes visible via prefix diff', () => {
    // Mesmo texto, estrutura diferente → linhas diferentes.
    const a = docToLines(doc(p('Contexto')));
    const b = docToLines(doc(h(2, 'Contexto')));
    expect(a).toEqual(['Contexto']);
    expect(b).toEqual(['## Contexto']);
  });
});
