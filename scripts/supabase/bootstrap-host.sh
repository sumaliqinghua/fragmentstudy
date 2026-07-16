#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"
readonly UPSTREAM_REPOSITORY="https://github.com/supabase/supabase.git"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_ROOT="${1:-$DEFAULT_INSTALL_ROOT}"
VERSION_FILE="$PROJECT_ROOT/infra/supabase/VERSION"

fail() {
  printf '错误: %s\n' "$*" >&2
  exit 1
}

[[ $# -le 1 ]] || fail "用法: $0 [安装根目录]"
[[ "$INSTALL_ROOT" == /* ]] || fail "安装根目录必须是绝对路径"
[[ -f "$VERSION_FILE" ]] || fail "缺少版本文件: $VERSION_FILE"

RELEASE="$(tr -d '\r\n' < "$VERSION_FILE")"
[[ "$RELEASE" == "self-hosted/v0.7.0" ]] || fail "不允许部署未固定的 release: $RELEASE"
[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "请使用 sudo 运行此脚本"
[[ -r /etc/os-release ]] || fail "无法识别操作系统"

# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "仅支持 Ubuntu，当前系统为 ${ID:-unknown}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git gnupg jq netcat-openbsd openssl rsync

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker info >/dev/null

if [[ -e "$INSTALL_ROOT" ]]; then
  [[ -d "$INSTALL_ROOT/.git" ]] || fail "安装目录已存在且不是 Supabase Git 仓库: $INSTALL_ROOT"
  ACTUAL_RELEASE="$(git -C "$INSTALL_ROOT" describe --tags --exact-match HEAD 2>/dev/null || true)"
  [[ "$ACTUAL_RELEASE" == "$RELEASE" ]] || fail "安装目录 release 为 ${ACTUAL_RELEASE:-unknown}，预期 $RELEASE"
  git -C "$INSTALL_ROOT" diff --quiet -- docker/docker-compose.yml \
    || fail "官方 docker-compose.yml 已被修改，请先人工审查"
else
  install -d -m 0755 "$(dirname "$INSTALL_ROOT")"
  git clone --depth 1 --branch "$RELEASE" "$UPSTREAM_REPOSITORY" "$INSTALL_ROOT"
fi

STACK_DIR="$INSTALL_ROOT/docker"
[[ -f "$STACK_DIR/docker-compose.yml" ]] || fail "官方 Compose 文件不存在"

install -m 0644 "$PROJECT_ROOT/infra/supabase/docker-compose.private.yml" \
  "$STACK_DIR/docker-compose.private.yml"
install -m 0644 "$PROJECT_ROOT/infra/supabase/.env.private.example" \
  "$STACK_DIR/.env.private.example"

if [[ ! -f "$STACK_DIR/.env" ]]; then
  NEW_ENV=true
  install -m 0600 "$STACK_DIR/.env.example" "$STACK_DIR/.env"
  (
    cd "$STACK_DIR"
    sh utils/generate-keys.sh --update-env >/dev/null 2>&1
    sh utils/add-new-auth-keys.sh --update-env >/dev/null 2>&1
    rm -f .env.old docker-compose.yml.old
  )
  git -C "$INSTALL_ROOT" checkout -- docker/docker-compose.yml
else
  NEW_ENV=false
  chmod 0600 "$STACK_DIR/.env"
fi

set_env_value() {
  local key="$1"
  local value="$2"
  local target="$3"
  local temporary

  temporary="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$target" > "$temporary"
  install -m 0600 "$temporary" "$target"
  rm -f "$temporary"
}

if [[ "$NEW_ENV" == true ]]; then
  set_env_value POOLER_TENANT_ID "$(openssl rand -hex 8)" "$STACK_DIR/.env"
  set_env_value SUPABASE_PUBLIC_URL "http://127.0.0.1:8000" "$STACK_DIR/.env"
  set_env_value API_EXTERNAL_URL "http://127.0.0.1:8000/auth/v1" "$STACK_DIR/.env"
  set_env_value SITE_URL "http://localhost:5174" "$STACK_DIR/.env"
  set_env_value ADDITIONAL_REDIRECT_URLS "http://localhost:5174/**" "$STACK_DIR/.env"
  set_env_value DISABLE_SIGNUP "false" "$STACK_DIR/.env"
  set_env_value ENABLE_EMAIL_SIGNUP "true" "$STACK_DIR/.env"
  set_env_value ENABLE_EMAIL_AUTOCONFIRM "true" "$STACK_DIR/.env"
  set_env_value ENABLE_ANONYMOUS_USERS "false" "$STACK_DIR/.env"
  set_env_value ENABLE_PHONE_SIGNUP "false" "$STACK_DIR/.env"
  set_env_value ENABLE_PHONE_AUTOCONFIRM "false" "$STACK_DIR/.env"
  set_env_value FUNCTIONS_VERIFY_JWT "false" "$STACK_DIR/.env"
  set_env_value QINIU_API_ENDPOINT "https://api.qnaigc.com/v1" "$STACK_DIR/.env"
  set_env_value QINIU_MODEL "qwen/qwen3.7-plus" "$STACK_DIR/.env"
fi

# --quiet prevents resolved environment values from being printed.
docker compose \
  --env-file "$STACK_DIR/.env" \
  -f "$STACK_DIR/docker-compose.yml" \
  -f "$STACK_DIR/docker-compose.private.yml" \
  config --quiet \
  || fail "Compose 不支持当前 !override 配置，请升级 Docker Compose"

if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
  usermod -aG docker "$SUDO_USER"
  chown -R "$SUDO_USER":"$(id -gn "$SUDO_USER")" "$INSTALL_ROOT"
  printf '已将 %s 加入 docker 组；重新登录 SSH 后组权限生效。\n' "$SUDO_USER"
fi

printf 'Supabase %s 已准备在 %s。\n' "$RELEASE" "$INSTALL_ROOT"
printf '下一步：安全写入低额度 QINIU_API_KEY，再运行 sync-project.sh。\n'
