'use client';

/**
 * PageEditor — wrapper TipTap para editar páginas community.
 *
 * Emite JSON ProseMirror no formato que nosso renderDoc() já entende:
 *   • StarterKit dá paragraph, heading 1-6, bold, italic, strike, code,
 *     bulletList, orderedList, listItem, blockquote, codeBlock, hr,
 *     hardBreak, history, dropCursor, gapCursor.
 *   • Link extension adiciona o mark 'link' com attrs.href.
 *   • Placeholder mostra hint no doc vazio.
 *
 * Wikilinks [[slug]] são digitados como texto literal — o renderDoc
 * detecta no server side. Não tem autocomplete/UI especial ainda; fica
 * pra um futuro.
 *
 * Controle do valor: é um editor CONTROLADO externamente? Não — TipTap é
 * pouco amigável a isso. Mantemos estado interno e emitimos onChange
 * sempre que o doc muda, passando JSON completo pro parent (que persiste
 * no form state via hidden input).
 */

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect } from 'react';
import type { DocNode } from '@/lib/wiki/doc';

export interface PageEditorProps {
  /** JSON ProseMirror inicial (DocNode) ou undefined pra editor vazio. */
  initialContent?: DocNode;
  /** Chamado sempre que o documento muda. Sempre recebe JSON válido. */
  onChange: (doc: DocNode) => void;
  /** Placeholder ativo quando o doc está vazio. */
  placeholder?: string;
}

const DEFAULT_PLACEHOLDER =
  'Comece a escrever… use atalhos markdown (# para título, * para bullet, > para citação) ou a barra acima.';

export function PageEditor({
  initialContent,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER
}: PageEditorProps) {
  const editor = useEditor({
    // Next.js SSR: diz pro TipTap NÃO renderizar no servidor, evita hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // StarterKit inclui Link? Não — precisamos da extension separada.
        heading: { levels: [1, 2, 3, 4, 5, 6] }
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
          rel: 'nofollow noopener',
          class: 'text-ember-400 underline'
        }
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        emptyEditorClass: 'tiptap-empty'
      })
    ],
    content: initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class:
          'wiki-content min-h-[260px] px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ember-500'
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as DocNode);
    }
  });

  const insertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link:', prev ?? 'https://');
    if (url === null) return; // cancelou
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[260px] rounded border border-ink-700 bg-ink-900/50 flex items-center justify-center text-ink-400 text-sm">
        Carregando editor…
      </div>
    );
  }

  return (
    <div className="rounded border border-ink-700 bg-ink-900/50 overflow-hidden">
      <Toolbar editor={editor} onInsertLink={insertLink} />
      <EditorContent editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({ editor, onInsertLink }: { editor: Editor; onInsertLink: () => void }) {
  // Força re-render quando o editor state muda (pra highlight dos botões
  // ativos). TipTap expõe `selectionUpdate` e `transaction`; o jeito
  // idiomático no React é useSyncExternalStore, mas pra MVP usamos rerender
  // via listener simples + React state.
  useReactiveEditor(editor);

  return (
    <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-ink-700 bg-ink-900/80 text-sm">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Título 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Título 3"
      >
        H3
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Negrito (Ctrl+B)"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Itálico (Ctrl+I)"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Tachado"
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Código inline"
      >
        <code>&lt;/&gt;</code>
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Lista"
      >
        •
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Citação"
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Bloco de código"
      >
        {'{ }'}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Linha horizontal"
      >
        —
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={onInsertLink}
        active={editor.isActive('link')}
        title="Link"
      >
        🔗
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Desfazer (Ctrl+Z)"
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Refazer (Ctrl+Y)"
      >
        ↷
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'min-w-[28px] h-7 px-1.5 rounded text-xs flex items-center justify-center',
        'hover:bg-ink-700 transition-colors',
        active ? 'bg-ink-700 text-ember-400' : 'text-ink-200',
        disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="w-px h-5 bg-ink-700 mx-1 self-center" />;
}

// ---------------------------------------------------------------------------
// useReactiveEditor — força re-render quando o editor dispara transaction
// ---------------------------------------------------------------------------

import { useState } from 'react';

function useReactiveEditor(editor: Editor | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick((n) => n + 1);
    editor.on('transaction', handler);
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('transaction', handler);
      editor.off('selectionUpdate', handler);
    };
  }, [editor]);
}
