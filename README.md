# OneDB

一体化数据库管理桌面工具，基于 **Tauri 2 + React 19 + TypeScript** 构建。  
支持 MySQL、PostgreSQL、MongoDB、SQLite、Redis 五种主流数据库，提供 SQL 编辑、数据浏览、结构管理、导入导出等完整功能。

---

## 功能特性

### 多数据库支持

| 数据库 | 连接 | 数据库列表 | SQL 查询 | 表管理 | 导入导出 |
|--------|------|-----------|---------|--------|---------|
| MySQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| PostgreSQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| MongoDB | ✅ | ✅ | ✅（集合） | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ | ✅ | ✅ |
| Redis | ✅ | ✅ | ✅（命令） | — | ✅ |

### 核心功能

- **SQL 编辑器** — 基于 CodeMirror，支持语法高亮、自动补全、快捷键执行
- **数据表视图** — 虚拟滚动大数据量展示，分页/排序/筛选
- **ER 关系图** — 可视化表结构与外键关系
- **表结构编辑器** — 字段增删改、主键/索引/外键管理
- **MongoDB 文档浏览器** — JSON 文档直接查看与编辑
- **右键菜单** — 连接/数据库/表三级右键菜单，支持新建、删除、清空、导入导出
- **导入导出** — 支持 JSON / CSV 格式，按表或按库批量操作
- **全局搜索** — `Ctrl+K` 快速搜索连接、数据库、表
- **AI 面板** — 集成 AI 辅助 SQL 生成与分析（预留接口）
- **查询历史** — 记录所有执行过的 SQL 语句

### 界面与体验

- **光暗双主题** — 完整的 Light / Dark 主题支持，跟随系统或手动切换
- **国际化** — 中文 / 英文双语，一键切换
- **自定义弹窗** — 统一风格的原生弹窗，替代浏览器 `alert/confirm/prompt`
- **连接分组** — 按数据库类型分组显示，品牌色标识
- **快捷键** — 完整的键盘快捷键支持
- **响应式布局** — 侧边栏可拖拽调整宽度，窗口自适应

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
| 图标 | [Lucide](https://lucide.dev/) | — |
| 国际化 | [i18next](https://www.i18next.com/) | — |

### 后端驱动（Rust）

| 数据库 | Rust 驱动 |
|--------|----------|
| MySQL | `mysql_async` |
| PostgreSQL | `tokio-postgres` |
| MongoDB | `mongodb` |
| SQLite | `rusqlite`（bundled） |
| Redis | `redis`（tokio） |

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
│   ├── hooks/                    # 自定义 Hooks
│   ├── i18n/                     # 国际化翻译文件
│   ├── layouts/                  # 布局组件（侧边栏/工具栏/工作区）
│   ├── services/                 # 前端服务层（连接/导入/导出）
│   ├── stores/                   # Zustand 状态管理
│   └── types/                    # TypeScript 类型定义
├── src-tauri/                    # Rust 后端
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
4. **执行 SQL** — 双击数据库打开 SQL 编辑器，输入查询后执行
5. **管理操作** — 右键连接/数据库/表，执行新建、删除、导入导出等操作

---

## 许可证

MIT License
# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
