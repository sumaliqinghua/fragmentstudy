# Supabase 下一阶段执行规划

日期：2026-07-21

## 1. 当前基线

仓库状态：

- 当前开发分支是 `dev/duo2`，Supabase 私网部署已 fast-forward 合入，当前 HEAD 为 `14de98f`；
- URL 导入、图片归一化、相对 `/supabase-proxy` 解析和私网部署文档均已在当前分支；
- 当前工作树只包含本计划文件和本次文档更新，密钥、age 私钥和 `.env.local` 未进入 Git。

远端状态：

- Tailscale Serve：`https://racknerd-b4acd93.tail635b33.ts.net:8443`；
- 8 个批准服务已连续运行 2 天且全部 healthy；
- Realtime、Storage、imgproxy、Analytics、Vector 未启动；
- Kong `8000`、Supavisor `5432/6543` 仅监听回环；
- VPS 磁盘使用 18%，可用内存约 3.8 GiB；
- 已部署 revision 为 `6051cf4`；
- 19 条 migration、数据库 lint、RLS 6/6 已通过；
- Auth、会话恢复、登录用户持久化和恢复演练已有通过记录。

当前私网阶段未闭环项：公网发布安全加固、正式域名/SMTP、Storage、Realtime、RAG/pgvector 和正式 AI Key；开发阶段继续使用 `.env` 中已有 Key。

## 2. 执行原则

1. 先恢复可维护性，再扩展功能：分支集成和备份通道已完成。
2. 只使用 `.env` 中已有开发 Key，正式 Key 延后到 SSH 加固之后。
3. 每项以可重复的验收证据完成，不以“配置文件存在”作为完成。
4. 保持 Storage、RAG、Realtime 关闭，直到真实产品需求证明需要它们。
5. 公网发布作为独立阶段，不与私网功能收口混做。

## 3. Phase A：整合现有 Supabase 分支（已完成）

### A1. 恢复干净 worktree

操作：

1. 清理仅指向不存在目录的 worktree metadata；
2. 从 `codex/supabase-private-deploy` 建立新的隔离 worktree；
3. 确认分支 HEAD 是 `4ea0f2e`；
4. 检查 10 个提交的 Lore trailers 和文件范围。

不要从 `/tmp/fragmentArticle-supabase-private` 复制文件回主仓库；以 Git 分支为唯一事实源。

### A2. 合入 `dev/duo2`

优先使用 fast-forward merge，因为 `dev/duo2` 是部署分支的祖先。合并前后运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
bash -n scripts/supabase/*.sh
git diff --check
```

验收标准：

- `dev/duo2` 包含 `4ea0f2e` 及之前 9 个 Supabase commits；
- 25/25 单元测试通过；
- typecheck、build、shell syntax 退出 0；
- lint 为 0 error，既有 warning 数被记录；
- 详细教程和 `infra/supabase/`、`scripts/supabase/` 均可在主开发分支找到；
- 本地 `.env.local`、age 私钥和远端密钥没有进入 Git。

## 4. Phase B：修复自动备份（已完成）

当前证据：

- `~/Backups/fragment-article/supabase` 有多组加密快照；
- 恢复演练和最新密文 `pg_restore --list` 检查成功；
- LaunchAgent 已加载，两次运行均退出 `0`；
- `fragmentarticle-backup` alias 通过 `100.84.96.100:443` 使用标准 OpenSSH，不再触发 Tailscale SSH 网页复核。

### B1. 明确自动 SSH 通道

推荐长期方案：

- 为备份创建专用、最小权限的服务器账号；
- 使用专用 ed25519 key；
- 通过 Tailscale IP 访问标准 OpenSSH；
- 在 `~/.ssh/config` 配置稳定 Host alias、端口、IdentityFile、BatchMode；
- 不依赖 Tailscale SSH 的 `check` 型交互授权。

私网开发期的最小修复：如果暂不创建专用用户，则调整 tailnet SSH policy，使 Mac mini 到该 VPS 的允许规则为可自动执行的 `accept`，而不是每次可能触发网页复核的 `check`。不要把密码写进 plist 或脚本。

### B2. 重新验证调度

验证顺序：

1. `ssh -o BatchMode=yes <backup-host-alias> true` 退出 0；
2. 手动运行 `~/.local/bin/fragmentarticle-supabase-backup`；
3. `launchctl kickstart -k gui/$(id -u)/com.fragmentarticle.supabase-backup`；
4. `launchctl print` 显示 `last exit code = 0`；
5. 产生新的三文件加密快照；
6. 解密 `database.dump.age` 并执行 `pg_restore --list`；
7. 保留现有 14 日/8 周/6 月策略。

验收标准：连续两次无交互触发成功，错误日志无新内容，并记录最后成功时间。

## 5. Phase C：完成平台 AI 闭环（已完成）

相关实现：

- `codex/supabase-private-deploy:src/services/openai.ts:61`：浏览器要求登录 session；
- `codex/supabase-private-deploy:supabase/functions/openai-proxy/index.ts`：函数内验证真实用户；
- `codex/supabase-private-deploy:supabase/functions/_shared/openaiProxySecurity.ts`：模型和请求边界。

### C1. 使用现有开发 Key

1. 保留仓库本地 `.env` 中已有的开发 Key，不轮换；
2. 只写入 VPS `/opt/fragment-article/supabase/docker/.env`；
3. 不输出 `.env`，不写入 `VITE_*`，不提交 Git；
4. 只重建 `functions` 容器并确认 healthy。

### C2. API 与浏览器验收

必须覆盖：

1. 未登录调用 `openai-proxy` 返回 `401`；
2. 伪造或过期 token 返回 `401`；
3. 登录用户能生成一组学习卡片；
4. 群聊或 Galgame 至少一个流式路径完整输出；
5. 未允许模型返回 `400`；
6. 客户端提交 `apiKey`/`apiEndpoint` 被拒绝；
7. 上游错误不返回真实 Key；
8. 浏览器 build 不包含 Key 或其可识别片段；
9. Functions 日志不记录 JWT、文章正文或 Key。

验收标准：卡片非流式和一个 SSE 流式功能均从真实 VPS Function 完成，失败状态可区分为登录、配置、额度和上游错误。

## 6. Phase D：把链接导入切到真实 VPS Function（已完成）

当前问题：

- `contentImport.ts:150-153` 已有 Function URL 选择；
- `contentImport.ts:192-200` 在 `DEV` 下固定直接调用 Jina，因此开发页面没有验收 VPS 路径；
- 当前请求只放 `Authorization: Bearer <anon>`，应按 Kong 路由契约同时提供 `apikey`。

### D1. 调整调用策略

目标顺序：

1. Supabase 已配置时，开发和生产都先调用 `content-extractor`；
2. 本地开发经 Vite `/content-extractor` 代理访问 tailnet HTTPS；
3. 请求同时带 `apikey` 和需要的 Authorization；
4. Function 失败时才降级到 Jina Reader；
5. 降级必须给用户可见提示并记录错误类别，不记录正文；
6. Supabase 未配置的纯访客环境可以直接使用 Jina 作为有限降级。

### D2. 增加安全和回归验证

测试：

- 普通公开文章返回标题和正文；
- 掘金等含图片页面的正文格式正确，不再渲染占位 token；
- `localhost`、`127.0.0.1`、RFC1918 地址被拒绝；
- 重定向到私网地址被拒绝；
- 超时、非 HTML、过大正文有明确错误；
- Function 不可用时 Jina fallback 生效并显示 warning。

私网阶段可以先完成调用路径切换；公网前必须补 DNS 解析后的 IPv4/IPv6/保留地址检查、DNS rebinding 防护和 IP 限流。

验收标准：浏览器网络面板能证明第一次请求命中 `/functions/v1/content-extractor`，成功时不调用 Jina。

## 7. Phase E：真实 PDF 验收（已完成）

选择两份无敏感信息的测试 PDF：

- 一份带文本层的常规 PDF；
- 一份少量扫描页的 PDF，用于 OCR。

验证：

1. 标题、页数、分页文本和警告正确；
2. 扫描页超过浏览器上限时有明确提示；
3. 浏览器网络面板没有 PDF 文件上传请求；
4. 登录用户只保存提取文字、来源元数据和生成内容；
5. 数据库不存在原始 PDF 二进制；
6. 刷新后登录用户的文字资料仍存在；
7. 访客刷新后数据消失。

验收标准：两种 PDF 都完成导入预览；源文件未上传；行为与当前“只存结构化文字”决策一致。

## 8. Phase F：私网阶段最终验收（已完成）

在 A-E 完成后重新执行一次完整回归：

- Auth：注册自动确认、登录、恢复、退出；
- 数据：科目、文章、标签、卡片、群聊、Galgame、测验、进度持久化；
- 隔离：RLS 6/6 与匿名访问拒绝；
- AI：匿名拒绝、登录生成、流式成功；
- 导入：VPS 网页提取优先、PDF 不上传；
- 基础设施：8 healthy、5 absent、原始端口仅回环；
- 备份：最近自动备份成功并可列出恢复内容；
- 前端：测试、typecheck、lint、build 通过；
- 文档：已更新实际完成日期、端点、已知限制和延期项。

私网阶段完成定义：上述所有项都有当次运行证据，且没有仍需手工解释的红色错误。

当前执行记录：远端 8 个服务健康、5 个禁用服务缺席、原始端口只监听回环；Auth health、19 条 migration、数据库 lint、RLS 6/6、备份解密目录检查、本地前端验证和文档更新均已完成。

## 9. Phase G：公网发布前安全阶段

只有确定要给外部用户使用时才进入：

1. 创建非 root sudo 运维用户和专用备份用户；
2. 轮换已在历史会话暴露过的 root 密码；
3. 验证密钥登录和 NerdVM 紧急恢复后，关闭 root 密码登录；
4. 把 SSH 管理迁到 Tailscale，释放公网 `443`；
5. 配置正式域名、DNS 和 Caddy HTTPS；
6. 公网只开放 Auth、REST 和批准的 Functions 路径；
7. Studio、PostgreSQL、Supavisor 保持私网；
8. 接入 SMTP，关闭邮箱自动确认，验证密码重置；
9. 增加 AI 日额度、调用审计、超额 `429`；
10. 完成网页提取 SSRF 防护、重定向检查和来源 IP 限流；
11. 配置磁盘、容器健康、备份失败告警；
12. 重新完成备份恢复、RLS、功能和资源回归；
13. 最后才部署正式 AI Key 和真实用户数据。

## 10. 明确延期

以下不进入当前执行周期：

- Supabase Storage；
- 原始 PDF 云存储；
- Realtime；
- RAG、embedding 和 pgvector；
- 多租户计费；
- 大规模性能扩容。

重新评估触发条件：

- 用户确实需要跨设备查看原文件，才讨论 Storage；
- 资料量大到关键词/结构化查询无法满足检索，才讨论 RAG；
- 出现跨设备协作或实时状态需求，才启用 Realtime。

## 11. 推荐执行顺序

```text
A 分支集成
  -> B 修复自动备份
  -> C 现有开发 Key 与真实生成
  -> D VPS 网页提取优先
  -> E PDF 不上传验收
  -> F 私网最终回归
  -> G 公网安全阶段（确认对外发布后）
```

最适合下一次直接执行的工作包是 `A + B`。它们先恢复代码和备份的可信状态，不消耗 AI 费用，也不扩大公网暴露面。
