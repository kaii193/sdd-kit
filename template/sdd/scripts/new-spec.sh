#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

name="${1:-}"
if [ -z "$name" ] || [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  red "Dùng: new-spec.sh <ten-tinh-nang> [--branch]   (chữ thường không dấu, nối bằng -)"
  exit 1
fi

specs="$ROOT/sdd/specs"
last="$(find "$specs" -maxdepth 1 -type d -name '[0-9][0-9][0-9]-*' -exec basename {} \; | sort | tail -1 | cut -c1-3)"
next="$(printf '%03d' $((10#${last:-0} + 1)))"
dir="$specs/$next-$name"

cp -r "$specs/_template" "$dir"
for f in "$dir"/*.md; do
  sed -e "s/ten-tinh-nang/$name/g" -e "s/NNN/$next/g" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
green "Đã tạo: sdd/specs/$next-$name/"

if [ "${2:-}" = "--branch" ]; then
  git checkout -b "feature/$next-$name"
  green "Đã tạo branch: feature/$next-$name"
fi
echo "Tiếp theo: soạn spec.md (xem sdd/GUIDE.md mục 5.2, prompt P4)."
