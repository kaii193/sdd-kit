#!/usr/bin/env bash
set -euo pipefail

KIT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$KIT/tests/check-ready/valid"
READ_ONLY_NFD="$(printf 'Chi\xcc\x89 \xc4\x91o\xcc\xa3c')"
BRANCH_PROBE="042-branch-probe"

workspace="$(mktemp -d)"
trap 'rm -rf "$workspace"' EXIT
cp -r "$KIT/modules/sdd/files/sdd" "$workspace/sdd"

passed=0; failed=0
pass() { printf 'PASS  %s\n' "$1"; passed=$((passed+1)); }
fail() { printf 'FAIL  %s — %s\n' "$1" "$2"; failed=$((failed+1)); }

strip_colors() { sed 's/\x1b\[[0-9;]*m//g'; }

contains_text() {
  awk -v needle="$2" 'index($0, needle) { found = 1 } END { exit !found }' <<<"$1"
}

make_variant() {
  local name="$1" sed_script="$2" dir="$workspace/sdd/specs/$1"
  mkdir -p "$dir"
  sed -e "$sed_script" "$FIXTURE/spec.md" > "$dir/spec.md"
  cp "$FIXTURE/plan.md" "$dir/plan.md"
  printf '%s' "$dir"
}

run_on_dir() {
  (cd "$workspace" && bash "sdd/scripts/$1" "$2" 2>&1) | strip_colors
}

run_on_branch() {
  (cd "$workspace" && SDD_BRANCH="$2" SDD_BASE=HEAD bash "sdd/scripts/$1" 2>&1) | strip_colors
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

expect_on_dir() {
  local script="$1" name="$2" dir="$3" expected_status="$4" expected_text="$5" output status
  output="$(run_on_dir "$script" "$dir")" && status=0 || status=$?
  assert_outcome "$name" "$status" "$output" "$expected_status" "$expected_text" && pass "$name"
  return 0
}

expect_ready_rejects() {
  local name="$1" sed_script="$2" expected_text="$3" dir output status
  dir="$(make_variant "$name" "$sed_script")"
  output="$(run_on_dir check-ready.sh "$dir")" && status=0 || status=$?
  assert_outcome "$name" "$status" "$output" 1 "$expected_text" || return 0
  assert_outcome "$name" "$status" "$output" 1 "check-ready: 1 lỗi" || return 0
  pass "$name"
}

expect_on_branch() {
  local script="$1" branch="$2" expected_status="$3" expected_text="$4" output status
  output="$(run_on_branch "$script" "$branch")" && status=0 || status=$?
  assert_outcome "$script $branch" "$status" "$output" "$expected_status" "$expected_text" && pass "$script $branch"
  return 0
}

prepare_branch_probe() {
  make_variant "$BRANCH_PROBE" "" >/dev/null
  git -C "$workspace" init -q
  git -C "$workspace" -c core.autocrlf=false add -A
  git -C "$workspace" -c user.email=test@example.com -c user.name=test commit -qm probe
}

echo "== check-ready: fixture hợp lệ và template chưa điền"
expect_on_dir check-ready.sh valid "$(make_variant valid "")" 0 "check-ready: OK"
mkdir -p "$workspace/sdd/specs/template-unfilled"
cp "$workspace/sdd/specs/_template/spec.md" "$workspace/sdd/specs/template-unfilled/spec.md"
expect_on_dir check-ready.sh template-unfilled "$workspace/sdd/specs/template-unfilled" 1 "check-ready:"

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

echo "== check-spec: gọi check-ready"
expect_on_dir check-spec.sh check-spec-valid "$workspace/sdd/specs/valid" 0 "check-spec: OK"
expect_on_dir check-spec.sh check-spec-approved-not-ready "$workspace/sdd/specs/r1-open-question" 1 "Spec chưa sẵn sàng (G1)"

echo "== nhận dạng branch feat/ và feature/"
prepare_branch_probe
expect_on_branch check-spec.sh "feat/$BRANCH_PROBE" 0 "Kiểm tra spec: sdd/specs/$BRANCH_PROBE"
expect_on_branch check-spec.sh "feature/$BRANCH_PROBE" 0 "Kiểm tra spec: sdd/specs/$BRANCH_PROBE"
expect_on_branch check-scope.sh "feat/$BRANCH_PROBE" 0 "Kiểm tra phạm vi: sdd/specs/$BRANCH_PROBE"
expect_on_branch check-scope.sh "feature/$BRANCH_PROBE" 0 "Kiểm tra phạm vi: sdd/specs/$BRANCH_PROBE"
expect_on_branch check-spec.sh "chore/$BRANCH_PROBE" 0 "Bỏ qua"
expect_on_branch check-spec.sh "feat/listing-filter" 0 "Bỏ qua"

echo
echo "$passed passed, $failed failed"
if [ "$failed" -gt 0 ]; then exit 1; fi
