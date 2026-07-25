#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"

PUBLIC_BASE_URL="${1:-}"
SITE_URL="${2:-}"
REDIRECTS="${3:-}"
INSTALL_ROOT="${4:-$DEFAULT_INSTALL_ROOT}"
ENV_FILE="$INSTALL_ROOT/docker/.env"
BACKUP_ROOT="$INSTALL_ROOT/backups/public-rollout"

fail() {
  printf '公网 URL 配置失败: %s\n' "$*" >&2
  exit 1
}

[[ $# -ge 3 && $# -le 4 ]] \
  || fail "用法: $0 <HTTPS根地址> <App回调地址> <重定向列表> [安装根目录]"
[[ "$PUBLIC_BASE_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] \
  || fail "公开地址必须是无路径的 HTTPS 根地址"
[[ "$SITE_URL" == "fragmentarticle://auth/callback" ]] \
  || fail "App 回调地址必须是 fragmentarticle://auth/callback"
[[ "$PUBLIC_BASE_URL" != *$'\n'* && "$SITE_URL" != *$'\n'* && "$REDIRECTS" != *$'\n'* ]] \
  || fail "配置值不能包含换行符"
[[ ",$REDIRECTS," == *",$SITE_URL,"* ]] \
  || fail "重定向列表必须包含 App 回调地址"
[[ "$INSTALL_ROOT" == /* ]] || fail "安装根目录必须是绝对路径"
[[ -f "$ENV_FILE" ]] || fail "缺少官方 docker/.env"
command -v awk >/dev/null 2>&1 || fail "缺少 awk"
command -v mktemp >/dev/null 2>&1 || fail "缺少 mktemp"

mkdir -p "$BACKUP_ROOT"
chmod 0700 "$BACKUP_ROOT"
BACKUP_FILE="$BACKUP_ROOT/docker.env.$(date -u '+%Y%m%dT%H%M%SZ').bak"
cp -p "$ENV_FILE" "$BACKUP_FILE"
chmod 0600 "$BACKUP_FILE"

set_env_value() {
  local key="$1"
  local value="$2"
  local temp_file

  temp_file="$(mktemp "$ENV_FILE.tmp.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      if (!replaced) print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) print key "=" value
    }
  ' "$ENV_FILE" > "$temp_file"
  chmod 0600 "$temp_file"
  mv "$temp_file" "$ENV_FILE"
}

set_env_value SUPABASE_PUBLIC_URL "$PUBLIC_BASE_URL"
set_env_value API_EXTERNAL_URL "$PUBLIC_BASE_URL/auth/v1"
set_env_value SITE_URL "$SITE_URL"
set_env_value ADDITIONAL_REDIRECT_URLS "$REDIRECTS"
set_env_value DISABLE_SIGNUP false

printf '公网 URL 配置已写入，备份位于 %s\n' "$BACKUP_FILE"
