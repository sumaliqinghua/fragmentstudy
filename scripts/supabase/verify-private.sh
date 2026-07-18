#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"
readonly APPROVED_SERVICES=(db auth rest meta studio kong functions supavisor)
readonly DISABLED_SERVICES=(realtime storage imgproxy analytics vector)
readonly LOOPBACK_PORTS=(8000 5432 6543)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_ROOT="${1:-$DEFAULT_INSTALL_ROOT}"
PUBLIC_IP="${2:-}"
STACK_DIR="$INSTALL_ROOT/docker"
VERSION_FILE="$PROJECT_ROOT/infra/supabase/VERSION"

fail() {
  printf '验证失败: %s\n' "$*" >&2
  exit 1
}

[[ $# -le 2 ]] || fail "用法: $0 [安装根目录] [VPS 公网 IPv4]"
[[ "$INSTALL_ROOT" == /* ]] || fail "安装根目录必须是绝对路径"
command -v docker >/dev/null 2>&1 || fail "未安装 Docker"
command -v ss >/dev/null 2>&1 || fail "缺少 ss 命令"
command -v nc >/dev/null 2>&1 || fail "缺少 nc 命令"

RELEASE="$(tr -d '\r\n' < "$VERSION_FILE")"
ACTUAL_RELEASE="$(git -C "$INSTALL_ROOT" describe --tags --exact-match HEAD 2>/dev/null || true)"
[[ "$RELEASE" == "self-hosted/v0.7.0" && "$ACTUAL_RELEASE" == "$RELEASE" ]] \
  || fail "安装目录 release 不匹配"
[[ -f "$STACK_DIR/.env" && -f "$STACK_DIR/docker-compose.private.yml" ]] \
  || fail "部署配置不完整"

compose=(docker compose
  --env-file "$STACK_DIR/.env"
  -f "$STACK_DIR/docker-compose.yml"
  -f "$STACK_DIR/docker-compose.private.yml")

"${compose[@]}" config --quiet

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

for service in "${APPROVED_SERVICES[@]}"; do
  container_id="$("${compose[@]}" ps -q "$service")"
  [[ -n "$container_id" ]] || fail "$service 没有运行容器"
  state="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id")"
  [[ "$state" == "running healthy" ]] || fail "$service 状态为 $state"
done

for service in "${DISABLED_SERVICES[@]}"; do
  container_id="$("${compose[@]}" ps -aq "$service" 2>/dev/null || true)"
  [[ -z "$container_id" ]] || fail "禁用服务 $service 仍有容器残留"
done

for port in "${LOOPBACK_PORTS[@]}"; do
  listeners="$(ss -H -lnt "sport = :$port" | awk '{print $4}')"
  [[ -n "$listeners" ]] || fail "端口 $port 没有监听"
  while IFS= read -r listener; do
    [[ "$listener" == "127.0.0.1:$port" ]] \
      || fail "端口 $port 非回环监听: $listener"
  done <<< "$listeners"
done

if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}')"
fi
[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail "无法确定 VPS 公网 IPv4，请作为第二个参数传入"
[[ "$PUBLIC_IP" != 127.* ]] || fail "公网 IPv4 不能是回环地址"

for port in "${LOOPBACK_PORTS[@]}"; do
  if nc -z -w 2 "$PUBLIC_IP" "$port" >/dev/null 2>&1; then
    fail "公网 $PUBLIC_IP:$port 可以建立连接"
  fi
done

ANON_KEY="$(read_env_value ANON_KEY)"
[[ -n "$ANON_KEY" ]] || fail "docker/.env 缺少 ANON_KEY"
curl --fail --silent --show-error --max-time 5 \
  -H "apikey: $ANON_KEY" \
  http://127.0.0.1:8000/auth/v1/health >/dev/null \
  || fail "Auth health 无法通过私网网关访问"
unset ANON_KEY

printf '验证通过：批准服务健康，禁用服务缺席，原始端口仅回环可达。\n'
