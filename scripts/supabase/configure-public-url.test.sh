#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

ENV_FILE="$ROOT/docker/.env"
REDIRECTS='fragmentarticle://auth/callback,http://localhost:5174/**,http://localhost:5183/**,https://theaimoment.com/**,https://www.theaimoment.com/**'
FAKE_BIN="$ROOT/bin"
export REAL_MV="$(command -v mv)"
export MV_COUNTER="$ROOT/mv-counter"

mkdir -p "$(dirname "$ENV_FILE")" "$FAKE_BIN"
printf '0\n' > "$MV_COUNTER"
cat > "$FAKE_BIN/mv" <<'FAKE_MV'
#!/usr/bin/env bash
set -euo pipefail

count="$(cat "$MV_COUNTER")"
printf '%s\n' "$((count + 1))" > "$MV_COUNTER"
"$REAL_MV" "$@"
FAKE_MV
chmod +x "$FAKE_BIN/mv"

printf '%s\n' \
  'SUPABASE_PUBLIC_URL=http://127.0.0.1:8000' \
  'API_EXTERNAL_URL=http://127.0.0.1:8000/auth/v1' \
  'SITE_URL=http://localhost:5174' \
  'ADDITIONAL_REDIRECT_URLS=http://localhost:5174/**' \
  'DISABLE_SIGNUP=true' \
  'UNCHANGED_VALUE=preserved' \
  > "$ENV_FILE"
chmod 0600 "$ENV_FILE"

PATH="$FAKE_BIN:$PATH" "$SCRIPT_DIR/configure-public-url.sh" \
  'https://api.theaimoment.com' \
  'fragmentarticle://auth/callback' \
  "$REDIRECTS" \
  "$ROOT"

grep -Fx 'SUPABASE_PUBLIC_URL=https://api.theaimoment.com' "$ENV_FILE"
grep -Fx 'API_EXTERNAL_URL=https://api.theaimoment.com/auth/v1' "$ENV_FILE"
grep -Fx 'SITE_URL=fragmentarticle://auth/callback' "$ENV_FILE"
grep -Fx "ADDITIONAL_REDIRECT_URLS=$REDIRECTS" "$ENV_FILE"
grep -Fx 'DISABLE_SIGNUP=true' "$ENV_FILE"
grep -Fx 'UNCHANGED_VALUE=preserved' "$ENV_FILE"

if stat -f '%Lp' "$ENV_FILE" >/dev/null 2>&1; then
  MODE="$(stat -f '%Lp' "$ENV_FILE")"
else
  MODE="$(stat -c '%a' "$ENV_FILE")"
fi
[[ "$MODE" == 600 ]]
if [[ "$(cat "$MV_COUNTER")" != 1 ]]; then
  printf '预期仅执行一次最终 mv，实际执行 %s 次。\n' "$(cat "$MV_COUNTER")" >&2
  exit 1
fi

BACKUP_COUNT="$(
  find "$ROOT/backups/public-rollout" -type f -name 'docker.env.*.bak' \
    | wc -l \
    | tr -d ' '
)"
[[ "$BACKUP_COUNT" == 1 ]]

printf '公网 URL 配置夹具通过。\n'
