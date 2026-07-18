# OneDB

![OneDB Logo](src-tauri/icons/128x128.png)

An all-in-one database management desktop application built with **Tauri 2 + React 19 + TypeScript**.  
Supports MySQL, PostgreSQL, MongoDB, SQLite, and Redis with full capabilities for SQL editing, data browsing, schema management, and import/export.

---

## Features

### Multi-Database Support

| Database | Connect | List DBs | SQL Query | Table Mgmt | Import/Export |
|----------|---------|----------|-----------|------------|---------------|
| MySQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| PostgreSQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| MongoDB | ✅ | ✅ | ✅ (Collections) | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ | ✅ | ✅ |
| Redis | ✅ | ✅ | ✅ (Commands) | — | ✅ |

### Core Features

- **SQL Editor** — CodeMirror-based with syntax highlighting, auto-completion, and shortcut execution
- **Data Table View** — Virtual scrolling for large datasets with pagination, sorting, and filtering
- **ER Diagram** — Visualize table structures and foreign key relationships
- **Schema Editor** — Add/remove/modify columns, manage primary keys, indexes, and foreign keys
- **MongoDB Document Browser** — View and edit JSON documents directly
- **Context Menus** — Three-level right-click menus for connections, databases, and tables — create, drop, truncate, import/export
- **Import/Export** — JSON / CSV formats, batch operations by table or database
- **Global Search** — `Ctrl+K` to quickly search connections, databases, and tables
- **AI Panel** — Integrated AI-assisted SQL generation and analysis (interface reserved)
- **Query History** — Records all executed SQL statements
- **Secure Storage** — AES-256-GCM encrypted connection passwords, master password lock protection, custom data storage path support

### UI & Experience

- **Light / Dark Themes** — Full dual-theme support with system-follow or manual toggle
- **Internationalization** — Chinese / English bilingual, one-click switch
- **Custom Dialogs** — Unified styled native dialogs replacing browser `alert/confirm/prompt`
- **Connection Grouping** — Grouped by database type with brand-color badges
- **Keyboard Shortcuts** — Comprehensive shortcut support
- **Responsive Layout** — Draggable sidebar width, adaptive window sizing

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop Framework | [Tauri](https://tauri.app/) | 2.x |
| Frontend Framework | [React](https://react.dev/) | 19.x |
| Type System | [TypeScript](https://www.typescriptlang.org/) | 5.8 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) | 3.4 |
| State Management | [Zustand](https://zustand.docs.pmnd.rs/) | 5.x |
| Editor | [CodeMirror](https://codemirror.net/) | 6.x |
| Icons | [Lucide](https://lucide.dev/) | — |
| i18n | [i18next](https://www.i18next.com/) | — |

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
│   ├── hooks/                    # Custom React hooks
│   ├── i18n/                     # Translation files (en/zh)
│   ├── layouts/                  # Layout components (sidebar/toolbar/workspace)
│   ├── services/
│   │   └── cryptoService.ts      # Crypto service (AES-256-GCM)
│   ├── stores/
│   │   ├── tauriStorage.ts       # Tauri Store adapter
│   │   ├── connectionStore.ts    # Connection state management
│   │   └── settingsStore.ts      # Settings state management
│   └── types/                    # TypeScript type definitions
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
4. **Run SQL** — Double-click a database to open the SQL editor, write queries and execute
5. **Manage** — Right-click on connections/databases/tables to create, drop, import, export, and more
6. **Security** — Configure a master password in settings; connection passwords are automatically encrypted

---

## Version

v0.1.4

---

## License

MIT License