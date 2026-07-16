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

Tailscale Serve 建议将 tailnet HTTPS 地址转发到回环网关：

```bash
tailscale serve --bg http://127.0.0.1:8000
```

获得 tailnet URL 后，将 `SUPABASE_PUBLIC_URL`、`API_EXTERNAL_URL` 和本地前端 `VITE_SUPABASE_URL` 更新为该 URL；`API_EXTERNAL_URL` 末尾保留 `/auth/v1`。

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

- 8 个批准服务全部运行且健康；
- 5 个禁用服务没有容器残留；
- `8000/5432/6543` 只监听 `127.0.0.1`；
- 从本机访问 VPS 公网 IP 上的上述端口失败；
- `http://127.0.0.1:8000/auth/v1/health` 正常。

首次启动后还必须运行仓库中的 RLS 双用户测试和浏览器端到端验收。静态脚本不能代替这两项验证。

## Mac 加密备份

Mac 安装 `age` 并生成身份文件后，通过 Tailscale 主动拉取备份：

```bash
scripts/supabase/backup-private.sh \
  root@racknerd-b4acd93 \
  'age1...' \
  "$HOME/Backups/fragment-article/supabase" \
  /opt/fragment-article/supabase
```

数据库 dump 和配置归档从 SSH 流直接进入本机 `age`，不会在 Mac 落地明文。默认保留 14 个每日、8 个每周和 6 个月度副本。`com.fragmentarticle.supabase-backup.plist.example` 是 launchd 模板，安装前必须替换其中占位符并使用绝对路径。

备份脚本强制使用 SSH `BatchMode`，因此 launchd 不会停在密码提示上。当前若仍只有 root 密码登录，先保留脚本和 plist 制品，不加载定时任务；等 Tailscale SSH 或独立的非交互备份密钥可用后再启用。不要把 VPS 密码写入 plist、脚本或钥匙串命令参数。

备份完成不等于可恢复。每月至少一次将 dump 恢复到临时 PostgreSQL，检查 Auth、业务表、迁移历史和 RLS。

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

此外，自动备份调度依赖非交互 SSH。若私网阶段继续使用密码登录，则“定时备份已安装”和“恢复演练通过”仍是待执行项，不能在验收记录中标记为完成。

私网阶段允许使用低额度临时 AI Key，但不要在登录加固前放置正式 Key 或真实用户数据。
