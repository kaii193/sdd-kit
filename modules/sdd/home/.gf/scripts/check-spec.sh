#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dir="$(resolve_spec_dir "${1:-}")"
spec="$dir/spec.md"; plan="$dir/plan.md"
errors=0
err()  { red "  ✗ $*"; errors=$((errors+1)); }

echo "Kiểm tra spec: ${dir#"$GF_HOME"/}"
[ -f "$spec" ] || { red "  ✗ Thiếu spec.md"; exit 1; }

s="$(read_status "$spec")"
case "$s" in
  approved|implemented) ;;
  *) err "Trạng thái spec là '$s' — cần 'approved' (G1)";;
esac

bash "$(dirname "$0")/check-ready.sh" "$dir" | sed 's/^/  /' \
  || err "Spec chưa sẵn sàng (G1) — xem lỗi check-ready ở trên"

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
if [ "$errors" -gt 0 ]; then red "check-spec: $errors lỗi"; exit 1; fi
green "check-spec: OK"
