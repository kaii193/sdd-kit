#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

SLUG_PATTERN='^[a-z0-9]+(-[a-z0-9]+)*$'

usage() {
  red "Dùng: new-spec.sh <dự-án> <ten-tinh-nang>   (chữ thường không dấu, nối bằng -)"
  exit 1
}

project="${1:-}"; name="${2:-}"
[[ "$project" =~ $SLUG_PATTERN ]] || usage
[[ "$name" =~ $SLUG_PATTERN ]] || usage

specs="$GF_HOME/projects/$project/specs"
[ -d "$specs" ] || { red "Không có dự án '$project' (thiếu $specs) — chạy /gf-init trước"; exit 1; }

last="$(find "$specs" -maxdepth 1 -type d -name '[0-9][0-9][0-9]-*' -exec basename {} \; | sort | tail -1 | cut -c1-3)"
next="$(printf '%03d' $((10#${last:-0} + 1)))"
dir="$specs/$next-$name"

cp -r "$GF_HOME/.gf/templates/spec" "$dir"
for f in "$dir"/*.md; do
  sed -e "s/ten-tinh-nang/$name/g" -e "s/NNN/$next/g" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
green "Đã tạo: projects/$project/specs/$next-$name/"
echo "Tiếp theo: soạn spec.md bằng /gf-spec."
