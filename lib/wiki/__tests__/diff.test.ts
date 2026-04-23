import { describe, expect, it } from 'vitest';
import { diffLines, groupDiffChunks, diffStats } from '../diff';

describe('diffLines', () => {
  it('returns all same when arrays match', () => {
    const result = diffLines(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
      { type: 'same', text: 'c' }
    ]);
  });

  it('marks additions when b has more lines', () => {
    const result = diffLines(['a'], ['a', 'b']);
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' }
    ]);
  });

  it('marks deletions when a has more lines', () => {
    const result = diffLines(['a', 'b'], ['a']);
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' }
    ]);
  });

  it('handles replacement (del then add)', () => {
    const result = diffLines(['hello'], ['world']);
    expect(result).toEqual([
      { type: 'del', text: 'hello' },
      { type: 'add', text: 'world' }
    ]);
  });

  it('handles empty inputs', () => {
    expect(diffLines([], [])).toEqual([]);
    expect(diffLines([], ['a'])).toEqual([{ type: 'add', text: 'a' }]);
    expect(diffLines(['a'], [])).toEqual([{ type: 'del', text: 'a' }]);
  });

  it('preserves order with interleaved changes', () => {
    const a = ['one', 'two', 'three', 'four'];
    const b = ['one', 'TWO', 'three', 'FOUR', 'five'];
    const result = diffLines(a, b);
    // "one" same; "two" → "TWO"; "three" same; "four" → "FOUR"; "five" add.
    // LCS-based diff may order del/add pairs differently; verify via reconstruction.
    const reconstructedA = result.filter((c) => c.type !== 'add').map((c) => c.text);
    const reconstructedB = result.filter((c) => c.type !== 'del').map((c) => c.text);
    expect(reconstructedA).toEqual(a);
    expect(reconstructedB).toEqual(b);
  });
});

describe('groupDiffChunks', () => {
  it('collapses runs of same type', () => {
    const grouped = groupDiffChunks([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
      { type: 'del', text: 'c' },
      { type: 'add', text: 'd' },
      { type: 'add', text: 'e' }
    ]);
    expect(grouped).toEqual([
      { type: 'same', lines: ['a', 'b'] },
      { type: 'del', lines: ['c'] },
      { type: 'add', lines: ['d', 'e'] }
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(groupDiffChunks([])).toEqual([]);
  });
});

describe('diffStats', () => {
  it('counts each type', () => {
    const stats = diffStats([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'add', text: 'c' },
      { type: 'del', text: 'd' }
    ]);
    expect(stats).toEqual({ added: 2, removed: 1, same: 1 });
  });
});
