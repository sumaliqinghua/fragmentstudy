# Supabase 私网部署运维说明

本目录用于在 RackNerd Ubuntu VPS 上部署固定版本的 Supabase 私网开发栈。第一阶段只启动：

```text
db auth rest meta studio kong functions supavisor
```

Realtime、Storage、imgproxy、Analytics 和 Vector 不会启动。Kong 的 `8000` 端口以及 Supavisor 的 `5432/6543` 端口只绑定 `127.0.0.1`，对外访问由 Tailscale Serve 提供。不要直接运行上游的 `run.sh start`。

## 目录约定

- 应用仓库：包含本目录和 `scripts/supabase/`；
- 默认安装根目录：`/opt/fragment-article/supabase`；
- 官方仓库：`/opt/fragment-article/supabase`，固定在 `self-hosted/v0.7.0`；
- 官方 Compose 目录：`/opt/fragment-article/supabase/docker`；
- 应用迁移副本：`/opt/fragment-article/supabase/project/supabase`。

所有脚本都可用最后一个路径参数覆盖默认安装根目录。脚本不会输出 `.env`、数据库密码、JWT、service-role key 或 AI Key。

## 首次准备

在应用仓库中执行：

```bash
sudo scripts/supabase/bootstrap-host.sh /opt/fragment-article/supabase
```

脚本会从 Docker 官方 Ubuntu 仓库安装 Docker Engine/Compose，克隆精确的 Supabase release，复制私网 Compose 覆盖，并调用官方密钥生成脚本。若安装目录已存在但不是同一 release，脚本会拒绝继续，不会覆盖数据库目录。

首次初始化时，脚本会自动把 `infra/supabase/.env.private.example` 对应的私网默认值写入服务器的 `docker/.env`。示例文件只是配置清单，不得用它覆盖官方 `.env`。在 `docker/.env` 中单独加入低额度开发用 `QINIU_API_KEY`，不要在终端回显它。

当前私网开发环境已经使用以下地址：

- VPS Tailscale IPv4：`100.84.96.100`；
- VPS MagicDNS：`racknerd-b4acd93.tail635b33.ts.net`；
- Supabase 私网入口：`https://racknerd-b4acd93.tail635b33.ts.net:8443`；
- Mac mini Tailscale IPv4：`100.98.139.90`。

Tailscale Serve 将 tailnet HTTPS `8443` 端口转发到回环网关：

```bash
tailscale serve --https=8443 --bg http://127.0.0.1:8000
```

获得 tailnet URL 后，将 `SUPABASE_PUBLIC_URL`、`API_EXTERNAL_URL` 和本地前端 `VITE_SUPABASE_URL` 更新为该 URL；`API_EXTERNAL_URL` 末尾保留 `/auth/v1`。

本地开发服务器使用 `VITE_SUPABASE_BROWSER_URL=/supabase-proxy`，由 Vite 按当前浏览器 origin 转发到上述 HTTPS 地址。这样浏览器不直接处理 tailnet 证书和跨域请求，前端构建仍只持有 Supabase 公共 URL 与 anon key；换用其他本地端口时不需要修改这个值。

## 同步、启动与迁移

只允许从干净且已提交的 Git revision 同步 Supabase 制品：

```bash
scripts/supabase/sync-project.sh "$PWD" /opt/fragment-article/supabase
sudo scripts/supabase/start-private.sh /opt/fragment-article/supabase
sudo scripts/supabase/verify-private.sh /opt/fragment-article/supabase
sudo scripts/supabase/apply-migrations.sh \
  /opt/fragment-article/supabase/project \
  /opt/fragment-article/supabase
```

`start-private.sh` 使用官方基础 Compose 和本目录的覆盖文件，显式启动服务白名单，并等待健康检查通过。`apply-migrations.sh` 使用 `supabase db push --include-all` 记录迁移历史；它不会逐个用 `psql` 手工重放 SQL。

每次修改 Functions 后重新同步并重建 Functions 容器：

```bash
sudo docker compose \
  --env-file /opt/fragment-article/supabase/docker/.env \
  -f /opt/fragment-article/supabase/docker/docker-compose.yml \
  -f /opt/fragment-article/supabase/docker/docker-compose.private.yml \
  up -d --wait --force-recreate --no-deps functions
```

## 验证

`verify-private.sh` 检查以下条件，任一失败都会非零退出：

- 8 个批准服务全部运行且健康（私有 Compose 显式固定 `meta` 的 `/health` 探测）；
- 5 个禁用服务没有容器残留；
- `8000/5432/6543` 只监听 `127.0.0.1`；
- 从本机访问 VPS 公网 IP 上的上述端口失败；
- `http://127.0.0.1:8000/auth/v1/health` 正常。

首次启动后还必须运行仓库中的 RLS 双用户测试和浏览器端到端验收。静态脚本不能代替这两项验证。

## 公网 App API

公网阶段使用 `api.theaimoment.com`，但继续保留 Tailscale `:8443` 作为回退入口。必须先验证非 root SSH `2222`，再释放 `443` 给 Caddy。公网只批准：

```text
/auth/v1/*
/rest/v1/*
/functions/v1/*
```

根路径、Studio、Meta、Storage、Realtime 和其他未知路径统一返回 `404`。Caddy 不启用站点访问日志，避免 Auth 查询参数中的一次性 code 被记录。

在 Ubuntu 上安装 Caddy：

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

安装已提交的策略并在启动前验证：

```bash
sudo install -m 0644 \
  infra/supabase/Caddyfile.public \
  /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
```

后续修改 Caddyfile 时，先验证再平滑重载，并从 systemd journal 检查错误：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 100 --no-pager
```

公网 URL 必须通过脚本写入官方 `.env`，脚本会先建立权限为 `0600` 的回滚副本，
并原样保留现有 `DISABLE_SIGNUP`，避免换域名时重新开放注册：

```bash
sudo scripts/supabase/configure-public-url.sh \
  https://api.theaimoment.com \
  fragmentarticle://auth/callback \
  'fragmentarticle://auth/callback,http://localhost:5174/**,http://localhost:5183/**,https://theaimoment.com/**,https://www.theaimoment.com/**' \
  /opt/fragment-article/supabase
```

部署后从 VPS 执行：

```bash
sudo scripts/supabase/verify-public.sh \
  api.theaimoment.com \
  107.175.95.166 \
  2222 \
  /opt/fragment-article/supabase
```

若 TLS 或路由验证失败，停止 Caddy 并继续使用 Tailscale：

```bash
sudo systemctl stop caddy
sudo systemctl disable caddy
```

从 `/opt/fragment-article/supabase/backups/public-rollout/` 选择本次部署前的 `.env` 备份恢复，然后只重建受影响的 `auth`、`studio` 和 `functions`。SSH 已迁到 `2222` 后不要因为 Caddy 故障自动改回 `443`。

## Mac 加密备份

Mac 安装 `age` 并生成身份文件后，通过公网非 root SSH 主动拉取备份：

```bash
scripts/supabase/backup-private.sh \
  fragmentarticle-backup \
  'age1...' \
  "$HOME/Backups/fragment-article/supabase" \
  /opt/fragment-article/supabase
```

数据库 dump 和配置归档从 SSH 流直接进入本机 `age`，不会在 Mac 落地明文。默认保留 14 个每日、8 个每周和 6 个月度副本。`com.fragmentarticle.supabase-backup.plist.example` 是 launchd 模板，安装前必须替换其中占位符并使用绝对路径。

备份脚本强制使用 SSH `BatchMode` 和远端 `sudo -n`，因此 launchd 不会停在密码提示上。公网迁移后，`~/.ssh/config` 中的 `fragmentarticle-backup` alias 指向 `fragmentops@107.175.95.166:2222`，使用现有 ed25519 密钥；自动备份不再依赖 Mac 上的 Tailscale 运行状态。本机 age 身份存放在 `~/.config/fragment-article/backup-age-key.txt`，权限必须保持为 `0600`，不得提交或复制到 VPS。

实际定时任务使用以下稳定路径，不依赖临时 Git worktree：

- 脚本：`~/.local/bin/fragmentarticle-supabase-backup`；
- LaunchAgent：`~/Library/LaunchAgents/com.fragmentarticle.supabase-backup.plist`；
- 备份目录：`~/Backups/fragment-article/supabase`；
- 每日时间：本机时间 `03:20`。

2026-07-18 的恢复演练从 `.age` 密文流恢复到临时数据库，验证得到 2 个 Auth 用户、1 篇业务资料、19 条迁移记录、17 张启用 RLS 的 public 表和 `auth.uid()` 函数，随后删除临时库。2026-07-26 公网切换后，LaunchAgent 通过 `fragmentops:2222` 再次退出码 `0`，快照 `20260725T161804Z` 包含三个密文文件；`database.dump.age` 直接流式解密到 PostgreSQL 17.6 的 `pg_restore --list`，得到 651 行可读目录且未在磁盘落明文。恢复必须使用镜像中的 `supabase_admin`；`postgres` 在该固定镜像中不是 superuser，会在恢复 `vault.secrets` 时被拒绝。

备份完成不等于可恢复。每月至少一次将 dump 恢复到临时 PostgreSQL，检查 Auth、业务表、迁移历史和 RLS。

## 2026-07-21 私网验收记录

已通过：

- 8 个批准容器健康，5 个禁用服务缺席，`8000/5432/6543` 仅监听回环；
- 19 条迁移已记录，数据库 lint 通过，RLS 双用户隔离测试 6/6 通过；
- 匿名 `openai-proxy` 返回 `401`；
- 登录用户通过 VPS Function 完成非流式卡片生成和 SSE 流式生成；无效模型和客户端提交 API Key 均被拒绝，日志未泄露 Key、JWT 或正文；
- 携带登录用户 token 直接调用 VPS `content-extractor` 返回 `200`，MDN 正文响应 9288 字节；
- 登录用户的浏览器链接导入调用 VPS `content-extractor`，错误直接显示；仅未登录访客收到 `401` 后才降级 Jina 并显示提示。掘金文章的 26 张图片均以真实 `<img>` 渲染，不再泄漏图片占位 token；
- 浏览器导入带文本层 PDF 和扫描 PDF 均完成提取/OCR；网络记录确认没有 PDF 上传、Storage 或 Function 写入请求；
- 注册自动确认、退出、重新登录、刷新恢复和登录用户资料持久化通过；
- 首页重复远程用户校验已移除，实测重载约 3.3 秒、个人页同步约 2.4 秒；
- Mac 加密备份、两次 launchd 触发和 `supabase_admin` 临时恢复演练通过；当前继续使用 `.env` 中已有开发 Key，不更换 Key。

## 2026-07-26 公网验收记录

部署 revision：

```text
Functions/备份加固: 539e23c209c5247c1870cbe6ea2ffea550b43d87
中性域名迁移: df5afc1ad8ea7efcf80b2b1e7dc62f52b2a42a79
```

已通过：

- SSH 只监听 `2222`，仅 `fragmentops` 可用 ed25519 公钥登录并执行 `sudo -n`；root 和密码登录均被拒绝；
- UFW 默认拒绝入站，仅放行公网 `80/443/2222` 和 Tailscale 回滚接口；
- `api.theaimoment.com` 从 VPS 和当前国内 Mac 网络均可达，Caddy `2.11.4` 与 Let's Encrypt 证书有效，只代理 Auth、REST 和 Functions；根路径与 Studio 返回 `404`；
- `auth`、`studio`、`functions` 只按需重建，8 个批准容器健康，5 个禁用服务缺席；
- 匿名 `openai-proxy` 与 `content-extractor` 返回 `401`；
- 临时登录账号完成 RLS REST、网页提取、非流式 AI 和 SSE `[DONE]`；非法模型和客户端自带 Key 返回 `400`，账号随后删除；
- 数据库只有 1 个正式 owner；2026-07-26 已将无业务数据的验收用户原地替换，owner 密码登录返回 `200`，公开注册保持关闭并返回 `422`；
- 19 条迁移无待应用项，数据库 lint 零错误，RLS `6/6` 通过后回滚；
- root recovery password 已轮换，新值仅存于 macOS Keychain 服务 `fragmentarticle-racknerd-root-recovery`。
- Supabase owner 密码仅存于 macOS Keychain 服务 `fragmentarticle-supabase-owner`，仓库和服务器文档均不记录明文。

旧域名事件：VPS 本机和 Let's Encrypt 验证节点访问
`api.iamchatgpt.top` 正常，但当前中国大陆网络会在请求到达 Caddy 前重置
该域名的 HTTP Host 和 TLS SNI；同一 IP 的 TCP 与中性 SNI 可达。Cloudflare
代理不会隐藏客户端可见的 SNI，因此不能作为可靠修复。2026-07-26 已迁移到
`api.theaimoment.com`，Mac `.env.local` 与 Vite 代理已切换并通过 Auth health、
匿名 Function 拒绝和页面加载验收。Tailscale 私网 URL 继续作为回滚入口。

## 已明确延期的事项

- SMTP、邮箱确认和密码找回；
- 数据库级 AI 日额度、调用审计和 `429`；
- 网页提取的公网 IP 限流及完整 SSRF 回归；
- 正式平台 AI Key；
- Supabase Storage、原始 PDF 存储、RAG 和向量索引。

后续升级 Supabase 镜像时必须重新验证恢复角色和完整恢复流程。当前继续
使用 `.env` 中已有的开发 AI Key，不更换 Key，也不把它下发到客户端。
