#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_BACKUP_ROOT="$HOME/Backups/fragment-article/supabase"
readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"
readonly KEEP_DAILY=14
readonly KEEP_WEEKLY=8
readonly KEEP_MONTHLY=6

SSH_TARGET="${1:-}"
AGE_RECIPIENT="${2:-}"
BACKUP_ROOT="${3:-$DEFAULT_BACKUP_ROOT}"
REMOTE_INSTALL_ROOT="${4:-$DEFAULT_INSTALL_ROOT}"

fail() {
  printf '备份失败: %s\n' "$*" >&2
  exit 1
}

[[ $# -ge 2 && $# -le 4 ]] \
  || fail "用法: $0 <SSH目标> <age公钥> [备份目录] [远端安装根目录]"
[[ "$SSH_TARGET" =~ ^[A-Za-z0-9_.@:-]+$ ]] || fail "SSH 目标格式无效"
[[ "$AGE_RECIPIENT" == age1* ]] || fail "age recipient 格式无效"
[[ "$BACKUP_ROOT" == /* ]] || fail "备份目录必须是绝对路径"
[[ "$REMOTE_INSTALL_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "远端安装根目录格式无效"
command -v ssh >/dev/null 2>&1 || fail "缺少 ssh"
command -v age >/dev/null 2>&1 || fail "缺少 age"

STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
DAY_OF_WEEK="$(date -u '+%u')"
DAY_OF_MONTH="$(date -u '+%d')"
DAILY_ROOT="$BACKUP_ROOT/daily"
SNAPSHOT_DIR="$DAILY_ROOT/$STAMP"
TMP_DIR="$DAILY_ROOT/.${STAMP}.tmp"

mkdir -p "$TMP_DIR" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"
chmod 0700 "$BACKUP_ROOT" "$DAILY_ROOT" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly" "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

ssh -o BatchMode=yes -o ServerAliveInterval=30 "$SSH_TARGET" \
  bash -s -- "$REMOTE_INSTALL_ROOT" <<'REMOTE_DB' \
  | age -r "$AGE_RECIPIENT" -o "$TMP_DIR/database.dump.age"
set -euo pipefail
install_root="$1"
cd "$install_root/docker"
test -f docker-compose.yml
sudo -n docker compose --env-file .env -f docker-compose.yml -f docker-compose.private.yml \
  exec -T db pg_dump -U postgres -d postgres -Fc
REMOTE_DB

ssh -o BatchMode=yes -o ServerAliveInterval=30 "$SSH_TARGET" \
  bash -s -- "$REMOTE_INSTALL_ROOT" <<'REMOTE_CONFIG' \
  | age -r "$AGE_RECIPIENT" -o "$TMP_DIR/config.tar.age"
set -euo pipefail
install_root="$1"
cd "$install_root"
files=(docker/.env docker/docker-compose.private.yml)
if test -f project/REVISION; then
  files+=(project/REVISION)
fi
sudo -n tar -cf - "${files[@]}"
REMOTE_CONFIG

ssh -o BatchMode=yes -o ServerAliveInterval=30 "$SSH_TARGET" \
  sudo -n docker exec supabase-db tar -C /etc/postgresql-custom -cf - . \
  | age -r "$AGE_RECIPIENT" -o "$TMP_DIR/db-config.tar.age"

chmod 0600 "$TMP_DIR"/*.age
mv "$TMP_DIR" "$SNAPSHOT_DIR"
trap - EXIT

link_snapshot() {
  local source_dir="$1"
  local destination_dir="$2"
  local file

  mkdir -p "$destination_dir"
  for file in "$source_dir"/*.age; do
    ln "$file" "$destination_dir/$(basename "$file")"
  done
}

prune_snapshots() {
  local directory="$1"
  local keep="$2"
  local snapshots=("$directory"/20*)
  local count index remove_count

  [[ -e "${snapshots[0]}" ]] || return 0
  count="${#snapshots[@]}"
  (( count > keep )) || return 0
  remove_count=$((count - keep))
  for ((index = 0; index < remove_count; index++)); do
    rm -rf "${snapshots[$index]}"
  done
}

if [[ "$DAY_OF_WEEK" == "7" ]]; then
  link_snapshot "$SNAPSHOT_DIR" "$BACKUP_ROOT/weekly/$STAMP"
fi
if [[ "$DAY_OF_MONTH" == "01" ]]; then
  link_snapshot "$SNAPSHOT_DIR" "$BACKUP_ROOT/monthly/$STAMP"
fi

prune_snapshots "$DAILY_ROOT" "$KEEP_DAILY"
prune_snapshots "$BACKUP_ROOT/weekly" "$KEEP_WEEKLY"
prune_snapshots "$BACKUP_ROOT/monthly" "$KEEP_MONTHLY"

printf '加密备份完成: %s\n' "$SNAPSHOT_DIR"
