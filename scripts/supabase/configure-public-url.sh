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

TEMP_FILE="$(mktemp "$ENV_FILE.tmp.XXXXXX")"
cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT

awk \
  -v public_url="$PUBLIC_BASE_URL" \
  -v api_url="$PUBLIC_BASE_URL/auth/v1" \
  -v site_url="$SITE_URL" \
  -v redirects="$REDIRECTS" \
  '
  BEGIN {
    order[1] = "SUPABASE_PUBLIC_URL"
    order[2] = "API_EXTERNAL_URL"
    order[3] = "SITE_URL"
    order[4] = "ADDITIONAL_REDIRECT_URLS"
    values[order[1]] = public_url
    values[order[2]] = api_url
    values[order[3]] = site_url
    values[order[4]] = redirects
  }
  {
    separator = index($0, "=")
    key = separator > 0 ? substr($0, 1, separator - 1) : ""
    if (key in values) {
      if (!seen[key]) print key "=" values[key]
      seen[key] = 1
      next
    }
    print
  }
  END {
    for (position = 1; position <= 4; position += 1) {
      key = order[position]
      if (!seen[key]) print key "=" values[key]
    }
  }
  ' "$ENV_FILE" > "$TEMP_FILE"

chmod 0600 "$TEMP_FILE"
mv "$TEMP_FILE" "$ENV_FILE"
trap - EXIT

printf '公网 URL 配置已写入，备份位于 %s\n' "$BACKUP_FILE"
