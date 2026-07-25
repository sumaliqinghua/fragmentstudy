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

公网阶段使用 `api.iamchatgpt.top`，但继续保留 Tailscale `:8443` 作为回退入口。必须先验证非 root SSH `2222`，再释放 `443` 给 Caddy。公网只批准：

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

公网 URL 必须通过脚本写入官方 `.env`，脚本会先建立权限为 `0600` 的回滚副本：

```bash
sudo scripts/supabase/configure-public-url.sh \
  https://api.iamchatgpt.top \
  fragmentarticle://auth/callback \
  'fragmentarticle://auth/callback,http://localhost:5174/**,http://localhost:5183/**,https://iamchatgpt.top/**,https://www.iamchatgpt.top/**' \
  /opt/fragment-article/supabase
```

部署后从 VPS 执行：

```bash
sudo scripts/supabase/verify-public.sh \
  api.iamchatgpt.top \
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

Mac 安装 `age` 并生成身份文件后，通过 Tailscale 主动拉取备份：

```bash
scripts/supabase/backup-private.sh \
  fragmentarticle-backup \
  'age1...' \
  "$HOME/Backups/fragment-article/supabase" \
  /opt/fragment-article/supabase
```

数据库 dump 和配置归档从 SSH 流直接进入本机 `age`，不会在 Mac 落地明文。默认保留 14 个每日、8 个每周和 6 个月度副本。`com.fragmentarticle.supabase-backup.plist.example` 是 launchd 模板，安装前必须替换其中占位符并使用绝对路径。

备份脚本强制使用 SSH `BatchMode`，因此 launchd 不会停在密码提示上。当前 Mac 通过 `~/.ssh/config` 中的 `fragmentarticle-backup` alias，经 Tailscale IPv4 `100.84.96.100:443` 使用现有 ed25519 密钥非交互连接 VPS；这里使用标准 OpenSSH 通道，不依赖会触发网页复核的 Tailscale SSH。本机 age 身份存放在 `~/.config/fragment-article/backup-age-key.txt`，权限必须保持为 `0600`，不得提交或复制到 VPS。

实际定时任务使用以下稳定路径，不依赖临时 Git worktree：

- 脚本：`~/.local/bin/fragmentarticle-supabase-backup`；
- LaunchAgent：`~/Library/LaunchAgents/com.fragmentarticle.supabase-backup.plist`；
- 备份目录：`~/Backups/fragment-article/supabase`；
- 每日时间：本机时间 `03:20`。

2026-07-18 的恢复演练从 `.age` 密文流恢复到临时数据库，验证得到 2 个 Auth 用户、1 篇业务资料、19 条迁移记录、17 张启用 RLS 的 public 表和 `auth.uid()` 函数，随后删除临时库。2026-07-21 又通过当前 `fragmentarticle-backup` 通道触发了两次 launchd 备份，均退出码为 0，并生成包含三个密文文件的新快照；最新 `database.dump.age` 解密后由远端 PostgreSQL 17.6 `pg_restore --list` 成功读取 643 个 TOC 条目。恢复必须使用镜像中的 `supabase_admin`；`postgres` 在该固定镜像中不是 superuser，会在恢复 `vault.secrets` 时被拒绝。

备份完成不等于可恢复。每月至少一次将 dump 恢复到临时 PostgreSQL，检查 Auth、业务表、迁移历史和 RLS。

## 2026-07-21 私网验收记录

已通过：

- 8 个批准容器健康，5 个禁用服务缺席，`8000/5432/6543` 仅监听回环；
- 19 条迁移已记录，数据库 lint 通过，RLS 双用户隔离测试 6/6 通过；
- 匿名 `openai-proxy` 返回 `401`；
- 登录用户通过 VPS Function 完成非流式卡片生成和 SSE 流式生成；无效模型和客户端提交 API Key 均被拒绝，日志未泄露 Key、JWT 或正文；
- 直接调用 VPS `content-extractor` 返回 `200`，MDN 正文响应 9288 字节；
- 浏览器链接导入优先调用 VPS `content-extractor`，失败时才降级 Jina，并向用户显示降级提示；掘金文章的 26 张图片均以真实 `<img>` 渲染，不再泄漏图片占位 token；
- 浏览器导入带文本层 PDF 和扫描 PDF 均完成提取/OCR；网络记录确认没有 PDF 上传、Storage 或 Function 写入请求；
- 注册自动确认、退出、重新登录、刷新恢复和登录用户资料持久化通过；
- 首页重复远程用户校验已移除，实测重载约 3.3 秒、个人页同步约 2.4 秒；
- Mac 加密备份、两次 launchd 触发和 `supabase_admin` 临时恢复演练通过；当前继续使用 `.env` 中已有开发 Key，不更换 Key。

## 已明确延期的事项

以下事项在私网开发阶段不执行，但属于公网发布阻断项：

- 创建非 root sudo 用户、轮换已暴露密码、关闭 root 密码登录；
- 从公网 `443` 移除 SSH；
- DNS、Caddy 和正式 HTTPS；
- SMTP、邮箱确认和密码找回；
- 数据库级 AI 日额度与调用审计；
- 网页提取的公网 IP 限流及完整 SSRF 回归；
- 正式平台 AI Key；
- Supabase Storage、原始 PDF 存储、RAG 和向量索引。

自动备份调度、一次手动备份、两次 launchd 触发备份、密文目录检查和临时恢复演练已经完成。后续升级 Supabase 镜像时必须重新验证恢复角色和完整恢复流程。

私网开发阶段继续使用当前开发 Key；不要在登录加固前放置正式 Key 或真实用户数据。
