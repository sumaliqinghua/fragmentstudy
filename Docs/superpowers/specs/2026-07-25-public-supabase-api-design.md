# Supabase 公网 App API 部署设计

日期：2026-07-25

## 1. 目标

将当前仅通过 Tailscale 访问的自托管 Supabase，增加一个供 React Native 客户端使用的公网 HTTPS 入口：

```text
https://api.iamchatgpt.top
```

本阶段没有正式 Web 前端。React Native 使用自定义 URL Scheme 接收 Auth 回调，未来 Web 端可复用同一 Supabase API。

## 2. 已确认决策

- DNS 使用现有服务商，不引入 Cloudflare；
- `api.iamchatgpt.top` 的 A 记录指向 `107.175.95.166`；
- Caddy 负责公网 HTTPS 和反向代理；
- React Native Auth 回调使用 `fragmentarticle://auth/callback`；
- 创建非 root sudo 运维用户；
- 公网 SSH 迁移到 `2222`，仅允许密钥登录；
- 新 SSH 通道验证成功后才释放当前公网 `443`；
- Tailscale 暂时保留为可选运维回退；自动备份迁移到公网非 root SSH `2222`，不再依赖 Mac 持续运行 Tailscale；
- 继续使用现有开发 AI Key，不轮换，也不写入客户端；
- 当前仅供所有者本人使用，所有者账号建立后关闭公开注册。

## 3. 方案选择

### 采用：DNS 直连 Caddy

```text
React Native
    |
    | HTTPS 443
    v
api.iamchatgpt.top
    |
    v
Caddy
    |
    | 仅批准路径
    v
127.0.0.1:8000 Kong
    +-- /auth/v1/*
    +-- /rest/v1/*
    +-- /functions/v1/*
```

该方案组件少、故障边界清楚，也便于判断国内访问问题来自跨境链路还是应用本身。

### 暂不采用：Cloudflare 代理

Cloudflare 可以提供 WAF、隐藏源站和边缘限流，但会增加 SSE、WebSocket、缓存、上传大小和国内链路变量。真实用户规模出现后再单独评估。

### 不采用：立即删除 Tailscale

在公网入口刚上线时删除 Tailscale，会同时失去已验证的回退入口和备份通道。公网稳定后才能把“删除 Tailscale”作为独立变更执行。

## 4. 网络和服务边界

### 公网允许

| 端口 | 服务 | 说明 |
| --- | --- | --- |
| `80` | Caddy | ACME 校验和 HTTPS 跳转 |
| `443` | Caddy | App API HTTPS |
| `2222` | OpenSSH | 非 root、密钥登录 |

### 继续保持私有

- Kong 原始端口 `8000`；
- PostgreSQL `5432`；
- Supavisor `6543`；
- Studio、Meta 和数据库管理入口；
- Tailscale Supabase `:8443` 回退入口。

Caddy 不把整个 Kong 根路由直接暴露到公网。只允许 Auth、REST 和批准的 Functions 前缀，其余路径返回 `404`。这样 `https://api.iamchatgpt.top/` 不能打开 Studio。

当前未启用 Storage 和 Realtime，因此不开放 `/storage/v1/*` 与 `/realtime/v1/*`。

## 5. SSH 安全迁移

迁移必须保持可回滚顺序：

1. 创建非 root sudo 运维用户并安装现有 ed25519 公钥；
2. SSH 暂时同时监听 `443` 和 `2222`；
3. 防火墙放行 `2222`；
4. 从 Mac 建立一条全新的 `2222` 登录并验证 sudo；
5. 禁止 SSH 密码登录；
6. 限制公网只允许非 root 运维用户；
7. 禁止 SSH root 登录；
8. 把自动备份 alias 迁移到 `fragmentops@107.175.95.166:2222`，并验证 `sudo -n` 备份成功；
9. 再从 SSH 监听中移除 `443`；
10. 验证 `2222` 登录仍正常后，才启动 Caddy。

用户在对话中提供过的 root 密码不得进入文件、命令参数、日志或 Git。公网切换完成后需要轮换该密码，即使密码登录已经关闭。

## 6. TLS 和反向代理

Caddy 使用 `api.iamchatgpt.top` 自动申请并续期证书，反向代理到 `127.0.0.1:8000`。

代理规则需要：

- 保留 `Authorization` 和 `apikey` 请求头；
- 支持 SSE 流式响应，不对 AI 流式输出做响应缓冲；
- 限制异常大的请求体；
- 设置安全响应头；
- 不缓存 Auth、REST 或 Functions 响应；
- 对未批准路径返回 `404`；
- 不启用 Caddy 站点访问日志，避免 Auth 查询参数中的一次性 code 被记录；只保留 systemd 错误日志。

## 7. Supabase 和客户端配置

服务端：

```dotenv
SUPABASE_PUBLIC_URL=https://api.iamchatgpt.top
API_EXTERNAL_URL=https://api.iamchatgpt.top/auth/v1
SITE_URL=fragmentarticle://auth/callback
ADDITIONAL_REDIRECT_URLS=fragmentarticle://auth/callback,http://localhost:5174/**,http://localhost:5183/**,https://iamchatgpt.top/**,https://www.iamchatgpt.top/**
```

React Native：

```text
Supabase URL: https://api.iamchatgpt.top
Auth callback: fragmentarticle://auth/callback
```

客户端只能包含 Supabase anon key。AI Key、service-role key、JWT secret 和数据库密码只保留在 VPS。

本地 React 开发仍可使用 `/supabase-proxy`，但代理目标切换为公网域名后需要重新验证，不能同时把固定开发端口写回应用代码。

## 8. Auth 和滥用边界

当前环境没有正式 SMTP，且只供所有者本人使用：

1. 公网入口上线后先创建或确认所有者账号；
2. 验证 React Native 登录、session 恢复和退出；
3. 随即关闭公开注册；
4. 保留 RLS，所有业务数据继续按 `auth.uid()` 隔离；
5. `openai-proxy` 继续要求真实用户 JWT，并拒绝客户端上送 Key 或上游地址；
6. 公网 `content-extractor` 改为要求登录 session，避免匿名利用服务器抓取任意网页；
7. 外部用户开放前，必须增加 AI 每用户日额度、调用审计和 `429` 响应。

本阶段不以 Cloudflare 替代应用层认证和额度控制。

## 9. 部署与回滚

部署顺序：

1. 验证 DNS；
2. 创建运维用户并完成 SSH 双端口迁移；
3. 保存当前 Supabase `.env`、Compose 配置和 SSH 配置的受控备份；
4. 安装和配置 Caddy；
5. 更新 Supabase 公共 URL 与 Auth 回调；
6. 只重建受配置影响的服务；
7. 运行基础设施、数据库和客户端验收；
8. 创建所有者账号并关闭公开注册；
9. 保留 Tailscale 回退入口，观察后再决定是否移除。

回滚时：

- 停止 Caddy；
- 恢复 Supabase URL 配置；
- 继续使用 Tailscale `:8443`；
- 使用已经验证的 `2222` 运维入口修复；
- 不把 SSH 临时改回 `443`，除非 `2222` 本身故障且已确认不会与 Caddy 冲突。

## 10. 验收标准

### DNS 和 TLS

- `api.iamchatgpt.top` 解析到 VPS；
- 证书链和主机名校验通过；
- HTTP 自动跳转 HTTPS；
- TLS 自动续期配置正常。

### 网络隔离

- 公网只开放 `80/443/2222`；
- `8000/5432/6543` 公网不可达；
- API 根路径和 Studio 路径返回 `404`；
- Tailscale `:8443` 仍可用。

### Auth 和数据

- React Native deep link 回调正确；
- 登录、session 恢复、退出通过；
- 公开注册关闭后，新匿名注册被拒绝；
- RLS 双用户测试 6/6 通过并回滚；
- 19 条迁移记录和数据库 lint 正常。

### AI 和导入

- 未登录 AI 和网页提取返回 `401`；
- 登录用户非流式卡片生成成功；
- SSE 流式群聊或 Galgame 完整收到 `[DONE]`；
- 客户端提交 Key、上游地址或非法模型被拒绝；
- 网页导入、图片渲染和 PDF 本地解析回归通过；
- Caddy 与 Functions 日志没有 JWT、正文或 Key。

### 运维

- 新运维用户通过 `2222` 密钥登录并可 sudo；
- 公网 root 登录被拒绝；
- launchd 通过 `fragmentops:2222` 完成加密备份；
- 最新密文可通过 `pg_restore --list` 读取。

## 11. 本阶段不做

- Cloudflare 代理；
- 删除 Tailscale；
- Supabase Storage；
- 原始 PDF 上传；
- Realtime；
- RAG、embedding 和 pgvector；
- 面向外部用户的开放注册；
- 正式 Web 前端部署；
- 正式高额度 AI Key。
