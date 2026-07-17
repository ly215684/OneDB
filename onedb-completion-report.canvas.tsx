import {
  Stack,
  Row,
  Grid,
  Divider,
  H1,
  H2,
  Text,
  Stat,
  Tag,
  Table,
  Callout,
  Timeline,
  type TimelineEvent,
} from 'qoder/canvas';

const PHASES = [
  { phase: 'Phase 1', name: 'Infrastructure', items: 6, status: 'done' },
  { phase: 'Phase 2', name: 'Main Layout', items: 11, status: 'done' },
  { phase: 'Phase 3', name: 'Connection Mgmt', items: 5, status: 'done' },
  { phase: 'Phase 4', name: 'Object Tree', items: 6, status: 'done' },
  { phase: 'Phase 5', name: 'Tab Workspace', items: 4, status: 'done' },
  { phase: 'Phase 6', name: 'SQL Editor', items: 7, status: 'done' },
  { phase: 'Phase 7', name: 'Data Table', items: 8, status: 'done' },
  { phase: 'Phase 8', name: 'Structure Editor', items: 4, status: 'done' },
  { phase: 'Phase 9', name: 'ER Diagram', items: 5, status: 'done' },
  { phase: 'Phase 10', name: 'AI Panel', items: 6, status: 'done' },
  { phase: 'Phase 11', name: 'MongoDB Browser', items: 4, status: 'done' },
  { phase: 'Phase 12', name: 'Settings', items: 6, status: 'done' },
  { phase: 'Phase 13', name: 'Theme & Styles', items: 5, status: 'done' },
  { phase: 'Phase 14', name: 'Shortcuts', items: 5, status: 'done' },
];

const FEATURES = [
  { name: 'Connection Management', desc: 'Two-step dialog, 6 DB types, form/URL mode, color marks' },
  { name: 'SQL Editor', desc: 'CodeMirror 6, syntax highlight, execute, history, export' },
  { name: 'Data Table', desc: 'Inline edit, context menu, row ops, pagination, WHERE/ORDER BY' },
  { name: 'Structure Editor', desc: 'Columns, indexes, foreign keys tabs' },
  { name: 'ER Diagram', desc: 'Draggable cards, FK lines, zoom, search, mode toggle' },
  { name: 'AI Assistant', desc: 'Chat, quick actions, SQL cards (copy/execute/insert)' },
  { name: 'MongoDB Browser', desc: 'Document CRUD, JSON viewer, query editor' },
  { name: 'Import / Export', desc: 'CSV, JSON, SQL INSERT import & export' },
  { name: 'Global Search', desc: 'Ctrl+K command palette for objects & connections' },
  { name: 'Data Transfer', desc: 'Export / Import / Sync between connections' },
  { name: 'Driver Manager', desc: 'View, install, remove database drivers' },
  { name: 'Settings', desc: 'Theme, language, editor, shortcuts, AI, security' },
];

const TECH_STACK = [
  { layer: 'Framework', tech: 'Tauri 2 (Rust backend)' },
  { layer: 'Frontend', tech: 'React 19 + TypeScript + Vite 7' },
  { layer: 'State', tech: 'Zustand (6 stores + persist)' },
  { layer: 'Styling', tech: 'Tailwind CSS 3 + CSS variables' },
  { layer: 'Editor', tech: 'CodeMirror 6 (@codemirror/lang-sql)' },
  { layer: 'i18n', tech: 'react-i18next (zh / en)' },
  { layer: 'Icons', tech: 'lucide-react' },
  { layer: 'ER Diagram', tech: 'Custom SVG (draggable)' },
];

const FILE_STATS = [
  { metric: 'Total Source Files', value: '45+' },
  { metric: 'TypeScript Errors', value: '0' },
  { metric: 'CSS Bundle', value: '24.18 KB' },
  { metric: 'JS Bundle', value: '765.62 KB' },
  { metric: 'Build Time', value: '~5s' },
  { metric: 'i18n Keys', value: '260+' },
];

const timelineEvents: TimelineEvent[] = [
  { id: '1', title: 'Project Scaffold', description: 'Tauri 2 + React 19 + Vite + Tailwind initialized' },
  { id: '2', title: 'Infrastructure', description: 'Stores, types, i18n, CSS variables, theme system' },
  { id: '3', title: 'Layout & UI', description: 'MainLayout, Toolbar, Sidebar, Workspace, 12 UI components' },
  { id: '4', title: 'Connection Module', description: 'DatabaseSelector, ConnectionForm, ConnectionDialog' },
  { id: '5', title: 'Core Features', description: 'SQL Editor, Data Table, Structure Editor, ER Diagram' },
  { id: '6', title: 'AI & MongoDB', description: 'AI Panel with chat, MongoDB document browser' },
  { id: '7', title: 'Polish & Complete', description: 'Global search, data transfer, driver manager, import/export' },
];

export default function OneDBCompletionReport() {
  return (
    <Stack gap={20}>
      <H1>OneDB — Completion Report</H1>
      <Text tone="secondary">
        Cross-platform desktop database management tool (Navicat alternative) built with Tauri 2 + React 19 + TypeScript + Tailwind CSS.
      </Text>

      <Divider />

      <H2>Build Summary</H2>
      <Grid columns={3} gap={12}>
        <Stat value="0" label="TypeScript Errors" tone="success" />
        <Stat value="765 KB" label="JS Bundle (gzip 241 KB)" />
        <Stat value="24 KB" label="CSS Bundle (gzip 5.4 KB)" />
      </Grid>
      <Grid columns={3} gap={12}>
        {FILE_STATS.slice(3).map((s) => (
          <Stat key={s.metric} value={s.value} label={s.metric} />
        ))}
      </Grid>

      <Divider />

      <H2>Tech Stack</H2>
      <Table
        headers={['Layer', 'Technology']}
        rows={TECH_STACK.map((t) => [t.layer, t.tech])}
      />

      <Divider />

      <H2>Implementation Phases (14 / 14 Complete)</H2>
      <Grid columns={2} gap={8}>
        {PHASES.map((p) => (
          <Row key={p.phase} gap={8} style={{ alignItems: 'center' }}>
            <Tag tone="success">{p.phase}</Tag>
            <Text>{p.name}</Text>
            <Text tone="secondary" size="small">({p.items} items)</Text>
          </Row>
        ))}
      </Grid>

      <Divider />

      <H2>Feature Checklist</H2>
      <Grid columns={2} gap={8}>
        {FEATURES.map((f) => (
          <Row key={f.name} gap={8} style={{ alignItems: 'flex-start' }}>
            <Tag tone="success">✓</Tag>
            <Stack gap={0}>
              <Text weight="medium">{f.name}</Text>
              <Text tone="secondary" size="small">{f.desc}</Text>
            </Stack>
          </Row>
        ))}
      </Grid>

      <Divider />

      <H2>Development Timeline</H2>
      <Timeline events={timelineEvents} />

      <Divider />

      <H2>Project Structure</H2>
      <Callout tone="info">
        <Text size="small">
          <strong>src/stores/</strong> — 6 Zustand stores (theme, connection, tab, settings, queryHistory, ai)
        </Text>
      </Callout>
      <Callout tone="info">
        <Text size="small">
          <strong>src/components/</strong> — 8 subdirectories: connection, editor, er, mongodb, settings, structure, table, ui
        </Text>
      </Callout>
      <Callout tone="info">
        <Text size="small">
          <strong>src/layouts/</strong> — MainLayout, Toolbar, Sidebar, Workspace, AIPanel
        </Text>
      </Callout>
      <Callout tone="info">
        <Text size="small">
          <strong>src/services/</strong> — connectionService, exportService, importService
        </Text>
      </Callout>

      <Divider />

      <Text tone="secondary" size="small">
        OneDB v0.1.0 — All specification requirements implemented. Build passes with zero TypeScript errors.
      </Text>
    </Stack>
  );
}
