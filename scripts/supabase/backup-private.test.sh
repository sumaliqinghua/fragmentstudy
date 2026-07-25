#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

FAKE_BIN="$ROOT/bin"
BACKUP_ROOT="$ROOT/backups"
export FAKE_SSH_COUNTER="$ROOT/ssh-counter"
mkdir -p "$FAKE_BIN"
printf '0\n' > "$FAKE_SSH_COUNTER"

cat > "$FAKE_BIN/ssh" <<'FAKE_SSH'
#!/usr/bin/env bash
set -euo pipefail

count="$(cat "$FAKE_SSH_COUNTER")"
count=$((count + 1))
printf '%s\n' "$count" > "$FAKE_SSH_COUNTER"

if [[ "$count" -le 2 ]]; then
  remote_script="$(cat)"
  if [[ "$count" == 1 ]]; then
    grep -Fq 'sudo -n docker compose' <<< "$remote_script"
  else
    grep -Fq 'sudo -n tar -cf' <<< "$remote_script"
  fi
else
  [[ "$*" == *"sudo -n docker exec supabase-db tar"* ]]
fi

printf 'fixture-payload-%s' "$count"
FAKE_SSH

cat > "$FAKE_BIN/age" <<'FAKE_AGE'
#!/usr/bin/env bash
set -euo pipefail

output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

[[ -n "$output" ]]
cat > "$output"
FAKE_AGE

chmod +x "$FAKE_BIN/ssh" "$FAKE_BIN/age"

PATH="$FAKE_BIN:$PATH" "$SCRIPT_DIR/backup-private.sh" \
  fragmentarticle-backup \
  age1fixture \
  "$BACKUP_ROOT" \
  /opt/fragment-article/supabase

LATEST="$(find "$BACKUP_ROOT/daily" -mindepth 1 -maxdepth 1 -type d -print | sort | tail -1)"
[[ -n "$LATEST" ]]
[[ "$(find "$LATEST" -type f -name '*.age' | wc -l | tr -d ' ')" == 3 ]]
[[ "$(cat "$FAKE_SSH_COUNTER")" == 3 ]]

printf '非 root 备份命令夹具通过。\n'
