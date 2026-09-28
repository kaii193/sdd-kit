#!/usr/bin/env bash
set -euo pipefail

KIT="$(cd "$(dirname "$0")" && pwd)"
TARGET=""; TOOL="generic"; CI=1; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tool) TOOL="$2"; shift 2;;
    --no-ci) CI=0; shift;;
    --force) FORCE=1; shift;;
    -h|--help) echo "Dùng: bash install.sh <thư-mục-dự-án> [--tool claude|cursor|copilot|generic] [--no-ci] [--force]"; exit 0;;
    *) TARGET="$1"; shift;;
  esac
done
[ -z "$TARGET" ] && { echo "Dùng: bash install.sh <thư-mục-dự-án> [--tool claude|cursor|copilot|generic] [--no-ci] [--force]"; exit 1; }
[ -d "$TARGET" ] || { echo "Không tìm thấy thư mục: $TARGET"; exit 1; }
TARGET="$(cd "$TARGET" && pwd)"

copied=(); skipped=()
put() {
  local src="$1" dst="$TARGET/$2"
  if [ -e "$dst" ] && [ "$FORCE" -eq 0 ]; then skipped+=("$2"); return; fi
  mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"; copied+=("$2")
}

while IFS= read -r f; do
  rel="${f#"$KIT/template/"}"
  case "$rel" in .github/*) [ "$CI" -eq 0 ] && [[ "$rel" == .github/workflows/* ]] && continue;; esac
  put "$f" "$rel"
done < <(find "$KIT/template" -type f | sort)

case "$TOOL" in
  claude)  put "$KIT/adapters/claude/CLAUDE.md" "CLAUDE.md";;
  cursor)  put "$KIT/adapters/cursor/sdd.mdc" ".cursor/rules/sdd.mdc";;
  copilot) put "$KIT/adapters/copilot/copilot-instructions.md" ".github/copilot-instructions.md";;
  generic) ;;
  *) echo "Công cụ không hỗ trợ: $TOOL"; exit 1;;
esac

chmod +x "$TARGET"/sdd/scripts/*.sh 2>/dev/null || true

echo "== Đã cài SDD kit vào $TARGET (tool: $TOOL) =="
printf '  + %s\n' "${copied[@]}"
if [ "${#skipped[@]}" -gt 0 ]; then
  echo "== Bỏ qua (đã tồn tại, dùng --force để ghi đè) =="
  printf '  = %s\n' "${skipped[@]}"
fi
cat << 'MSG'

Việc cần làm tiếp (chi tiết: sdd/GUIDE.md mục 2):
  1. Sửa sdd/config.sh cho khớp cấu trúc module
  2. Điền mục "Lệnh dự án" trong AGENTS.md
  3. Viết sdd/constitution.md và sdd/patterns.md (GUIDE mục 3, 4)
  4. (Tuỳ chọn) Đổi .github/CODEOWNERS.example → CODEOWNERS
MSG
