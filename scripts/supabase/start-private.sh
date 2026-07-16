#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"
readonly APPROVED_SERVICES=(db auth rest meta studio kong functions supavisor)
readonly DISABLED_SERVICES=(realtime storage imgproxy analytics vector)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_ROOT="${1:-$DEFAULT_INSTALL_ROOT}"
STACK_DIR="$INSTALL_ROOT/docker"
VERSION_FILE="$PROJECT_ROOT/infra/supabase/VERSION"

fail() {
  printf '错误: %s\n' "$*" >&2
  exit 1
}

[[ $# -le 1 ]] || fail "用法: $0 [安装根目录]"
[[ "$INSTALL_ROOT" == /* ]] || fail "安装根目录必须是绝对路径"
[[ -f "$VERSION_FILE" ]] || fail "缺少版本文件"

RELEASE="$(tr -d '\r\n' < "$VERSION_FILE")"
ACTUAL_RELEASE="$(git -C "$INSTALL_ROOT" describe --tags --exact-match HEAD 2>/dev/null || true)"
[[ "$RELEASE" == "self-hosted/v0.7.0" && "$ACTUAL_RELEASE" == "$RELEASE" ]] \
  || fail "安装目录必须固定在 self-hosted/v0.7.0"
[[ -f "$STACK_DIR/.env" ]] || fail "缺少 $STACK_DIR/.env"
[[ -f "$STACK_DIR/docker-compose.private.yml" ]] || fail "缺少私网 Compose 覆盖"

compose=(docker compose
  --env-file "$STACK_DIR/.env"
  -f "$STACK_DIR/docker-compose.yml"
  -f "$STACK_DIR/docker-compose.private.yml")

"${compose[@]}" config --quiet

configured_services="$("${compose[@]}" config --services)"
for service in "${APPROVED_SERVICES[@]}"; do
  grep -qx "$service" <<< "$configured_services" || fail "Compose 缺少服务: $service"
done

# Remove containers from earlier unrestricted starts before bringing up the allowlist.
configured_disabled_services=()
for service in "${DISABLED_SERVICES[@]}"; do
  if grep -qx "$service" <<< "$configured_services"; then
    configured_disabled_services+=("$service")
  fi
done
if (( ${#configured_disabled_services[@]} > 0 )); then
  "${compose[@]}" rm -sf "${configured_disabled_services[@]}" >/dev/null
fi
"${compose[@]}" up -d --wait --wait-timeout 300 "${APPROVED_SERVICES[@]}"

printf '私网 Supabase 服务白名单已启动并通过 Compose 健康等待。\n'
