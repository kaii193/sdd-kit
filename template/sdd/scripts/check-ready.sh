#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

RELATION_KEYWORDS=("Chỉ đọc" "Sửa nội bộ" "Sửa hợp đồng" "Mới" "Bị ảnh hưởng")
UNFILLED_BULLET='- <...>'

dir="$(find_spec_dir "${1:-}")"
if [ -z "$dir" ]; then
  yellow "Không xác định được spec (branch không có dạng feat/NNN-... hoặc feature/NNN-...). Bỏ qua."
  exit 0
fi
spec="$dir/spec.md"
[ -f "$spec" ] || { red "  ✗ Thiếu $spec"; exit 1; }
declare -p VAGUE_WORDS >/dev/null 2>&1 || { red "  ✗ sdd/config.sh thiếu VAGUE_WORDS"; exit 1; }

spec_text="$(sed 's/\r$//' "$spec")"
errors=0; warns=0
err()  { red "  ✗ $*"; errors=$((errors+1)); }
warn() { yellow "  ! $*"; warns=$((warns+1)); }

section_body() {
  awk -v heading="$1" '/^## / { inside = index($0, heading) > 0; next } inside' <<<"$spec_text"
}

subsection_body() {
  awk -v heading="$1" '/^##+ / { inside = /^### / && index($0, heading) > 0; next } inside' <<<"$spec_text"
}

acceptance_criteria_report() {
  section_body "Tiêu chí nghiệm thu" | awk '
    function flush() { if (id != "") print id "\t" has_given "\t" has_when "\t" has_then "\t" refs }
    match($0, /^\*\*AC-[0-9]+\*\*/) {
      flush()
      id = substr($0, 3, RLENGTH - 4)
      refs = substr($0, RLENGTH + 1)
      has_given = has_when = has_then = 0
      next
    }
    /^- \*\*Given\*\*/ { has_given = 1 }
    /^- \*\*When\*\*/  { has_when = 1 }
    /^- \*\*Then\*\*/  { has_then = 1 }
    END { flush() }'
}

is_relation_keyword() {
  local keyword
  for keyword in "${RELATION_KEYWORDS[@]}"; do
    [ "$1" = "$keyword" ] && return 0
  done
  return 1
}

check_open_questions() {
  local blocking
  blocking="$(section_body "Câu hỏi mở" | awk '/^\|[[:space:]]*Q[0-9]/ && /🔴/')"
  [ -z "$blocking" ] && return 0
  err "Còn câu hỏi mở 🔴 chặn:"
  printf '%s\n' "$blocking" | sed 's/^/      /'
}

check_dependencies() {
  local rows module relation
  rows="$(section_body "Phụ thuộc" | awk -F'|' '
    /^\|/ && !/^\|[[:space:]:|-]+\|[[:space:]]*$/ {
      module = $2; relation = $3
      gsub(/[[:space:]`]/, "", module)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", relation)
      if (module != "" && module != "Module") print module "\t" relation
    }')"
  if [ -z "$rows" ]; then
    err "Mục 'Phụ thuộc' trống — khai báo module sẽ chạm vào"
    return 0
  fi
  while IFS=$'\t' read -r module relation; do
    is_relation_keyword "$relation" && continue
    err "Module '$module': quan hệ '$relation' không hợp lệ — dùng đúng một trong: $(printf '`%s` ' "${RELATION_KEYWORDS[@]}")(gõ lại nếu bộ gõ tạo dấu tổ hợp)"
  done <<<"$rows"
}

check_acceptance_criteria() {
  local report="$1" id has_given has_when has_then refs
  if [ -z "$report" ]; then
    err "Chưa có tiêu chí nghiệm thu (AC-x)"
    return 0
  fi
  while IFS=$'\t' read -r id has_given has_when has_then refs; do
    [ "$has_given" = 1 ] || err "$id thiếu Given"
    [ "$has_when" = 1 ] || err "$id thiếu When"
    [ "$has_then" = 1 ] || err "$id thiếu Then"
  done <<<"$report"
}

check_requirements_covered() {
  local report="$1" requirements covered requirement
  requirements="$(section_body "Yêu cầu chức năng" | grep -oE '^\|[[:space:]]*FR-[0-9]+' | grep -oE 'FR-[0-9]+' || true)"
  covered="$(cut -f5 <<<"$report" | grep -oE 'FR-[0-9]+' || true)"
  for requirement in $requirements; do
    grep -qxF "$requirement" <<<"$covered" && continue
    err "$requirement chưa có AC nào"
  done
}

check_placeholders() {
  if grep -q '<trạng thái ban đầu>\|<kết quả cụ thể' <<<"$spec_text"; then
    err "AC còn placeholder của template"
  fi
}

check_vague_words() {
  local clauses word matches
  clauses="$(section_body "Tiêu chí nghiệm thu" | grep -E '^- \*\*(Given|When|Then)\*\*' || true)"
  for word in "${VAGUE_WORDS[@]}"; do
    matches="$(grep -iwF -- "$word" <<<"$clauses" || true)"
    [ -z "$matches" ] && continue
    err "AC chứa từ mơ hồ '$word' — thay bằng giá trị đo được:"
    printf '%s\n' "$matches" | sed 's/^/      /'
  done
}

check_out_of_scope() {
  local items
  items="$(subsection_body "Ngoài phạm vi" | grep -E '^- ' | grep -vxF -- "$UNFILLED_BULLET" || true)"
  [ -n "$items" ] || err "Mục 'Ngoài phạm vi' trống — liệt kê những gì agent KHÔNG được làm"
}

check_unconfirmed_labels() {
  local labelled
  labelled="$(awk '!/^>/ && /\[(SUY ĐOÁN|ĐỀ XUẤT)\]/ { print NR ": " $0 }' <<<"$spec_text")"
  [ -z "$labelled" ] && return 0
  err "Còn nhãn chưa xác nhận — dev xác nhận rồi xóa nhãn:"
  printf '%s\n' "$labelled" | sed 's/^/      /'
}

check_error_flows() {
  local report="$1" defined flows flow references reference
  defined="$(cut -f1 <<<"$report")"
  flows="$(subsection_body "Luồng thay thế & lỗi" | grep -E '^- ' || true)"
  while IFS= read -r flow; do
    [ -n "$flow" ] || continue
    references="$(grep -oE 'AC-[0-9]+' <<<"$flow" || true)"
    if [ -z "$references" ]; then
      err "Luồng lỗi chưa trỏ tới AC: $flow"
      continue
    fi
    for reference in $references; do
      grep -qxF "$reference" <<<"$defined" || err "Luồng lỗi trỏ tới $reference không tồn tại: $flow"
    done
  done <<<"$flows"
}

check_title() {
  if grep -q '<Tên tính năng>' <<<"$spec_text"; then
    warn "Tiêu đề spec còn placeholder"
  fi
}

echo "Kiểm tra sẵn sàng: ${dir#"$ROOT"/}"
ac_report="$(acceptance_criteria_report)"
check_open_questions
check_dependencies
check_acceptance_criteria "$ac_report"
check_requirements_covered "$ac_report"
check_placeholders
check_vague_words
check_out_of_scope
check_unconfirmed_labels
check_error_flows "$ac_report"
check_title

echo
if [ "$errors" -gt 0 ]; then red "check-ready: $errors lỗi, $warns cảnh báo"; exit 1; fi
green "check-ready: OK ($warns cảnh báo)"
