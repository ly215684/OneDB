# OneDB

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="OneDB Logo" />
</p>

<p align="center">
  <a href="README.md">中文</a> | <a href="README.en.md">English</a>
</p>

一体化数据库管理桌面工具，基于 **Tauri 2 + React 19 + TypeScript** 构建。  
支持 MySQL、PostgreSQL、MongoDB、SQLite、Redis、MariaDB、DuckDB 七种主流数据库，提供 SQL 编辑、数据浏览、结构管理、AI 辅助、导入导出等完整功能。

---

## 功能特性

### 多数据库支持

| 数据库 | 连接 | 数据库列表 | SQL 查询 | 表管理 | 导入导出 |
|--------|------|-----------|---------|--------|--------|
| MySQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| PostgreSQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| MongoDB | ✅ | ✅ | ✅（JSON 查询 / 数组批量） | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ | ✅ | ✅ |
| Redis | ✅ | ✅ | ✅（命令） | — | ✅ |
| MariaDB | ✅ | ✅ | ✅ | ✅ | ✅ |
| DuckDB | ✅ | ✅ | ✅ | ✅ | ✅ |

### 核心功能

- **SQL 编辑器** — 基于 CodeMirror，支持语法高亮、自动补全、快捷键执行、**多语句批量执行**（分号智能拆分）
- **数据表视图** — 虚拟滚动大数据量展示，分页/排序/筛选，支持全量导出
- **ER 关系图** — 可视化表结构与外键关系
- **表结构编辑器** — 字段增删改、主键/索引/外键管理
- **MongoDB 文档浏览器** — JSON 文档直接查看与编辑
- **AI 助手面板** — 集成 AI 对话，支持：
  - 流式响应与思考过程展示
  - MCP 工具调用（列出连接/数据库/表、描述表结构、执行查询）
  - 写操作确认机制（增删改需用户手动确认）
  - 一键发送 SQL 到编辑器
  - 多服务商预设（OpenAI / 智谱 AI）+ 自定义 API 端点
- **右键菜单** — 连接/数据库/表三级右键菜单，支持新建、删除、清空、导入导出
- **导入导出** — 支持 JSON / CSV / SQL INSERT 格式，按表或按库批量操作
- **全局搜索** — `Ctrl+K` 快速搜索连接、数据库、表
- **查询历史** — 记录所有执行过的 SQL 语句
- **自动更新** — 内置版本检查与增量更新，支持一键下载安装
- **安全存储** — AES-256-GCM 加密连接密码，主密码锁定保护，支持自定义数据存储路径

### 界面与体验

- **光暗双主题** — 完整的 Light / Dark 主题支持，跟随系统或手动切换
- **国际化** — 中文 / 英文双语，一键切换
- **自定义弹窗** — 统一风格的原生弹窗，替代浏览器 `alert/confirm/prompt`
- **连接分组** — 按数据库类型分组显示，品牌色标识
- **快捷键** — 完整的键盘快捷键支持，支持自定义配置
- **响应式布局** — 侧边栏可拖拽调整宽度，AI 面板可拖拽调整宽度，窗口自适应

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | [Tauri](https://tauri.app/) | 2.x |
| 前端框架 | [React](https://react.dev/) | 19.x |
| 类型系统 | [TypeScript](https://www.typescriptlang.org/) | 5.8 |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) | 3.4 |
| 状态管理 | [Zustand](https://zustand.docs.pmnd.rs/) | 5.x |
| 编辑器 | [CodeMirror](https://codemirror.net/) | 6.x |
| AI 渲染 | [react-markdown](https://github.com/remarkjs/react-markdown) | — |
| 图标 | [Lucide](https://lucide.dev/) | — |
| 国际化 | [i18next](https://www.i18next.com/) | — |
| 自动更新 | [tauri-plugin-updater](https://github.com/tauri-apps/plugins-workspace) | — |

### 后端驱动（Rust）

| 数据库 | Rust 驱动 |
|--------|----------|
| MySQL | `mysql_async` |
| PostgreSQL | `tokio-postgres` |
| MongoDB | `mongodb` |
| SQLite | `rusqlite`（bundled） |
| Redis | `redis`（tokio） |
| MariaDB | `mysql_async` |
| DuckDB | `duckdb`（bundled） |

### 安全存储

- **加密算法** — AES-256-GCM 对称加密
- **密钥派生** — PBKDF2 + SHA-256（100,000 次迭代）
- **存储方案** — Tauri Store 持久化，支持自定义数据路径

---

## 项目结构

```
OneDB/
├── src/                          # 前端源码
│   ├── components/
│   │   ├── connection/           # 连接管理对话框
│   │   ├── editor/               # SQL 编辑器 & 结果面板
│   │   ├── er/                   # ER 关系图
│   │   ├── mongodb/              # MongoDB 文档浏览器
│   │   ├── settings/             # 设置面板
│   │   ├── structure/            # 表结构编辑器
│   │   ├── table/                # 数据表视图
│   │   └── ui/                   # 通用 UI 组件
│   ├── hooks/                    # 自定义 Hooks（快捷键/拖拽滚动/更新检查）
│   ├── i18n/                     # 国际化翻译文件
│   ├── layouts/                  # 布局组件（侧边栏/工具栏/工作区/AI面板）
│   ├── services/
│   │   ├── aiService.ts          # AI 对话服务（流式/MCP工具调用）
│   │   ├── cryptoService.ts      # 加密服务（AES-256-GCM）
│   │   ├── exportService.ts      # 数据导出（CSV/JSON/SQL）
│   │   └── importService.ts      # 数据导入
│   ├── stores/                   # Zustand 状态管理
│   ├── types/                    # TypeScript 类型定义
│   └── utils/                    # 工具函数（SQL 拆分器等）
├── src-tauri/                    # Rust 后端
│   ├── icons/                    # 应用图标
│   └── src/
│       ├── lib.rs                # Tauri 命令注册
│       ├── main.rs               # 入口
│       └── db.rs                 # 数据库驱动实现
└── public/                       # 静态资源
```

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install)（latest stable）
- [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/ly215684/OneDB
cd OneDB

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

---

## 使用说明

1. **新建连接** — 点击侧边栏 `+` 按钮，选择数据库类型并填写连接信息
2. **连接数据库** — 双击连接项建立连接，自动加载数据库列表
3. **浏览数据** — 展开数据库 → 表，双击表名打开数据视图
4. **执行 SQL** — 双击数据库打开 SQL 编辑器，支持多语句（分号分隔）批量执行
5. **MongoDB 查询** — 使用 JSON 格式，支持单个对象或数组批量操作
6. **AI 助手** — 打开 AI 面板，用自然语言描述需求，AI 自动生成并执行 SQL
7. **管理操作** — 右键连接/数据库/表，执行新建、删除、导入导出等操作
8. **安全设置** — 在设置中配置主密码，连接密码将自动加密存储

---

## 版本

v0.2.1

---

## 许可证

MIT License