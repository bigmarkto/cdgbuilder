/**
 * diff — diff de linhas baseado em LCS (Longest Common Subsequence).
 *
 * Por que não uma lib: o algoritmo DP clássico é ~25 linhas, O(n*m) de tempo
 * e memória. Como páginas wiki raramente passam de algumas centenas de
 * linhas, isso é trivial. Evita adicionar dep (package `diff` puxa tipagens
 * próprias e expande o grafo de node_modules à toa).
 *
 * Formato de saída: lista de chunks `{ type, text }` onde type é:
 *   • 'same' — linha igual em A e B
 *   • 'del'  — linha existe só em A
 *   • 'add'  — linha existe só em B
 *
 * Convenção: A é a versão mais antiga, B é a mais nova. Então "del" = o que
 * saiu, "add" = o que entrou.
 */

export type DiffChunk = { type: 'same' | 'add' | 'del'; text: string };

/**
 * Diff linha-a-linha entre dois arrays de strings.
 *
 * Implementação LCS clássica (bottom-up DP) + backtrack. Tempo O(n*m),
 * espaço O(n*m). Pra n+m > ~10k considerar Myers, mas não é nosso caso.
 */
export function diffLines(a: string[], b: string[]): DiffChunk[] {
  const n = a.length;
  const m = b.length;

  // dp[i][j] = tamanho do LCS de a[i..] e b[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack pra produzir a sequência de operações na ordem original.
  const out: DiffChunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: 'del', text: a[i] });
    i++;
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j] });
    j++;
  }
  return out;
}

/**
 * Agrupa chunks consecutivos do mesmo tipo num só elemento, útil pra UI
 * que quer renderizar "bloco adicionado" em vez de linha-a-linha.
 * Preserva a ordem. Linhas ficam em `lines: string[]`.
 */
export function groupDiffChunks(
  chunks: DiffChunk[]
): Array<{ type: DiffChunk['type']; lines: string[] }> {
  const out: Array<{ type: DiffChunk['type']; lines: string[] }> = [];
  for (const c of chunks) {
    const last = out[out.length - 1];
    if (last && last.type === c.type) {
      last.lines.push(c.text);
    } else {
      out.push({ type: c.type, lines: [c.text] });
    }
  }
  return out;
}

/**
 * Estatísticas rápidas pra mostrar "+X / -Y" acima do diff.
 */
export function diffStats(chunks: DiffChunk[]): { added: number; removed: number; same: number } {
  let added = 0;
  let removed = 0;
  let same = 0;
  for (const c of chunks) {
    if (c.type === 'add') added++;
    else if (c.type === 'del') removed++;
    else same++;
  }
  return { added, removed, same };
}
