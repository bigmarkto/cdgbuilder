import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, describeAction } from '../auditLog';

describe('AUDIT_ACTIONS', () => {
  it('expõe as ações documentadas como string literal', () => {
    // Garantia de que o enum fechado cobre os casos esperados pelo admin UI.
    expect(AUDIT_ACTIONS.PAGE_LOCK).toBe('PAGE_LOCK');
    expect(AUDIT_ACTIONS.PAGE_UNLOCK).toBe('PAGE_UNLOCK');
    expect(AUDIT_ACTIONS.PAGE_DELETE).toBe('PAGE_DELETE');
    expect(AUDIT_ACTIONS.PAGE_RESTORE).toBe('PAGE_RESTORE');
    expect(AUDIT_ACTIONS.REVISION_REVERT).toBe('REVISION_REVERT');
    expect(AUDIT_ACTIONS.REVISION_HIDE).toBe('REVISION_HIDE');
    expect(AUDIT_ACTIONS.REVISION_UNHIDE).toBe('REVISION_UNHIDE');
    expect(AUDIT_ACTIONS.COMMENT_HIDE).toBe('COMMENT_HIDE');
    expect(AUDIT_ACTIONS.COMMENT_UNHIDE).toBe('COMMENT_UNHIDE');
    expect(AUDIT_ACTIONS.COMMENT_DELETE_MOD).toBe('COMMENT_DELETE_MOD');
    expect(AUDIT_ACTIONS.USER_BAN).toBe('USER_BAN');
    expect(AUDIT_ACTIONS.USER_UNBAN).toBe('USER_UNBAN');
    expect(AUDIT_ACTIONS.USER_ROLE_CHANGE).toBe('USER_ROLE_CHANGE');
  });
});

describe('describeAction', () => {
  it('devolve rótulo em português para ações conhecidas', () => {
    expect(describeAction('PAGE_LOCK')).toBe('Trancou página');
    expect(describeAction('PAGE_DELETE')).toBe('Excluiu página');
    expect(describeAction('USER_BAN')).toBe('Baniu usuário');
    expect(describeAction('USER_ROLE_CHANGE')).toBe('Alterou papel');
    expect(describeAction('COMMENT_HIDE')).toBe('Ocultou comentário');
    expect(describeAction('COMMENT_DELETE_MOD')).toBe('Excluiu comentário (mod)');
    expect(describeAction('REVISION_REVERT')).toBe('Reverteu revisão');
  });

  it('devolve a string crua quando ação é desconhecida', () => {
    // Protege contra actions legadas do banco que caíram do enum.
    expect(describeAction('FOO_BAR')).toBe('FOO_BAR');
    expect(describeAction('')).toBe('');
  });
});
