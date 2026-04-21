import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify } from '../slug';
import { parseCanonicalRef } from '../canonicalRef';

describe('isValidSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidSlug('hello')).toBe(true);
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('foo-bar-baz')).toBe(true);
    expect(isValidSlug('abc123')).toBe(true);
    expect(isValidSlug('123-abc')).toBe(true);
  });

  it('rejects too short or too long', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('a'.repeat(81))).toBe(false);
  });

  it('rejects forbidden patterns', () => {
    expect(isValidSlug('UPPER')).toBe(false);
    expect(isValidSlug('with space')).toBe(false);
    expect(isValidSlug('with/slash')).toBe(false);
    expect(isValidSlug('under_score')).toBe(false);
    expect(isValidSlug('-starts-with-dash')).toBe(false);
    expect(isValidSlug('ends-with-dash-')).toBe(false);
    expect(isValidSlug('double--dash')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('slugify', () => {
  it('lowercases and kebab-cases', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Foo   Bar  ')).toBe('foo-bar');
  });

  it('strips accents', () => {
    expect(slugify('Ações de Herói')).toBe('acoes-de-heroi');
    expect(slugify('Guerreiros da Luz')).toBe('guerreiros-da-luz');
  });

  it('removes special chars', () => {
    expect(slugify('Foo! & Bar?')).toBe('foo-bar');
    expect(slugify('Test.2024')).toBe('test-2024');
  });

  it('caps at 80 chars', () => {
    const longInput = 'a'.repeat(200);
    expect(slugify(longInput).length).toBe(80);
  });
});

describe('parseCanonicalRef', () => {
  // Usa dados reais do projeto — races/agouro é um slug sabidamente existente
  // conforme o .env/seed anterior.
  it('parses valid refs that exist in canonical data', () => {
    const result = parseCanonicalRef('races/agouro');
    expect(result).toEqual({ section: 'races', id: 'agouro' });
  });

  it('rejects refs with wrong shape', () => {
    expect(parseCanonicalRef('only-one-part')).toBeNull();
    expect(parseCanonicalRef('too/many/parts')).toBeNull();
    expect(parseCanonicalRef('')).toBeNull();
  });

  it('rejects refs with unknown section', () => {
    expect(parseCanonicalRef('unknownsection/agouro')).toBeNull();
  });

  it('rejects refs with nonexistent id inside valid section', () => {
    expect(parseCanonicalRef('races/nao-existe-xyz')).toBeNull();
  });
});
