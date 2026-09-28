#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dir="$(find_spec_dir "${1:-}")"
if [ -z "$dir" ]; then
  yellow "Không xác định được spec (branch không có dạng feature/NNN-...). Bỏ qua."
  exit 0
fi
spec="$dir/spec.md"; plan="$dir/plan.md"
errors=0; warns=0
err()  { red "  ✗ $*"; errors=$((errors+1)); }
warn() { yellow "  ! $*"; warns=$((warns+1)); }

echo "Kiểm tra spec: ${dir#"$ROOT"/}"
[ -f "$spec" ] || { red "  ✗ Thiếu spec.md"; exit 1; }

s="$(read_status "$spec")"
case "$s" in
  approved|implemented) ;;
  *) err "Trạng thái spec là '$s' — cần 'approved' (G1)";;
esac

open_q="$(awk '/^## /{sec=($0 ~ /Câu hỏi mở/); next} sec && /^\|[[:space:]]*Q[0-9]/ && /🔴/' "$spec")"
[ -n "$open_q" ] && err "Còn câu hỏi mở 🔴 chặn:" && printf '%s\n' "$open_q" | sed 's/^/      /'

deps="$(awk -F'|' '/^## /{sec=($0 ~ /Phụ thuộc/); next}
  sec && /^\|/ && $0 !~ /^\|[[:space:]:|-]+\|[[:space:]]*$/ {
    m=$2; gsub(/[[:space:]`]/,"",m); if (m!="" && m!="Module") print m }' "$spec")"
[ -z "$deps" ] && err "Mục 'Phụ thuộc' trống — khai báo module sẽ chạm vào"

grep -q '\*\*AC-[0-9]' "$spec" || err "Chưa có tiêu chí nghiệm thu (AC-x)"
grep -q '<trạng thái ban đầu>\|<kết quả cụ thể' "$spec" && err "AC còn placeholder của template"

grep -q '<Tên tính năng>' "$spec" && warn "Tiêu đề spec còn placeholder"

if [ -f "$plan" ]; then
  p="$(read_status "$plan")"
  [ "$p" = "approved" ] || err "Trạng thái plan là '$p' — cần 'approved' (G2)"
  if grep -qE '^\|[^|]*\|[[:space:]]*Sửa hợp đồng' "$spec"; then
    awk '/^## /{sec=($0 ~ /Thay đổi hợp đồng/); next} sec' "$plan" | grep -q '<type/API/schema' \
      && err "Spec có 'Sửa hợp đồng' nhưng plan mục 'Thay đổi hợp đồng' chưa điền"
  fi
else
  err "Thiếu plan.md"
fi

echo
if [ "$errors" -gt 0 ]; then red "check-spec: $errors lỗi, $warns cảnh báo"; exit 1; fi
green "check-spec: OK ($warns cảnh báo)"
