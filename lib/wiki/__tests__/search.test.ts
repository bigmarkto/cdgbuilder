import { describe, expect, it } from 'vitest';
import { buildSearchText } from '../search';

/**
 * Testes de `buildSearchText` — função pura.
 *
 * Não cobrimos `searchCommunityPages` aqui porque ele depende de Postgres
 * com dicionário pt-BR (`to_tsvector('portuguese', …)`) e extensões tsvector.
 * Isso é validado end-to-end em staging; o que importa aqui é que o
 * texto indexado seja consistente.
 */

function makeDoc(...paragraphs: string[]) {
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }]
    }))
  };
}

describe('buildSearchText', () => {
  it('prepende o título e separa do body por pontuação', () => {
    const text = buildSearchText('Incendiário', makeDoc('Classe de dano em área.'));
    expect(text.startsWith('Incendiário.')).toBe(true);
    expect(text).toContain('Classe de dano em área.');
  });

  it('devolve só o título quando o body está vazio', () => {
    const text = buildSearchText('Artigo sem corpo', makeDoc(''));
    expect(text).toBe('Artigo sem corpo');
  });

  it('trima espaços em volta do título', () => {
    const text = buildSearchText('  Com espaços  ', makeDoc('corpo'));
    expect(text.startsWith('Com espaços.')).toBe(true);
    expect(text.startsWith(' ')).toBe(false);
  });

  it('respeita o limite padrão do extractor (4000 chars)', () => {
    const long = 'palavra '.repeat(5000); // ~40k chars
    const text = buildSearchText('T', makeDoc(long));
    // O extractPlaintext corta em 4000 por padrão; depois vem o título e um
    // "T. " antes. Margem de 100 chars cobre o prefixo + reticências.
    expect(text.length).toBeLessThanOrEqual(4000 + 100);
  });

  it('permite override de bodyMaxChars', () => {
    const long = 'x '.repeat(1000);
    const text = buildSearchText('T', makeDoc(long), { bodyMaxChars: 50 });
    // 50 chars pro body + "T. " (3) + folga pra reticências
    expect(text.length).toBeLessThanOrEqual(60);
  });

  it('descarta JSON que não parece um doc válido', () => {
    // extractPlaintext usa isDoc() internamente; não-docs viram string vazia.
    const text = buildSearchText('Título', { foo: 'bar' } as unknown);
    expect(text).toBe('Título');
  });

  it('é determinístico — chamar 2x com mesma entrada dá mesma saída', () => {
    const doc = makeDoc('um', 'dois', 'três');
    expect(buildSearchText('X', doc)).toBe(buildSearchText('X', doc));
  });
});
