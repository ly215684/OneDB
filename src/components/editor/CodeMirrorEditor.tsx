import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Convert shortcut string "Ctrl+Shift+Enter" to CodeMirror key format "Ctrl-Shift-Enter"
 */
function toCodeMirrorKey(shortcut: string): string {
  return shortcut.replace(/\+/g, '-');
}

// MongoDB operation templates
const MONGO_OPERATIONS: Record<string, { template: string; detail: string }> = {
  find: {
    detail: 'Query documents',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "find",',
      '  "filter": {},',
      '  "limit": 100',
      '}',
    ].join('\n'),
  },
  findOne: {
    detail: 'Query single document',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "findOne",',
      '  "filter": {}',
      '}',
    ].join('\n'),
  },
  insertOne: {
    detail: 'Insert one document',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "insertOne",',
      '  "document": {}',
      '}',
    ].join('\n'),
  },
  insertMany: {
    detail: 'Insert multiple documents',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "insertMany",',
      '  "documents": [',
      '    {}',
      '  ]',
      '}',
    ].join('\n'),
  },
  updateOne: {
    detail: 'Update one document',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "updateOne",',
      '  "filter": {},',
      '  "update": { "$set": {} }',
      '}',
    ].join('\n'),
  },
  updateMany: {
    detail: 'Update multiple documents',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "updateMany",',
      '  "filter": {},',
      '  "update": { "$set": {} }',
      '}',
    ].join('\n'),
  },
  deleteOne: {
    detail: 'Delete one document',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "deleteOne",',
      '  "filter": {}',
      '}',
    ].join('\n'),
  },
  deleteMany: {
    detail: 'Delete multiple documents',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "deleteMany",',
      '  "filter": {}',
      '}',
    ].join('\n'),
  },
  count: {
    detail: 'Count documents',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "count",',
      '  "filter": {}',
      '}',
    ].join('\n'),
  },
  aggregate: {
    detail: 'Aggregation pipeline',
    template: [
      '{',
      '  "collection": "",',
      '  "operation": "aggregate",',
      '  "pipeline": [',
      '    { "$match": {} }',
      '  ]',
      '}',
    ].join('\n'),
  },
};

function mongoCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const typed = word.text.toLowerCase();
  const ops = Object.entries(MONGO_OPERATIONS).filter(
    ([name]) => name.startsWith(typed) && typed.length > 0
  );
  if (ops.length === 0) return null;

  return {
    from: word.from,
    to: word.to,
    options: ops.map(([name, { template, detail }]) => ({
      label: name,
      type: 'function',
      detail,
      info: template,
      apply: template,
    })),
  };
}

interface CodeMirrorEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onExecute?: (sql: string, selectedOnly: boolean) => void;
  readOnly?: boolean;
  tables?: { name: string; columns: { name: string; type: string }[] }[];
  placeholder?: string;
  isMongo?: boolean;
}

export function CodeMirrorEditor({ value, onChange, onExecute, readOnly = false, tables, placeholder: placeholderText, isMongo = false }: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeResolved = useThemeStore((s) => s.resolved);
  const executeSqlShortcut = useSettingsStore((s) => s.shortcuts.executeSql);

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
      autocompletion({
        override: isMongo ? [mongoCompletionSource] : undefined,
      }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        {
          key: toCodeMirrorKey(executeSqlShortcut),
          mac: toCodeMirrorKey(executeSqlShortcut).replace('Ctrl', 'Cmd'),
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
        '.cm-placeholder': {
          color: '#999',
          fontStyle: 'normal',
        },
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    if (placeholderText) {
      extensions.push(placeholder(placeholderText));
    }

    if (themeResolved === 'dark') {
      extensions.push(oneDark);
    }

    return extensions;
  }, [onChange, onExecute, readOnly, tables, themeResolved, placeholderText, isMongo, executeSqlShortcut]);

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
