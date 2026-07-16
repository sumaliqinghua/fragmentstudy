#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_ROOT="/opt/fragment-article/supabase"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ROOT="${1:-$DEFAULT_PROJECT_ROOT}"
INSTALL_ROOT="${2:-$DEFAULT_INSTALL_ROOT}"
VERSION_FILE="$PROJECT_ROOT/infra/supabase/VERSION"

fail() {
  printf '错误: %s\n' "$*" >&2
  exit 1
}

[[ $# -le 2 ]] || fail "用法: $0 [应用仓库目录] [安装根目录]"
[[ "$PROJECT_ROOT" == /* ]] || fail "应用仓库目录必须是绝对路径"
[[ "$INSTALL_ROOT" == /* ]] || fail "安装根目录必须是绝对路径"
[[ -d "$PROJECT_ROOT/.git" || -f "$PROJECT_ROOT/.git" ]] || fail "不是 Git 工作树: $PROJECT_ROOT"
[[ -f "$VERSION_FILE" ]] || fail "缺少版本文件"

RELEASE="$(tr -d '\r\n' < "$VERSION_FILE")"
[[ "$RELEASE" == "self-hosted/v0.7.0" ]] || fail "不允许同步到未固定的 release"
ACTUAL_RELEASE="$(git -C "$INSTALL_ROOT" describe --tags --exact-match HEAD 2>/dev/null || true)"
[[ "$ACTUAL_RELEASE" == "$RELEASE" ]] || fail "服务器安装目录不是 $RELEASE"

if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=all -- supabase infra/supabase scripts/supabase)" ]]; then
  fail "Supabase 部署制品包含未提交改动；只允许同步已提交 revision"
fi

for path in \
  supabase/migrations \
  supabase/tests \
  supabase/functions/content-extractor \
  supabase/functions/openai-proxy
do
  [[ -n "$(git -C "$PROJECT_ROOT" ls-tree -d --name-only HEAD "$path")" ]] \
    || fail "当前 revision 缺少 $path"
done

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$PROJECT_ROOT" archive HEAD \
  supabase/migrations supabase/tests supabase/functions \
  | tar -x -C "$TMP_DIR"

PROJECT_DEST="$INSTALL_ROOT/project/supabase"
FUNCTIONS_DEST="$INSTALL_ROOT/docker/volumes/functions"
install -d -m 0755 "$PROJECT_DEST" "$FUNCTIONS_DEST"

rsync -a --delete "$TMP_DIR/supabase/migrations/" "$PROJECT_DEST/migrations/"
rsync -a --delete "$TMP_DIR/supabase/tests/" "$PROJECT_DEST/tests/"

for function_dir in content-extractor openai-proxy _shared; do
  if [[ -d "$TMP_DIR/supabase/functions/$function_dir" ]]; then
    rsync -a --delete \
      --exclude='.env' --exclude='.env.*' \
      "$TMP_DIR/supabase/functions/$function_dir/" \
      "$FUNCTIONS_DEST/$function_dir/"
  fi
done

printf '%s\n' "$(git -C "$PROJECT_ROOT" rev-parse HEAD)" > "$INSTALL_ROOT/project/REVISION"
printf '已同步 revision %s 的迁移、测试和 Functions。\n' \
  "$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
