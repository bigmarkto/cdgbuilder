import { describe, expect, it } from 'vitest';
import { sanitizeHiddenBody } from '../commentRepo';

/**
 * Regressão: o `body` de comentários ocultos NUNCA deve vazar pro client
 * de não-mods. O bug histórico era esconder no JSX mas serializar no payload
 * RSC. A correção zera o body server-side; esses testes amarram o invariante.
 */
describe('sanitizeHiddenBody', () => {
  const visible = {
    body: 'olá mundo',
    hiddenAt: null,
    hiddenReason: null
  };
  const hidden = {
    body: 'comentário ofensivo',
    hiddenAt: new Date('2026-01-01T12:00:00Z'),
    hiddenReason: 'spam'
  };

  it('passa body inalterado quando não está oculto', () => {
    expect(sanitizeHiddenBody(visible, false).body).toBe('olá mundo');
    expect(sanitizeHiddenBody(visible, true).body).toBe('olá mundo');
  });

  it('zera body de oculto pra viewer sem permissão de moderação', () => {
    const result = sanitizeHiddenBody(hidden, false);
    expect(result.body).toBe('');
  });

  it('preserva body de oculto pra MOD+ (precisa pra UI de moderação)', () => {
    const result = sanitizeHiddenBody(hidden, true);
    expect(result.body).toBe('comentário ofensivo');
  });

  it('mantém hiddenReason mesmo quando zera body', () => {
    const result = sanitizeHiddenBody(hidden, false);
    expect(result.hiddenReason).toBe('spam');
    expect(result.hiddenAt).toEqual(hidden.hiddenAt);
  });

  it('não mutaciona o input', () => {
    const original = { ...hidden };
    sanitizeHiddenBody(hidden, false);
    expect(hidden).toEqual(original);
  });
});
