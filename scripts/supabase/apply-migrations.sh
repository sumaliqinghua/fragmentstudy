#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ROOT="${1:-$DEFAULT_INSTALL_ROOT/project}"
INSTALL_ROOT="${2:-$DEFAULT_INSTALL_ROOT}"
STACK_DIR="$INSTALL_ROOT/docker"
VERSION_FILE="$REPOSITORY_ROOT/infra/supabase/VERSION"

fail() {
  printf '错误: %s\n' "$*" >&2
  exit 1
}

[[ $# -le 2 ]] || fail "用法: $0 [已同步项目目录] [安装根目录]"
[[ "$PROJECT_ROOT" == /* && "$INSTALL_ROOT" == /* ]] || fail "目录参数必须是绝对路径"
command -v supabase >/dev/null 2>&1 || fail "未安装 Supabase CLI"
[[ -d "$PROJECT_ROOT/supabase/migrations" ]] || fail "缺少已同步 migrations"
[[ -f "$STACK_DIR/.env" ]] || fail "缺少官方 .env"

RELEASE="$(tr -d '\r\n' < "$VERSION_FILE")"
ACTUAL_RELEASE="$(git -C "$INSTALL_ROOT" describe --tags --exact-match HEAD 2>/dev/null || true)"
[[ "$RELEASE" == "self-hosted/v0.7.0" && "$ACTUAL_RELEASE" == "$RELEASE" ]] \
  || fail "安装目录 release 不匹配"

read_env_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      sub(/\r$/, "", value)
      print value
      exit
    }
  ' "$STACK_DIR/.env"
}

POSTGRES_PASSWORD="$(read_env_value POSTGRES_PASSWORD)"
POSTGRES_DB="$(read_env_value POSTGRES_DB)"
POOLER_TENANT_ID="$(read_env_value POOLER_TENANT_ID)"
POSTGRES_PORT="$(read_env_value POSTGRES_PORT)"

[[ -n "$POSTGRES_PASSWORD" ]] || fail "docker/.env 缺少 POSTGRES_PASSWORD"
[[ -n "$POSTGRES_DB" ]] || fail "docker/.env 缺少 POSTGRES_DB"
[[ -n "$POOLER_TENANT_ID" && "$POOLER_TENANT_ID" != "your-tenant-id" ]] \
  || fail "docker/.env 的 POOLER_TENANT_ID 尚未生成"
[[ "$POSTGRES_PORT" =~ ^[0-9]+$ ]] || fail "docker/.env 的 POSTGRES_PORT 无效"

ENCODED_PASSWORD="$(printf '%s' "$POSTGRES_PASSWORD" | jq -sRr @uri)"
DB_URL="postgresql://postgres.${POOLER_TENANT_ID}:${ENCODED_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"
CLI_WORKDIR="$(mktemp -d)"

cleanup() {
  unset DB_URL ENCODED_PASSWORD POSTGRES_PASSWORD
  rm -rf "$CLI_WORKDIR"
}
trap cleanup EXIT

# CLI 2.72.7 drops sslmode from --db-url. Matching the configured local port
# selects its explicit no-TLS connection path without changing project defaults.
supabase init --workdir "$CLI_WORKDIR" --force >/dev/null
sed -i "s/^port = 54322$/port = ${POSTGRES_PORT}/" "$CLI_WORKDIR/supabase/config.toml"
cp -R "$PROJECT_ROOT/supabase/migrations" "$CLI_WORKDIR/supabase/"

(
  cd "$CLI_WORKDIR"
  supabase db push --include-all --db-url "$DB_URL" --yes
  supabase db lint --db-url "$DB_URL"
)

printf '迁移已通过 Supabase CLI 应用并完成数据库 lint。\n'
