import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { useThemeStore } from '../../stores/themeStore';

interface CodeMirrorEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onExecute?: (sql: string, selectedOnly: boolean) => void;
  readOnly?: boolean;
  tables?: { name: string; columns: { name: string; type: string }[] }[];
}

export function CodeMirrorEditor({ value, onChange, onExecute, readOnly = false, tables }: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeResolved = useThemeStore((s) => s.resolved);

  const getExtensions = useCallback(() => {
    const extensions = [
      sql(tables ? {
        schema: Object.fromEntries(
          tables.map((t) => [t.name, t.columns.map((c) => c.name)])
        ),
      } : {}),
      history(),
      bracketMatching(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      lineNumbers(),
      autocompletion(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        {
          key: 'Ctrl-Enter',
          mac: 'Cmd-Enter',
          run: (view) => {
            if (onExecute) {
              const selected = view.state.selection.main;
              const hasSelection = selected.from !== selected.to;
              const sqlText = hasSelection
                ? view.state.doc.sliceString(selected.from, selected.to)
                : view.state.doc.toString();
              onExecute(sqlText, hasSelection);
            }
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
        },
        '.cm-scroller': {
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          overflow: 'auto',
        },
        '.cm-content': {
          padding: '8px 0',
        },
        '.cm-gutters': {
          borderRight: '1px solid var(--border)',
        },
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    if (themeResolved === 'dark') {
      extensions.push(oneDark);
    }

    return extensions;
  }, [onChange, onExecute, readOnly, tables, themeResolved]);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: getExtensions(),
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getExtensions]);

  // Update value externally
  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={editorRef} className="h-full w-full overflow-hidden" />;
}
