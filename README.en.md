# OneDB

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="OneDB Logo" />
</p>

An all-in-one database management desktop application built with **Tauri 2 + React 19 + TypeScript**.  
Supports MySQL, PostgreSQL, MongoDB, SQLite, and Redis with full capabilities for SQL editing, data browsing, schema management, AI assistance, and import/export.

---

## Features

### Multi-Database Support

| Database | Connect | List DBs | SQL Query | Table Mgmt | Import/Export |
|----------|---------|----------|-----------|------------|---------------|
| MySQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| PostgreSQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| MongoDB | ✅ | ✅ | ✅ (JSON / Array batch) | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ | ✅ | ✅ |
| Redis | ✅ | ✅ | ✅ (Commands) | — | ✅ |

### Core Features

- **SQL Editor** — CodeMirror-based with syntax highlighting, auto-completion, shortcut execution, and **multi-statement batch execution** (smart semicolon splitting)
- **Data Table View** — Virtual scrolling for large datasets with pagination, sorting, and filtering
- **ER Diagram** — Visualize table structures and foreign key relationships
- **Schema Editor** — Add/remove/modify columns, manage primary keys, indexes, and foreign keys
- **MongoDB Document Browser** — View and edit JSON documents directly
- **AI Assistant Panel** — Integrated AI chat with:
  - Streaming responses with thinking process display
  - MCP tool calling (list connections/databases/tables, describe schema, execute queries)
  - Write operation confirmation (INSERT/UPDATE/DELETE require manual approval)
  - One-click send SQL to editor
  - Multi-provider presets (OpenAI / ZhipuAI) + custom API endpoints
- **Context Menus** — Three-level right-click menus for connections, databases, and tables — create, drop, truncate, import/export
- **Import/Export** — JSON / CSV / SQL INSERT formats, batch operations by table or database
- **Global Search** — `Ctrl+K` to quickly search connections, databases, and tables
- **Query History** — Records all executed SQL statements
- **Auto Update** — Built-in version checking with incremental updates, one-click download and install
- **Secure Storage** — AES-256-GCM encrypted connection passwords, master password lock protection, custom data storage path support

### UI & Experience

- **Light / Dark Themes** — Full dual-theme support with system-follow or manual toggle
- **Internationalization** — Chinese / English bilingual, one-click switch
- **Custom Dialogs** — Unified styled native dialogs replacing browser `alert/confirm/prompt`
- **Connection Grouping** — Grouped by database type with brand-color badges
- **Keyboard Shortcuts** — Comprehensive shortcut support
- **Responsive Layout** — Draggable sidebar and AI panel width, adaptive window sizing

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|--------|
| Desktop Framework | [Tauri](https://tauri.app/) | 2.x |
| Frontend Framework | [React](https://react.dev/) | 19.x |
| Type System | [TypeScript](https://www.typescriptlang.org/) | 5.8 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) | 3.4 |
| State Management | [Zustand](https://zustand.docs.pmnd.rs/) | 5.x |
| Editor | [CodeMirror](https://codemirror.net/) | 6.x |
| AI Rendering | [react-markdown](https://github.com/remarkjs/react-markdown) | — |
| Icons | [Lucide](https://lucide.dev/) | — |
| i18n | [i18next](https://www.i18next.com/) | — |
| Auto Update | [tauri-plugin-updater](https://github.com/tauri-apps/plugins-workspace) | — |

### Backend Drivers (Rust)

| Database | Rust Driver |
|----------|-------------|
| MySQL | `mysql_async` |
| PostgreSQL | `tokio-postgres` |
| MongoDB | `mongodb` |
| SQLite | `rusqlite` (bundled) |
| Redis | `redis` (tokio) |

### Secure Storage

- **Encryption** — AES-256-GCM symmetric encryption
- **Key Derivation** — PBKDF2 + SHA-256 (100,000 iterations)
- **Storage** — Tauri Store persistence with custom data path support

---

## Project Structure

```
OneDB/
├── src/                          # Frontend source
│   ├── components/
│   │   ├── connection/           # Connection dialogs
│   │   ├── editor/               # SQL editor & result panel
│   │   ├── er/                   # ER diagram
│   │   ├── mongodb/              # MongoDB document browser
│   │   ├── settings/             # Settings panel
│   │   ├── structure/            # Table structure editor
│   │   ├── table/                # Data table view
│   │   └── ui/                   # Shared UI components
│   ├── hooks/                    # Custom hooks (shortcuts/drag-scroll/update checker)
│   ├── i18n/                     # Translation files (en/zh)
│   ├── layouts/                  # Layout components (sidebar/toolbar/workspace/AI panel)
│   ├── services/
│   │   ├── aiService.ts          # AI chat service (streaming/MCP tool calls)
│   │   ├── cryptoService.ts      # Crypto service (AES-256-GCM)
│   │   ├── exportService.ts      # Data export (CSV/JSON/SQL)
│   │   └── importService.ts      # Data import
│   ├── stores/                   # Zustand state management
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utilities (SQL splitter, etc.)
├── src-tauri/                    # Rust backend
│   ├── icons/                    # Application icons
│   └── src/
│       ├── lib.rs                # Tauri command registration
│       ├── main.rs               # Entry point
│       └── db.rs                 # Database driver implementations
└── public/                       # Static assets
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/ly215684/OneDB
cd OneDB

# Install dependencies
npm install

# Development mode
npm run tauri dev

# Build for production
npm run tauri build
```

---

## Usage

1. **Add Connection** — Click the `+` button in the sidebar, select a database type, and fill in connection details
2. **Connect** — Double-click a connection to establish it; databases are loaded automatically
3. **Browse Data** — Expand Database → Tables, double-click a table to open the data view
4. **Run SQL** — Double-click a database to open the SQL editor; supports multi-statement (semicolon-separated) batch execution
5. **MongoDB Queries** — Use JSON format, supports single object or array batch operations
6. **AI Assistant** — Open the AI panel, describe your needs in natural language, and AI generates & executes SQL automatically
7. **Manage** — Right-click on connections/databases/tables to create, drop, import, export, and more
8. **Security** — Configure a master password in settings; connection passwords are automatically encrypted

---

## Version

v0.1.6

---

## License

MIT License