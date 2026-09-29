#!/usr/bin/env bash
set -euo pipefail

KIT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$KIT/tests/check-ready/valid"
READ_ONLY_NFD="$(printf 'Chi\xcc\x89 \xc4\x91o\xcc\xa3c')"
PROJECT="demo"

workspace="$(mktemp -d)"
trap 'rm -rf "$workspace"' EXIT
home="$workspace/gf-work"
code="$workspace/code/shop"
specs="$home/projects/$PROJECT/specs"

passed=0; failed=0
pass() { printf 'PASS  %s\n' "$1"; passed=$((passed+1)); }
fail() { printf 'FAIL  %s — %s\n' "$1" "$2"; failed=$((failed+1)); }

strip_colors() { sed 's/\x1b\[[0-9;]*m//g'; }

contains_text() {
  awk -v needle="$2" 'index($0, needle) { found = 1 } END { exit !found }' <<<"$1"
}

git_quiet() {
  git -C "$code" -c user.email=test@example.com -c user.name=test -c core.autocrlf=false "$@" >/dev/null 2>&1
}

prepare_home() {
  mkdir -p "$specs"
  cp -r "$KIT/modules/sdd/home/.gf" "$home/.gf"
  sed -e "s#{{PROJECT_PATH}}#$code#" -e "s#{{BASE_BRANCH}}#main#" "$KIT/modules/sdd/project/config.sh" \
    > "$home/projects/$PROJECT/config.sh"
}

prepare_code_repo() {
  local module
  for module in cart pricing promotion invoice; do
    mkdir -p "$code/src/$module"
    echo "$module" > "$code/src/$module/index.ts"
  done
  git init -q -b main "$code"
  git_quiet add -A
  git_quiet commit -qm base
}

make_variant() {
  local name="$1" sed_script="$2" dir="$specs/$1"
  mkdir -p "$dir"
  sed -e "$sed_script" "$FIXTURE/spec.md" > "$dir/spec.md"
  cp "$FIXTURE/plan.md" "$dir/plan.md"
  printf '%s' "$dir"
}

run_script() {
  local script="$1"; shift
  (cd "$home" && bash ".gf/scripts/$script" "$@" 2>&1) | strip_colors
}

assert_outcome() {
  local name="$1" status="$2" output="$3" expected_status="$4" expected_text="$5"
  if [ "$status" -ne "$expected_status" ]; then
    fail "$name" "exit $status, cần $expected_status"
    printf '%s\n' "$output" | sed 's/^/      /'
    return 1
  fi
  if ! contains_text "$output" "$expected_text"; then
    fail "$name" "thiếu '$expected_text'"
    printf '%s\n' "$output" | sed 's/^/      /'
    return 1
  fi
  return 0
}

expect_script() {
  local name="$1" expected_status="$2" expected_text="$3" output status
  shift 3
  output="$(run_script "$@")" && status=0 || status=$?
  assert_outcome "$name" "$status" "$output" "$expected_status" "$expected_text" && pass "$name"
  return 0
}

expect_ready_rejects() {
  local name="$1" sed_script="$2" expected_text="$3" dir output status
  dir="$(make_variant "$name" "$sed_script")"
  output="$(run_script check-ready.sh "$dir")" && status=0 || status=$?
  assert_outcome "$name" "$status" "$output" 1 "$expected_text" || return 0
  assert_outcome "$name" "$status" "$output" 1 "check-ready: 1 lỗi" || return 0
  pass "$name"
}

expect_file_contains() {
  local name="$1" file="$2" expected_text="$3"
  if [ -f "$file" ] && contains_text "$(cat "$file")" "$expected_text"; then pass "$name"; return 0; fi
  fail "$name" "$file không chứa '$expected_text'"
}

commit_change() {
  echo "$2" >> "$code/src/$1/index.ts"
  git_quiet add -A
  git_quiet commit -qm "change $1"
}

prepare_code_repo
prepare_home

echo "== check-ready: fixture hợp lệ"
expect_script valid 0 "check-ready: OK" check-ready.sh "$(make_variant valid "")"

echo "== check-ready: mỗi biến thể vi phạm đúng một tiêu chí"
expect_ready_rejects r1-open-question 's/| ✅ | PO |/| 🔴 | PO |/' "Còn câu hỏi mở 🔴 chặn"
expect_ready_rejects r2-dependencies-empty '/^| cart, promotion |/d;/^| pricing |/d;/^| invoice |/d' "Mục 'Phụ thuộc' trống"
expect_ready_rejects r3a-relation-lowercase 's/| Chỉ đọc |/| chỉ đọc |/' "quan hệ 'chỉ đọc' không hợp lệ"
expect_ready_rejects r3b-relation-nfd "s/| Chỉ đọc |/| $READ_ONLY_NFD |/" "không hợp lệ"
expect_ready_rejects r5-ac-missing-when '/khách áp mã `GIAM50K`/d' "AC-1 thiếu When"
expect_ready_rejects r6-requirement-without-ac '/^| FR-2 |/a | FR-3 | Hệ thống phải ghi nhật ký mỗi lần áp mã | Should |' "FR-3 chưa có AC nào"
expect_ready_rejects r7-ac-placeholder 's/giỏ hàng tổng 500.000đ và mã `GIAM50K` còn hạn/<trạng thái ban đầu>/' "AC còn placeholder của template"
expect_ready_rejects r8-vague-word 's/tổng tiền là 450.000đ/tổng tiền cập nhật nhanh/' "AC chứa từ mơ hồ 'nhanh'"
expect_ready_rejects r9-out-of-scope-empty 's/^- Áp nhiều mã cùng lúc/- <...>/;/^- Trang quản trị tạo mã/d' "Mục 'Ngoài phạm vi' trống"
expect_ready_rejects r10-unconfirmed-label 's/Đang dùng PriceResult/Đang dùng PriceResult [SUY ĐOÁN]/' "Còn nhãn chưa xác nhận"
expect_ready_rejects r11a-error-flow-without-ac 's/ (AC-2)//' "Luồng lỗi chưa trỏ tới AC"
expect_ready_rejects r11b-error-flow-unknown-ac 's/(AC-2)/(AC-9)/' "Luồng lỗi trỏ tới AC-9 không tồn tại"

echo "== check-ready: đầu vào sai"
expect_script missing-spec-argument 1 "Thiếu thư mục spec" check-ready.sh
mkdir -p "$workspace/loose/spec"
cp "$FIXTURE/spec.md" "$workspace/loose/spec/spec.md"
expect_script spec-outside-a-project 1 "thư mục spec phải nằm trong projects/" check-ready.sh "$workspace/loose/spec"

echo "== check-spec: gọi check-ready"
expect_script check-spec-valid 0 "check-spec: OK" check-spec.sh "$specs/valid"
expect_script check-spec-approved-not-ready 1 "Spec chưa sẵn sàng (G1)" check-spec.sh "$specs/r1-open-question"

echo "== new-spec: tạo spec trong dự án, đánh số tự động"
expect_script new-spec-first 0 "projects/$PROJECT/specs/001-probe/" new-spec.sh "$PROJECT" probe
expect_file_contains new-spec-branch-name "$specs/001-probe/spec.md" '**Branch:** `feat/001-probe`'
expect_script new-spec-second 0 "projects/$PROJECT/specs/002-probe-two/" new-spec.sh "$PROJECT" probe-two
expect_script new-spec-unfilled-not-ready 1 "check-ready:" check-ready.sh "$specs/001-probe"
expect_script new-spec-unknown-project 1 "Không có dự án 'khong-co'" new-spec.sh khong-co probe

echo "== check-scope: so thay đổi trên repo code đã link"
git_quiet checkout -q -b feat/001-promo
commit_change pricing "sửa nội bộ"
expect_script scope-declared-module 0 "check-scope: OK" check-scope.sh "$specs/valid"
commit_change cart "sửa module chỉ đọc"
expect_script scope-read-only-module 1 "Module 'cart' khai báo 'Chỉ đọc' nhưng bị sửa" check-scope.sh "$specs/valid"

git_quiet checkout -q main
git_quiet worktree add -q -b feat/002-worktree "$workspace/worktree"
echo "sửa trong worktree" >> "$workspace/worktree/src/promotion/index.ts"
git -C "$workspace/worktree" -c user.email=test@example.com -c user.name=test -c core.autocrlf=false commit -qam "change promotion" >/dev/null 2>&1
output="$(cd "$home" && GF_CODE_DIR="$workspace/worktree" bash .gf/scripts/check-scope.sh "$specs/valid" 2>&1 | strip_colors)" && status=0 || status=$?
assert_outcome scope-uses-gf-code-dir "$status" "$output" 1 "Module 'promotion' khai báo 'Chỉ đọc' nhưng bị sửa" && pass scope-uses-gf-code-dir

echo
echo "$passed passed, $failed failed"
if [ "$failed" -gt 0 ]; then exit 1; fi
