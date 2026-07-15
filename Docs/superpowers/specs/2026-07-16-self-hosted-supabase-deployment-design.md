# Supabase 自托管部署设计

日期：2026-07-16
状态：已确认设计，待编写实施计划

## 1. 目标

在 RackNerd VPS 上部署一套适合当前单人开发阶段的自托管 Supabase，为 FragmentArticle 提供：

- 邮箱密码登录和会话管理；
- PostgreSQL 持久化和严格 RLS；
- PostgREST 数据 API；
- 网页正文提取与 AI 代理 Edge Functions；
- Tailscale 私网管理；
- 可恢复的异地加密备份；
- 后续低成本切换至正式域名和 HTTPS 的路径。

第一阶段仅供项目所有者使用。设计优先保证可维护、可恢复和边界清晰，不为尚未发生的并发需求增加组件。

## 2. 非目标

第一阶段不包含：

- 旧数据导入、清洗或迁移；
- Supabase Storage；
- 原始 PDF 云端保存；
- Realtime；
- imgproxy；
- Logflare、Vector 或 Supabase Logs & Analytics；
- RAG、向量索引或 embedding 生成；
- 生产 SMTP、邮件确认和完整密码重置；
- 公网域名、Caddy 和正式 TLS；
- 面向多用户的计费系统。

## 3. 已知环境与约束

### 3.1 VPS

- Ubuntu 24.04 LTS，x86_64；
- 6 GB RAM；
- 约 95 GB 系统盘；
- 公网 IP 为 `107.175.95.166`；
- 当前 SSH 临时监听公网 `443`；
- root 密码曾出现在会话中，视为已泄露；
- VPS 目前仍处于开发期，SSH 加固按用户决定延期到公网发布前完成。

官方完整自托管栈最低要求为 4 GB RAM、2 核 CPU、40 GB SSD，推荐为 8 GB+ RAM、4 核+ CPU、80 GB+ SSD。当前主机高于最低内存和磁盘要求，但低于推荐内存，因此必须关闭未使用服务，且不启用日志分析扩展。

### 3.2 应用依赖

当前应用实际依赖：

- Supabase Auth：注册、登录、会话恢复和退出；
- PostgreSQL + PostgREST：文章、正文、科目、标签、卡片、学习模式内容和进度等持久化；
- Edge Runtime：`content-extractor` 和 `openai-proxy`；
- 严格 RLS：登录用户之间的数据隔离。

当前应用没有使用：

- `supabase.storage`；
- `supabase.channel()` 或 Realtime publication；
- pgvector 或向量搜索。

开发环境的网页导入直接调用 Jina Reader；生产路径先调用 Supabase `content-extractor`。PDF 文本解析和 OCR 则在浏览器内完成。

## 4. 架构决策

采用方案 A：固定版本的官方 Supabase Docker Compose，加少量明确的服务裁剪和网络覆盖配置。

### 4.1 保留服务

| 服务 | 用途 | 保留原因 |
| --- | --- | --- |
| PostgreSQL | Auth schema、业务数据、RLS | 核心数据层 |
| Auth | 注册、登录、会话 | 应用直接依赖 |
| PostgREST | 浏览器数据 API | `supabase-js` 的业务 CRUD 依赖 |
| Kong | Auth、REST、Functions 统一入口 | 保持官方路由结构 |
| Edge Runtime | 网页提取和 AI 代理 | 生产核心路径 |
| Studio | 数据库可视化管理 | 降低单人开发运维成本 |
| postgres-meta | Studio 元数据服务 | Studio 依赖 |
| Supavisor | 数据库连接管理 | 保持官方管理路径，端口不得公网暴露 |

### 4.2 关闭服务

| 服务 | 第一阶段处理 |
| --- | --- |
| Realtime | 移除服务及 Compose 依赖 |
| Storage | 不启动，不创建文件存储依赖 |
| imgproxy | 随 Storage 一并移除 |
| Logflare / Vector | 不启用可选日志 Compose 覆盖文件 |

### 4.3 未选方案

**极简运行栈**仅保留 PostgreSQL、Auth、PostgREST、Kong 和 Edge Runtime。它能进一步降低内存，但会移除 Studio、postgres-meta 和 Supavisor，增加命令行运维与官方版本升级成本。6 GB 主机没有必要为这部分有限节省承担长期偏离。

**完整官方栈**保留 Realtime、Storage 和 imgproxy。它最接近默认配置，但会持续消耗当前不需要的资源，并让 Storage 本地文件容易被误认为异地备份，因此不采用。

## 5. 网络与访问边界

### 5.1 第一阶段：Tailscale 私网

```text
Mac / 本地前端
      |
      | Tailscale
      v
私网 Supabase 入口
      |
      v
Kong
  +-- Auth
  +-- PostgREST
  +-- Edge Functions
  +-- Studio（仅私网）
      |
      v
PostgreSQL
```

- Mac mini 与 VPS 加入同一 Tailscale 网络；
- Supabase API 与 Studio 仅通过 Tailscale 地址访问；
- 私网阶段不安装公网 Caddy，不占用公网 `80/443`；
- 当前 SSH `443` 暂时保留，不在第一阶段强制改造；
- Kong 不绑定公网接口；
- Supavisor 的 `5432/6543` 只绑定回环地址，或完全取消宿主机端口映射；
- 数据库迁移和管理通过服务器本机、Tailscale 或显式 SSH 隧道完成；
- 不依赖 UFW 阻止 Docker 发布端口，因为 Docker 端口转发可能绕过常规 UFW `INPUT` 规则。

私网阶段可以使用 Tailscale 地址上的 HTTP 开发入口，传输仍由 Tailscale 隧道加密。该入口只服务本地开发，不允许被正式 HTTPS 前端调用。

### 5.2 第二阶段：正式域名

公网发布前：

- 为 Supabase 子域名配置 DNS A 记录；
- 使用官方 Caddy Compose 覆盖配置终止 TLS；
- 释放当前被 SSH 占用的公网 `443`；
- Caddy 仅转发 `/auth/v1/*`、`/rest/v1/*` 和批准的 `/functions/v1/*`；
- Studio 根路径不经过公网 Caddy，继续只通过 Tailscale 访问；
- PostgreSQL、Supavisor、Kong 原始端口和 Docker 管理接口不得公网暴露；
- 更新 `SUPABASE_PUBLIC_URL`、`API_EXTERNAL_URL`、Auth 重定向白名单和前端 `VITE_SUPABASE_URL`；
- 保持原数据库、JWT 签名密钥和迁移历史不变。

域名切换不迁移业务数据。浏览器端因 Supabase URL 改变可能需要重新登录一次；切换前发送的旧验证链接可以失效。

## 6. 数据与存储边界

### 6.1 登录用户

登录用户的以下数据存入 PostgreSQL：

- 科目、标签与文章来源元数据；
- 提取后的文章正文；
- 卡片、群聊、Galgame 和测验内容；
- 标注、高亮、书签、笔记和问答记录；
- 各学习模式的进度与奖励。

### 6.2 访客

- 访客数据只存在浏览器当前内存；
- 刷新、关闭页面或登录后即丢失；
- 访客不得调用平台付费 AI Key；
- 访客仍可导入 PDF 和网页链接、查看本地可完成的内容。

### 6.3 PDF 与 Supabase Storage

- PDF.js 和 Tesseract 在浏览器内提取 PDF 文本；
- 第一阶段不上传原始 PDF；
- 仅将提取后的正文写入 `articles.original_content`；
- Supabase Storage 第一阶段保持关闭；
- 以后启用 Storage 时，文件主存储和异地备份仍必须分开设计。

## 7. 数据库初始化与 RLS

这是一个全新项目环境，不迁移任何旧数据。

初始化流程必须：

1. 使用官方 Supabase PostgreSQL 镜像建立 Auth schema、API 角色、默认权限和扩展；
2. 在全新空库中按时间顺序执行仓库中的 schema migrations；
3. 确认全部业务表、约束、索引和最终 RLS 策略存在；
4. 在 API 开放前运行双用户隔离测试；
5. 刷新 PostgREST schema cache；
6. 记录已执行迁移，禁止在已有生产数据的数据库中手工重放历史 SQL。

历史迁移 `20260118155917_add_user_authentication.sql` 含 `TRUNCATE`。在本次全新空库中没有数据影响；生产库建立后不得手工重放该文件。

当前未提交的 RLS 加固迁移、Supabase 配置和相关测试必须进入一个明确、可追踪的部署版本，服务器不得从缺少这些文件的远端提交初始化数据库。

## 8. Auth 设计

### 8.1 私网阶段

- 启用邮箱密码注册；
- 启用邮箱自动确认；
- 注册后直接获得登录会话；
- 未接 SMTP 时，界面不得显示“确认邮件已发送”；
- 密码找回入口明确提示开发阶段暂不可用。

### 8.2 公网发布门槛

- 配置生产 SMTP；
- 验证发件域名；
- 关闭邮箱自动确认；
- 配置 `SITE_URL` 和允许的回调地址；
- 完整验收注册确认、登录、会话恢复、退出、密码重置和设置新密码。

## 9. Edge Functions 与平台 AI Key

### 9.1 `openai-proxy`

- 仅允许持有有效 Supabase 用户访问令牌的登录用户调用；
- 平台七牛 AI Key 只存放在 Edge Function 服务端环境变量；
- 上游 API 地址和允许的模型由服务端白名单决定；
- 浏览器不得提交平台 Key，也不得指定任意上游地址；
- 前端不得使用 `VITE_QINIU_API_KEY` 承载平台 Key；
- 未登录返回 `401`；
- 超额返回 `429`；
- 上游失败返回不包含密钥和内部配置的可重试错误；
- 私网开发阶段仅使用低额度临时 Key；
- 正式平台 Key 必须等 VPS 登录加固完成后才可部署。

由于自托管 Edge Runtime 的 JWT 验证是全局配置，而网页提取仍允许访客使用，Functions 服务不依赖一个全局开关区分两类函数。`openai-proxy` 必须在函数内部验证访问令牌；`content-extractor` 使用独立的公开接口防护。

### 9.2 `content-extractor`

生产环境中，该函数由 VPS 请求目标网页并用 Readability 解析正文。浏览器不能稳定直接抓取任意网站，原因包括 CORS、登录墙和反爬限制，因此不改成纯客户端方案。

函数必须：

- 仅接受 `http` 和 `https` URL；
- 在初始请求和每次重定向前解析 DNS；
- 阻止 IPv4、IPv6、回环、链路本地、私网和保留地址；
- 限制请求体、网页响应体、重定向次数和总超时；
- 不转发浏览器 Cookie 或认证头；
- 公网阶段增加按来源 IP 的请求频率限制；
- 日志不记录文章正文、JWT 或请求中的秘密；
- 保留可诊断的请求编号、耗时、状态码和错误类别。

这些限制约束异常代理请求，不限制正常用户可以创建多少学习资料。

## 10. 密钥与服务器安全

前端构建只允许包含：

- Supabase 公共 URL；
- Supabase publishable/anon key。

以下内容不得进入 `VITE_*`、Git、前端日志或构建产物：

- PostgreSQL 密码；
- Supabase secret/service-role key；
- JWT 私钥；
- SMTP 密码；
- 平台 AI Key；
- VPS 密码。

按用户决定，开发阶段暂不改造 VPS 登录方式。以下事项是部署正式平台 Key、真实用户数据或开放公网 API 之前的阻断条件：

1. 创建非 root sudo 用户；
2. 配置并验证 SSH 密钥登录；
3. 更换已暴露的 root 密码；
4. 禁止 root 密码登录；
5. 迁移管理入口至 Tailscale；
6. 从 SSH 配置中移除公网 `443`；
7. 保留 NerdVM 控制台作为紧急恢复入口。

## 11. 备份与恢复

Supabase PostgreSQL 和以后可能启用的 Storage 都位于 VPS 时，二者属于同一个故障域，不能互相充当备份。

第一阶段备份目标为长期在线的 Mac mini：

- Mac mini 通过 Tailscale 定时拉取备份；
- VPS 不持有可登录 Mac 的私钥；
- PostgreSQL 使用自定义格式逻辑备份；
- 备份使用 `age` 加密后落盘；
- 同步备份部署配置、Functions 环境变量和 `db-config` 关键加密材料；
- VPS 本地短期副本不计入异地备份；
- 建议保留 14 个每日、8 个每周和 6 个每月备份；
- 每月恢复到临时数据库，检查 Auth 用户、业务表、迁移记录和 RLS；
- 备份成功必须以恢复验证为准，不能只判断文件存在。

## 12. 运行与错误处理

- 所有容器配置健康检查和重启策略；
- VPS 重启后 Supabase 自动恢复；
- Docker 日志配置大小和文件数量上限，防止占满系统盘；
- 磁盘使用率达到 75%、容器持续不健康或备份失败时产生可见告警；
- 数据库连接失败不得被应用解释成“没有数据”；
- Auth 未配置、迁移缺失、RLS 拒绝、AI 未登录、AI 超额和上游超时必须返回可区分错误；
- 日志不记录用户正文、会话令牌、数据库密码或平台 AI Key。

## 13. 分阶段交付

### 13.1 第一阶段：单人私网开发

1. 核查 VPS CPU、磁盘、时间同步和当前监听端口；
2. 在 Mac 与 VPS 安装并登录 Tailscale；
3. 安装 Docker Engine 与 Compose；
4. 获取并固定官方稳定 Supabase 自托管版本；
5. 应用服务裁剪和私网端口覆盖；
6. 生成 Supabase 数据库、JWT、Dashboard 和服务密钥；
7. 初始化空数据库并执行应用 schema migrations；
8. 部署 Edge Functions 和低额度临时 AI Key；
9. 配置邮箱自动确认；
10. 配置 Mac mini 加密备份；
11. 更新本地前端 Supabase URL 和公共 key；
12. 完成私网验收。

### 13.2 第二阶段：公网发布

1. 完成 VPS 登录安全阻断项；
2. 接入 SMTP 并验收完整 Auth 邮件流程；
3. 完成 AI 登录校验、每日额度和调用审计；
4. 完成网页提取 SSRF 防护与公网限流；
5. 配置 DNS、Caddy 和正式 HTTPS；
6. 公网只允许已批准的 API 路径；
7. 切换正式平台 AI Key；
8. 更新 Supabase URL 和 Auth 回调；
9. 执行安全、功能、备份恢复和资源回归；
10. 满足全部发布门槛后再接入真实用户。

## 14. 验收标准

### 14.1 基础设施

- 保留的所有容器均健康；
- VPS 重启后服务自动恢复；
- 私网阶段公网无法访问 Kong、Studio、PostgreSQL、Supavisor 和 Edge Functions；
- Tailscale 内可访问 Auth、REST、Functions 和 Studio；
- 关闭 Realtime、Storage、imgproxy 和日志分析后，应用不存在对这些服务的失败请求；
- 日志轮转有效，磁盘不会因容器日志无限增长。

### 14.2 数据与 Auth

- 全新数据库包含所有业务表、索引、约束和最终 RLS；
- 匿名客户端不能读取或写入任何业务表；
- 用户 A 不能读取、修改、删除或伪造关联用户 B 的数据；
- 登录用户刷新后数据保留；
- 访客刷新或登录后数据丢失；
- 私网阶段注册自动确认、登录、会话恢复和退出正常；
- 公网阶段确认邮件和完整密码重置流程正常。

### 14.3 产品路径

- 登录用户可以持久化科目、文章、卡片、群聊、Galgame、测验和各模式进度；
- 未登录调用平台 AI 返回 `401`；
- 登录后卡片生成和流式 AI 功能成功；
- 网页提取走实际 VPS 生产路径，而不是仅验证开发环境 Jina 路径；
- 私网、IPv6、DNS 重绑定和重定向到私网的 URL 被拒绝；
- 原始 PDF 未上传，提取正文正确写入 PostgreSQL。

### 14.4 密钥与恢复

- 前端构建产物不包含平台 AI Key、数据库密码或 secret/service-role key；
- Mac mini 收到加密备份；
- 临时恢复可以重建 Auth、业务 schema、迁移历史和 RLS；
- 公网发布前全部 VPS 登录安全阻断项已完成。

## 15. 风险与缓解

| 风险 | 缓解措施 |
| --- | --- |
| 6 GB 内存低于官方推荐值 | 关闭未用服务和日志分析，固定版本，监控容器健康与内存 |
| Docker 端口绕过 UFW | 取消公网端口映射或显式绑定回环/Tailscale 地址 |
| 历史迁移包含 `TRUNCATE` | 仅用于本次全新空库；生产建立后禁止重放 |
| 平台 AI Key 被前端泄露 | 服务端环境变量、构建产物扫描、登录校验、正式 Key 延后部署 |
| 网页提取成为 SSRF/开放代理 | DNS/IP/重定向检查、大小与超时限制、公网限流 |
| VPS 与 Storage 同时丢失 | Mac mini 异地加密备份和定期恢复演练 |
| 无 SMTP 导致 Auth 文案与行为不一致 | 私网自动确认并明确禁用邮件相关能力，公网前接入 SMTP |
| 官方版本升级破坏兼容 | 固定稳定发布、整套镜像升级、升级前备份及恢复验证 |
| 开发期仍保留已暴露 root 密码 | 不放正式 Key 和重要数据；将登录加固设为公网发布阻断项 |

## 16. 参考资料

仓库证据：

- `src/services/supabase.ts`
- `src/services/dataService.ts`
- `src/contexts/AuthContext.tsx`
- `src/services/contentImport.ts`
- `src/services/openai.ts`
- `supabase/functions/content-extractor/index.ts`
- `supabase/functions/openai-proxy/index.ts`
- `supabase/migrations/20260118155917_add_user_authentication.sql`
- `supabase/migrations/20260715090000_harden_authenticated_persistence.sql`
- `supabase/tests/rls_isolation.sql`

官方资料：

- [Supabase Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase Reverse Proxy and HTTPS](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https)
- [Supabase Self-Hosted Edge Functions](https://supabase.com/docs/guides/self-hosting/self-hosted-functions)
- [Supabase Self-Hosted Auth Keys](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
- [Supabase 官方 Docker 配置](https://github.com/supabase/supabase/tree/master/docker)
- [Docker Port Publishing](https://docs.docker.com/engine/network/port-publishing/)
- [Docker 与 UFW](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw)
