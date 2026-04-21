/**
 * Tipos canônicos do documento wiki (subconjunto ProseMirror/TipTap).
 *
 * O conteúdo persistido em Revision.body segue esse shape. Mantido compatível
 * com o TipTap StarterKit para que, na Fase 3, o editor e o renderer falem
 * o mesmo JSON sem conversão.
 *
 * Por que não importar tipos do @tiptap/core aqui: o pacote traz peer deps
 * do prosemirror que inflam o bundle do server component. Mantemos uma
 * estrutura mínima e validamos estruturalmente em runtime.
 */

export type MarkType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link';

export interface Mark {
  type: MarkType;
  attrs?: Record<string, unknown>;
}

export type BlockType =
  | 'doc'
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'listItem'
  | 'blockquote'
  | 'horizontalRule'
  | 'hardBreak'
  | 'codeBlock';

export type InlineType = 'text';

export type NodeType = BlockType | InlineType;

export interface DocNode {
  type: NodeType | string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: Mark[];
}

/**
 * Type guard leve: retorna true se parece um documento TipTap válido.
 * Não verifica recursivamente — só o root. O renderer é tolerante a nós
 * desconhecidos (renderiza como texto vazio), então basta checar a raiz.
 */
export function isDoc(value: unknown): value is DocNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'doc' &&
    Array.isArray((value as { content?: unknown }).content)
  );
}

/**
 * Documento vazio — fallback quando a revisão está corrompida ou ausente.
 */
export const EMPTY_DOC: DocNode = {
  type: 'doc',
  content: [{ type: 'paragraph' }]
};
