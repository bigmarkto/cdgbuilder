import { describe, expect, it } from 'vitest';
import {
  renderDoc,
  escapeHtml,
  sanitizeHref,
  resolveWikilink,
  extractPlaintext
} from '../renderDoc';
import type { DocNode } from '../doc';

const doc = (content: DocNode[]): DocNode => ({ type: 'doc', content });
const p = (content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const t = (text: string, marks?: DocNode['marks']): DocNode => ({ type: 'text', text, marks });

describe('escapeHtml', () => {
  it('escapes HTML special chars', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
  });
});

describe('sanitizeHref', () => {
  it('accepts safe schemes', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('http://example.com')).toBe('http://example.com');
    expect(sanitizeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeHref('/relative/path')).toBe('/relative/path');
    expect(sanitizeHref('#anchor')).toBe('#anchor');
    expect(sanitizeHref('relative-page')).toBe('relative-page');
  });

  it('rejects dangerous schemes', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('#');
    expect(sanitizeHref('data:text/html,<script>')).toBe('#');
    expect(sanitizeHref('vbscript:msgbox')).toBe('#');
    expect(sanitizeHref('file:///etc/passwd')).toBe('#');
  });

  it('handles edge cases', () => {
    expect(sanitizeHref(null)).toBe('#');
    expect(sanitizeHref(undefined)).toBe('#');
    expect(sanitizeHref(123)).toBe('#');
    expect(sanitizeHref('')).toBe('#');
    expect(sanitizeHref('   ')).toBe('#');
  });
});

describe('resolveWikilink', () => {
  it('routes slugs without "/" to community', () => {
    expect(resolveWikilink('guia-incendiario')).toBe('/wiki/c/guia-incendiario');
  });

  it('routes slugs with "/" to canonical', () => {
    expect(resolveWikilink('races/agouro')).toBe('/wiki/races/agouro');
    expect(resolveWikilink('proficiencies/atirador')).toBe('/wiki/proficiencies/atirador');
  });

  it('rejects slugs with unsafe characters', () => {
    expect(resolveWikilink('<script>')).toBe('#');
    expect(resolveWikilink('foo bar')).toBe('#');
    expect(resolveWikilink('')).toBe('#');
  });
});

describe('renderDoc — blocks', () => {
  it('renders empty doc as empty paragraph', () => {
    expect(renderDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('<p></p>');
  });

  it('renders paragraph with text', () => {
    expect(renderDoc(doc([p([t('Hello')])]))).toBe('<p>Hello</p>');
  });

  it('renders headings 1-6', () => {
    for (let level = 1; level <= 6; level++) {
      const html = renderDoc(
        doc([{ type: 'heading', attrs: { level }, content: [t(`H${level}`)] }])
      );
      expect(html).toBe(`<h${level}>H${level}</h${level}>`);
    }
  });

  it('clamps heading level out of range', () => {
    expect(
      renderDoc(doc([{ type: 'heading', attrs: { level: 99 }, content: [t('x')] }]))
    ).toBe('<h6>x</h6>');
    expect(
      renderDoc(doc([{ type: 'heading', attrs: { level: 0 }, content: [t('x')] }]))
    ).toBe('<h1>x</h1>');
  });

  it('renders bullet and ordered lists', () => {
    const bullet = doc([
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [p([t('a')])] },
          { type: 'listItem', content: [p([t('b')])] }
        ]
      }
    ]);
    expect(renderDoc(bullet)).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>');

    const ordered = doc([
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [{ type: 'listItem', content: [p([t('a')])] }]
      }
    ]);
    expect(renderDoc(ordered)).toBe('<ol start="3"><li><p>a</p></li></ol>');
  });

  it('renders blockquote + hr + hardBreak', () => {
    expect(renderDoc(doc([{ type: 'blockquote', content: [p([t('quote')])] }]))).toBe(
      '<blockquote><p>quote</p></blockquote>'
    );
    expect(renderDoc(doc([{ type: 'horizontalRule' }]))).toBe('<hr />');
    expect(renderDoc(doc([p([t('a'), { type: 'hardBreak' }, t('b')])]))).toBe(
      '<p>a<br />b</p>'
    );
  });

  it('renders codeBlock without interpreting marks or wikilinks', () => {
    const cb = doc([
      {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [t('const x = [[not-a-link]];')]
      }
    ]);
    expect(renderDoc(cb)).toBe(
      '<pre><code class="language-typescript">const x = [[not-a-link]];</code></pre>'
    );
  });

  it('renders image node with src + alt + title', () => {
    expect(
      renderDoc(
        doc([
          {
            type: 'image',
            attrs: { src: 'https://cdn.example.com/a.png', alt: 'foto', title: 'legenda' }
          }
        ])
      )
    ).toBe('<img src="https://cdn.example.com/a.png" alt="foto" title="legenda" loading="lazy" />');
  });

  it('rejects image with dangerous src (drops node)', () => {
    expect(
      renderDoc(
        doc([
          { type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'x' } }
        ])
      )
    ).toBe('');
  });

  it('escapes HTML in image alt/title', () => {
    expect(
      renderDoc(
        doc([
          {
            type: 'image',
            attrs: { src: '/img/x.png', alt: '<x>', title: '"t"' }
          }
        ])
      )
    ).toBe('<img src="/img/x.png" alt="&lt;x&gt;" title="&quot;t&quot;" loading="lazy" />');
  });
});

describe('renderDoc — security', () => {
  it('escapes HTML in text', () => {
    expect(renderDoc(doc([p([t('<script>alert(1)</script>')])]))).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
    );
  });

  it('neutralizes javascript: links', () => {
    const d = doc([
      p([t('click', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])])
    ]);
    expect(renderDoc(d)).toBe('<p><a href="#">click</a></p>');
  });

  it('adds rel + target for external links', () => {
    const d = doc([
      p([t('click', [{ type: 'link', attrs: { href: 'https://evil.com' } }])])
    ]);
    expect(renderDoc(d)).toBe(
      '<p><a href="https://evil.com" rel="nofollow noopener" target="_blank">click</a></p>'
    );
  });

  it('keeps internal links plain', () => {
    const d = doc([
      p([t('click', [{ type: 'link', attrs: { href: '/wiki/c/foo' } }])])
    ]);
    expect(renderDoc(d)).toBe('<p><a href="/wiki/c/foo">click</a></p>');
  });

  it('ignores unknown node types but preserves inner content', () => {
    const d = doc([
      { type: 'customBlock', content: [p([t('inside')])] } as DocNode
    ]);
    expect(renderDoc(d)).toBe('<p>inside</p>');
  });

  it('ignores unknown marks but keeps text', () => {
    const d = doc([p([t('hi', [{ type: 'weird' as 'bold' }])])]);
    expect(renderDoc(d)).toBe('<p>hi</p>');
  });
});

describe('renderDoc — marks', () => {
  it('applies bold/italic/strike/code', () => {
    expect(renderDoc(doc([p([t('x', [{ type: 'bold' }])])]))).toBe('<p><strong>x</strong></p>');
    expect(renderDoc(doc([p([t('x', [{ type: 'italic' }])])]))).toBe('<p><em>x</em></p>');
    expect(renderDoc(doc([p([t('x', [{ type: 'strike' }])])]))).toBe('<p><s>x</s></p>');
    expect(renderDoc(doc([p([t('x', [{ type: 'code' }])])]))).toBe('<p><code>x</code></p>');
  });

  it('nests bold inside italic', () => {
    const html = renderDoc(
      doc([p([t('x', [{ type: 'bold' }, { type: 'italic' }])])])
    );
    // reduceRight: italic first (innermost), then bold outside
    expect(html).toBe('<p><strong><em>x</em></strong></p>');
  });
});

describe('renderDoc — wikilinks', () => {
  it('converts [[slug]] to community link', () => {
    expect(renderDoc(doc([p([t('See [[guia-incendiario]] for details.')])]))).toBe(
      '<p>See <a class="wikilink" href="/wiki/c/guia-incendiario">guia-incendiario</a> for details.</p>'
    );
  });

  it('converts [[section/id]] to canonical link', () => {
    expect(renderDoc(doc([p([t('Ver [[races/agouro]]')])]))).toBe(
      '<p>Ver <a class="wikilink" href="/wiki/races/agouro">races/agouro</a></p>'
    );
  });

  it('supports [[slug|display text]]', () => {
    expect(renderDoc(doc([p([t('Ver [[races/agouro|Agouros]]')])]))).toBe(
      '<p>Ver <a class="wikilink" href="/wiki/races/agouro">Agouros</a></p>'
    );
  });

  it('handles multiple wikilinks in one text node', () => {
    const html = renderDoc(doc([p([t('[[a]] e [[b]]')])]));
    expect(html).toBe(
      '<p><a class="wikilink" href="/wiki/c/a">a</a> e <a class="wikilink" href="/wiki/c/b">b</a></p>'
    );
  });

  it('marks broken wikilink with invalid slug', () => {
    expect(renderDoc(doc([p([t('[[bad slug]]')])]))).toBe(
      '<p><a class="wikilink wikilink-broken" href="#">bad slug</a></p>'
    );
  });

  it('escapes HTML inside display text', () => {
    expect(renderDoc(doc([p([t('[[races/agouro|<b>xss</b>]]')])]))).toBe(
      '<p><a class="wikilink" href="/wiki/races/agouro">&lt;b&gt;xss&lt;/b&gt;</a></p>'
    );
  });
});

describe('renderDoc — fallback', () => {
  it('returns empty paragraph on non-doc input', () => {
    expect(renderDoc(null)).toBe('<p></p>');
    expect(renderDoc({ type: 'paragraph' })).toBe('<p></p>');
    expect(renderDoc('string')).toBe('<p></p>');
  });
});

describe('extractPlaintext', () => {
  it('pulls text from nested nodes', () => {
    const d = doc([
      { type: 'heading', attrs: { level: 1 }, content: [t('Title')] },
      p([t('Hello '), t('world', [{ type: 'bold' }])])
    ]);
    expect(extractPlaintext(d)).toBe('Title Hello world');
  });

  it('truncates to maxChars', () => {
    const long = 'a'.repeat(500);
    const d = doc([p([t(long)])]);
    const result = extractPlaintext(d, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns empty string for invalid input', () => {
    expect(extractPlaintext(null)).toBe('');
    expect(extractPlaintext({})).toBe('');
  });
});
