#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"
readonly PRIVATE_PORTS=(8000 5432 6543)

DOMAIN="${1:-}"
PUBLIC_IP="${2:-}"
SSH_PORT="${3:-2222}"
INSTALL_ROOT="${4:-$DEFAULT_INSTALL_ROOT}"
ENV_FILE="$INSTALL_ROOT/docker/.env"

fail() {
  printf '公网验证失败: %s\n' "$*" >&2
  exit 1
}

[[ $# -ge 2 && $# -le 4 ]] \
  || fail "用法: $0 <API域名> <公网IPv4> [SSH端口] [安装根目录]"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || fail "API 域名格式无效"
[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail "公网 IPv4 格式无效"
[[ "$SSH_PORT" =~ ^[0-9]+$ && "$SSH_PORT" -ge 1 && "$SSH_PORT" -le 65535 ]] \
  || fail "SSH 端口无效"
[[ "$INSTALL_ROOT" == /* ]] || fail "安装根目录必须是绝对路径"
[[ -f "$ENV_FILE" ]] || fail "缺少官方 docker/.env"
command -v curl >/dev/null 2>&1 || fail "缺少 curl"
command -v getent >/dev/null 2>&1 || fail "缺少 getent"
command -v nc >/dev/null 2>&1 || fail "缺少 nc"

DNS_ANSWERS="$(
  getent ahostsv4 "$DOMAIN" \
    | awk '{print $1}' \
    | sort -u
)"
grep -Fxq "$PUBLIC_IP" <<< "$DNS_ANSWERS" \
  || fail "$DOMAIN 未解析到 $PUBLIC_IP"

read_env_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      print substr($0, length(key) + 2)
      exit
    }
  ' "$ENV_FILE"
}

ANON_KEY="$(read_env_value ANON_KEY)"
[[ -n "$ANON_KEY" ]] || fail "docker/.env 缺少 ANON_KEY"

status="$(
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --max-time 10 "https://$DOMAIN/"
)"
[[ "$status" == 404 ]] || fail "API 根路径状态为 $status，预期 404"

status="$(
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --max-time 10 "https://$DOMAIN/project/default"
)"
[[ "$status" == 404 ]] || fail "Studio 路径状态为 $status，预期 404"

curl --fail --silent --show-error --max-time 10 \
  -H "apikey: $ANON_KEY" \
  "https://$DOMAIN/auth/v1/health" >/dev/null \
  || fail "Auth health 无法通过公网域名访问"

for function_name in openai-proxy content-extractor; do
  status="$(
    curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --max-time 10 \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json" \
      --data '{}' \
      "https://$DOMAIN/functions/v1/$function_name"
  )"
  [[ "$status" == 401 ]] \
    || fail "匿名 $function_name 状态为 $status，预期 401"
done

for port in "${PRIVATE_PORTS[@]}"; do
  if nc -z -w 2 "$PUBLIC_IP" "$port" >/dev/null 2>&1; then
    fail "公网 $PUBLIC_IP:$port 可以建立连接"
  fi
done

nc -z -w 5 "$PUBLIC_IP" "$SSH_PORT" >/dev/null 2>&1 \
  || fail "公网 SSH 端口 $SSH_PORT 不可达"

unset ANON_KEY
printf '公网验证通过：TLS、批准路由、匿名拒绝和端口边界均符合预期。\n'
