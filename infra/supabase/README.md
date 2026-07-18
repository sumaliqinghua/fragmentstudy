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

本地开发服务器使用 `VITE_SUPABASE_BROWSER_URL=http://127.0.0.1:5182/supabase-proxy`，由 Vite 转发到上述 HTTPS 地址。这样浏览器不直接处理 tailnet 证书和跨域请求，前端构建仍只持有 Supabase 公共 URL 与 anon key。

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

## Mac 加密备份

Mac 安装 `age` 并生成身份文件后，通过 Tailscale 主动拉取备份：

```bash
scripts/supabase/backup-private.sh \
  root@100.84.96.100 \
  'age1...' \
  "$HOME/Backups/fragment-article/supabase" \
  /opt/fragment-article/supabase
```

数据库 dump 和配置归档从 SSH 流直接进入本机 `age`，不会在 Mac 落地明文。默认保留 14 个每日、8 个每周和 6 个月度副本。`com.fragmentarticle.supabase-backup.plist.example` 是 launchd 模板，安装前必须替换其中占位符并使用绝对路径。

备份脚本强制使用 SSH `BatchMode`，因此 launchd 不会停在密码提示上。当前 Mac 已能通过 Tailscale SSH 非交互连接 `root@100.84.96.100`。本机 age 身份存放在 `~/.config/fragment-article/backup-age-key.txt`，权限必须保持为 `0600`，不得提交或复制到 VPS。

实际定时任务使用以下稳定路径，不依赖临时 Git worktree：

- 脚本：`~/.local/bin/fragmentarticle-supabase-backup`；
- LaunchAgent：`~/Library/LaunchAgents/com.fragmentarticle.supabase-backup.plist`；
- 备份目录：`~/Backups/fragment-article/supabase`；
- 每日时间：本机时间 `03:20`。

2026-07-18 的恢复演练从 `.age` 密文流恢复到临时数据库，验证得到 2 个 Auth 用户、1 篇业务资料、19 条迁移记录、17 张启用 RLS 的 public 表和 `auth.uid()` 函数，随后删除临时库。恢复必须使用镜像中的 `supabase_admin`；`postgres` 在该固定镜像中不是 superuser，会在恢复 `vault.secrets` 时被拒绝。

备份完成不等于可恢复。每月至少一次将 dump 恢复到临时 PostgreSQL，检查 Auth、业务表、迁移历史和 RLS。

## 2026-07-18 私网验收记录

已通过：

- 8 个批准容器健康，5 个禁用服务缺席，`8000/5432/6543` 仅监听回环；
- 19 条迁移已记录，数据库 lint 通过，RLS 双用户隔离测试 6/6 通过；
- 匿名 `openai-proxy` 返回 `401`；
- 直接调用 VPS `content-extractor` 返回 `200`，MDN 正文响应 9288 字节；
- 注册自动确认、退出、重新登录、刷新恢复和登录用户资料持久化通过；
- 首页重复远程用户校验已移除，实测重载约 3.3 秒、个人页同步约 2.4 秒；
- Mac 加密备份、launchd 触发和 `supabase_admin` 临时恢复演练通过。

仍未通过：

- VPS 没有配置低额度 `QINIU_API_KEY`，所以真实卡片生成和流式 AI 调用未执行；
- 开发页面的链接导入仍按现有策略直接使用 Jina Reader；VPS Function 已单独验证，但浏览器生产路径尚未验收；
- PDF 只在浏览器解析且不上传的行为尚未做真实文件验收。

以上三项不能在最终私网产品验收中标记为完成。

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

自动备份调度、一次手动备份、一次 launchd 触发备份和临时恢复演练已经完成。后续升级 Supabase 镜像时必须重新验证恢复角色和完整恢复流程。

私网阶段允许使用低额度临时 AI Key，但不要在登录加固前放置正式 Key 或真实用户数据。
