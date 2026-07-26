# FragmentStudy

> 把长文章拆成碎片，一口一口学 —— 一款面向碎片时间的 AI 辅助学习应用。

FragmentStudy（产品名 **FragmentArticle**）帮助用户将长文章、PDF、网页等内容转化为可逐步消化的学习片段，并提供卡片、群聊对话、视觉小说等多种阅读形态，降低「开始学」和「坚持学」的心理门槛。

---

## 产品概览

### 核心理念

- **碎片化不等于割裂**：AI 按语义单元拆分，每张卡片保留上下文摘要，可随时回到原文定位。
- **降低难度但不降低深度**：支持零基础解释、故事类比、串联讲解等 AI 问答方式。
- **娱乐化学习**：同一资料可用不同形式呈现，适应不同场景与偏好。
- **低压力进度**：「看过」不等于「掌握」，测验与奖励不阻塞后续内容。

### 主要功能

| 模块 | 说明 |
|------|------|
| **资料导入** | 文本粘贴、网页链接正文提取、PDF 文本层解析、扫描 PDF OCR（中英文） |
| **卡片模式** | 逐卡片学习、语义标签、上下文预览、标注/笔记/书签、里程碑奖励 |
| **对话模式** | 微信群聊风格，角色对话讲解知识点，支持长按提问 |
| **视觉小说模式** | GALgame 风格，打字机效果、情绪贴图、屏幕特效 |
| **原文阅读** | 全文查看、当前位置高亮、选中文本标注与 AI 问答 |
| **测验模式** | 基于文章生成选择题，可选「随手测一下」 |
| **学习路径** | 首页蛇形路径展示单份资料的片段进度，支持科目/标签组织 |
| **用户体系** | 访客模式（localStorage）与邮箱注册登录（Supabase 云端同步） |
| **AI 辅助** | 卡片拆分、对话/剧本生成、流式问答；API Key 存本地或通过 Edge Function 代理 |

### 信息结构

```text
Subject 科目
  └── Article 资料
        └── Knowledge Unit 知识片段
              ├── Card 卡片
              ├── Dialogue 对话
              ├── Galgame 视觉小说
              └── Quiz 测验
```

三种学习模式（卡片 / 群聊 / Galgame）各自维护独立进度游标，互不覆盖。

---

## 技术架构

### 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | React 18、TypeScript、Vite、Tailwind CSS |
| 后端 / 数据 | Supabase（PostgreSQL + Auth + Edge Functions） |
| AI | OpenAI 兼容接口（用户自配 Key 或平台代理） |
| 导入 | PDF.js、Tesseract.js、Readability（Edge Function） |
| 图片存储 | 又拍云（可选，见 `scripts/upyun_upload.py`） |

### 架构示意

```text
┌─────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                      │
│  Pages: Home / Create / Profile / Reader / CardReader   │
│  Services: dataService → guestStorage | Supabase        │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
        localStorage              Supabase
        (访客数据)            ┌───────┴────────┐
                              │ Postgres + RLS │
                              │ Auth           │
                              │ Edge Functions │
                              └───────┬────────┘
                                      │
                              OpenAI 兼容 API
                              (openai-proxy / 本地 dev proxy)
```

`dataService.ts` 是统一数据入口：未登录时走 `guestStorage`（localStorage），登录后走 Supabase，对上层页面透明。

### 项目结构

```text
fragmentstudy/
├── src/
│   ├── App.tsx                 # 路由与 Tab 视图切换
│   ├── pages/                  # Home, Create, Profile, CardReader, QuizReader, ReaderPage ...
│   ├── components/             # 卡片堆叠、阅读器、AI 聊天、学习路径等 UI
│   ├── contexts/               # AuthContext
│   ├── services/
│   │   ├── dataService.ts      # 数据层路由（Supabase / 本地）
│   │   ├── guestStorage.ts     # 访客本地存储
│   │   ├── contentImport.ts    # PDF / URL / 文本导入
│   │   ├── openai.ts           # AI 调用封装
│   │   └── supabase.ts         # Supabase 客户端
│   ├── types/                  # TypeScript 类型定义
│   └── utils/                  # 路径生成、连续学习天数等
├── supabase/
│   ├── config.toml             # 本地 Supabase 配置（应提交）
│   ├── migrations/             # 数据库 schema 迁移（19 个）
│   └── functions/
│       ├── openai-proxy/       # AI 请求代理
│       └── content-extractor/  # 网页正文提取
├── scripts/
│   ├── dev-menu.mjs            # npm run dev:menu：方向键开发菜单
│   └── supabase-local.mjs      # Supabase 本地栈 CLI 封装
├── Docs/                       # 需求、规划、技术文档
└── refer/                      # UI 参考稿
```

更完整的技术说明见 [`Docs/TECHNICAL_DOC.md`](Docs/TECHNICAL_DOC.md)。

---

## 快速开始

### 环境要求

- Node.js 18+
- npm / pnpm
- **本地 Supabase（可选）**： [Docker Desktop](https://docs.docker.com/get-docker/) + [Supabase CLI](https://supabase.com/docs/guides/cli)

### 快速启动

```bash
npm install
cp .env.example .env.local   # 填入 QINIU_API_KEY 等（AI 功能需要）
npm run dev                  # 仅启动 Vite → http://localhost:5173
```

`npm run dev` 保持原来的行为：只启动前端。数据层取决于 `.env.local` 是否配置了 Supabase——未配置则自动进入访客模式。

### 交互式开发环境（推荐）

需要选择本地 Supabase、访客模式或管理环境变量时：

```bash
npm run dev:menu
# 或简短别名
npm run launch
```

支持 **↑↓ 方向键**（或 `j`/`k`）移动高亮项，**Enter** 确认，**Esc** 返回上级菜单。

菜单示意：

```text
FragmentStudy 开发环境
────────────────────
❯ 启动前端（使用 .env.local / 远程 Supabase）
  启动本地 Supabase + 前端
  启动前端（访客模式，忽略 Supabase）
  ── 工具 ──
  Supabase 管理
  环境变量配置
  ...

  ↑↓ 移动 · Enter 确认 · Esc 返回 · j/k 移动
```

本地 Supabase 启动失败时，菜单会显示搭建指引（安装 Docker、Supabase CLI 等），并可选重试或改为仅启动前端。

**配置档案** 会写入 `.env.development.local`（已被 gitignore），开发模式下覆盖 `.env.local` 中的同名变量：

| 档案 | 行为 |
|------|------|
| 远程 / `.env.local` | 删除 `.env.development.local`，使用 `.env.local` |
| 本地 Supabase | 写入本地 API URL 与 anon key |
| 访客模式 | 清空 Supabase 变量，强制 localStorage |

常用地址（本地 Supabase 启动后）：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| 本地邮件（Inbucket） | http://127.0.0.1:54324 |

### 其他命令

```bash
npm run dev              # 仅 Vite（原行为）
npm run dev:menu         # 方向键开发菜单
npm run launch           # 同上（别名）
npm run supabase:start   # 仅启动本地 Supabase
npm run supabase:stop    # 停止本地 Supabase
npm run supabase:status  # 查看状态
npm run supabase:reset   # 重置数据库
```

### 环境变量

复制 `.env.example` 为 `.env.local`（勿提交到 Git）：

```env
# AI（本地 dev 由 Vite 代理，Key 不进浏览器）
QINIU_API_KEY=your-api-key
QINIU_API_ENDPOINT=https://api.qnaigc.com/v1
QINIU_MODEL=qwen/qwen3.7-plus
```

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase URL（`npm run dev:menu` 选本地模式时自动写入） |
| `VITE_SUPABASE_ANON_KEY` | 匿名公钥（同上） |
| `QINIU_API_KEY` | 本地 dev AI 代理 Key（仅 Vite 服务端） |
| `VITE_FAL_KEY` | fal.ai 集成（见 `Docs/fal-ai-integration.md`） |

**变量优先级（开发模式）**：`.env.development.local` > `.env.local` > `.env`

使用远程 / 自托管 Supabase 时，在 `.env.local` 配置 `VITE_SUPABASE_*`，执行 `npm run dev` 或 `npm run dev:menu` 选「远程」即可。

### 关于提交 `supabase/config.toml`

**可以且应该提交。** Supabase 官方建议把以下内容纳入版本控制：

| 应提交 | 不应提交 |
|--------|----------|
| `supabase/config.toml` | `supabase/.temp/` |
| `supabase/migrations/` | `supabase/.branches/` |
| `supabase/functions/` | 含密钥的 `.env` / `.env.local` |
| `supabase/tests/` | `signing_keys.json` 等私钥文件 |

`config.toml` 只包含端口、Auth 行为等项目配置，不含数据库密码或 JWT 签名密钥。本地实例的 anon key 由 CLI 在运行时生成，写入已被 gitignore 的 `.env.development.local`。

### Supabase 远程部署

1. 在 Supabase 控制台创建项目，或使用自托管方案（见 `Docs/superpowers/plans/2026-07-16-self-hosted-supabase-deployment.md`）。
2. 执行 `supabase/migrations/` 下的全部迁移。
3. 部署 Edge Functions：

```bash
supabase functions deploy openai-proxy
supabase functions deploy content-extractor
```

4. 为 `openai-proxy` 配置服务端密钥（如 `QINIU_API_KEY`），**不要**写入 `VITE_*` 变量。

### 常用命令

```bash
npm run dev            # 仅 Vite
npm run dev:menu       # 方向键开发菜单
npm run launch         # 同上（别名）
npm run build          # 生产构建
npm run preview        # 预览构建产物
npm run typecheck      # TypeScript 类型检查
npm run lint           # ESLint
npm run test           # 运行 services 层单元测试
```

---

## 数据模型（Supabase）

主要表：

| 表 | 用途 |
|----|------|
| `articles` | 资料标题、原文、模式、科目、来源 |
| `cards` | 卡片内容与语义标签 |
| `dialogue_messages` / `galgame_messages` | 对话与视觉小说剧本 |
| `learning_progress` | 按 `mode` 区分的学习进度 |
| `subjects` / `tags` | 科目与标签 |
| `highlights` / `card_notes` / `bookmarks` | 标注、笔记、书签 |
| `ai_conversations` / `article_text_qa` | AI 问答记录 |
| `quiz_questions` | 测验题目 |
| `rewards` | 里程碑积分奖励 |

所有用户数据通过 Row Level Security（RLS）隔离，详见 `supabase/migrations/20260715090000_harden_authenticated_persistence.sql`。

---

## 当前进度与规划

### 已完成（Phase 0–2）

- [x] 科目 / 来源 / 多模式独立进度数据模型
- [x] 文本、网页、PDF（含 OCR）导入闭环
- [x] 蛇形学习路径首页、科目切换、低压力进度文案
- [x] 卡片 / 对话 / Galgame / 原文 / 测验阅读器
- [x] 访客模式与 Supabase 登录双轨数据层
- [x] AI 拆分、生成、流式问答

### 进行中 / 待做

- [ ] 三种模式基于同一知识片段、一键切换（Phase 3）
- [ ] 娱乐化内容事实一致性检查
- [ ] 学习打卡、统计面板、导出笔记
- [ ] 平台托管 AI（服务端 Key，见自托管部署计划）
- [ ] 首批片段优先生成、后台异步处理（Phase 4）

产品与版本规划详见 [`Docs/plan.md`](Docs/plan.md)，需求文档见 [`Docs/需求.md`](Docs/需求.md)。

---

## 后续建设方向

本项目当前是 **前端 SPA + Supabase BaaS** 架构，适合在此基础上扩展：

1. **独立服务端**：将 AI 生成、导入解析、计费与限流从 Edge Function 迁移到专用后端（Node / Go / Python 等）。
2. **异步任务队列**：长文章拆分、OCR、多模式生成改为后台 Job，前端只展示首批结果。
3. **对象存储**：PDF 原文件、用户上传图片统一走 S3 / 又拍云，数据库只存元数据。
4. **多租户与分享**：资料分享、协作学习、社区卡片库。
5. **移动端**：React Native 或 PWA 深化。

`dataService` 的 Supabase / localStorage 双轨设计、类型定义（`src/types/`）和 Edge Function 边界可作为拆服务的参考切点。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [`Docs/需求.md`](Docs/需求.md) | 产品需求与用户故事 |
| [`Docs/plan.md`](Docs/plan.md) | 版本规划与验收标准 |
| [`Docs/TECHNICAL_DOC.md`](Docs/TECHNICAL_DOC.md) | 详细技术文档 |
| [`Docs/fal-ai-integration.md`](Docs/fal-ai-integration.md) | fal.ai 图片生成集成 |
| [`Docs/superpowers/plans/`](Docs/superpowers/plans/) | Supabase 持久化与自托管部署计划 |

---

## License

Private project — 暂无开源许可证。如需对外发布请先补充 License 文件。
