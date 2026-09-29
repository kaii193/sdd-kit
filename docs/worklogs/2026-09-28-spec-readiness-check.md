# Kiểm tra spec sẵn sàng (GĐ 1)

Ngày: 2026-09-28 · Branch: `feat/spec-readiness-check` · Status: **DONE**

## Goal
Chữ `approved` chỉ có giá trị khi spec thật sự đạt các tiêu chí sẵn sàng, và CI kiểm lại chính các tiêu chí đó. Thêm vào đó, gate nhận được cả branch `feat/` lẫn `feature/`.

## Success criteria
- [x] **C1.1** `check-ready.sh` trả exit 1 và nêu đúng tiêu chí cho từng biến thể R1–R11. Trả exit 0 với fixture hợp lệ.
- [x] **C1.2** `check-spec.sh` trả exit 1 với spec gõ `approved` nhưng chưa sẵn sàng.
- [x] **C1.3** Spec mới tạo từ template, chưa điền, bị FAIL `check-ready`.
- [x] **C1.4** `feat/NNN-slug` và `feature/NNN-slug` đều tìm ra đúng spec trong `check-spec` và `check-scope`.
- [x] **C1.5** `bash tests/check-ready/run.sh` trả exit 0.
- [x] **C1.6** Điều kiện trong `sdd-check.yml` nhận cả `feat/` lẫn `feature/`. Bạn đã duyệt trong phiên chat ngày 2026-09-29.

## Decisions and trade-offs
- Các kiểm tra 🔴, Phụ thuộc, AC và placeholder được **chuyển** từ `check-spec.sh` sang `check-ready.sh`, không để trùng ở hai nơi. `check-spec.sh` giữ phần kiểm trạng thái spec/plan và gọi `check-ready.sh`.
- Bỏ `warn()` khỏi `check-spec.sh`, vì cảnh báo duy nhất (tiêu đề còn placeholder) đã chuyển sang `check-ready.sh`. Dòng tổng kết đổi từ `OK (N cảnh báo)` thành `OK`.
- Từ khóa quan hệ phải khớp chính xác. Nhờ vậy bắt được cả chữ thường lẫn dạng dấu tổ hợp (NFD), tức lỗi review #2 ở tầng spec. `check-scope.sh` vẫn so kiểu chứa chuỗi con, nhưng CI chạy `check-spec` trước nên từ khóa sai đã bị chặn từ đó.
- **Phát hiện khi chạy test:** `grep` của Git Bash trên Windows (máy này) **không khớp được ký tự UTF-8 dài 4 byte** như 🔴, kể cả với `-F`. Vì vậy kiểm tra 🔴 dùng `awk`, giống script cũ, và assert trong test cũng so chuỗi con bằng `awk`. Test đã bắt được đúng lần hồi quy này (xem Result, lần chạy đầu).
- Nhãn `[SUY ĐOÁN]`/`[ĐỀ XUẤT]` bên trong dòng trích dẫn `>` được bỏ qua, để lời hướng dẫn trong template không tự làm FAIL chính nó.
- Script mới bỏ ký tự `\r` khi đọc spec, nên spec viết trên Windows với dòng kết thúc CRLF vẫn kiểm đúng.
- Giới hạn chấp nhận: danh sách từ mơ hồ là heuristic, và so không phân biệt hoa thường với chữ có dấu phụ thuộc locale.

## How to verify
```bash
bash tests/check-ready/run.sh
for f in template/sdd/scripts/*.sh tests/check-ready/run.sh; do bash -n "$f" && echo "syntax ok: $f"; done
```
Chứng minh test không phải trang trí: chạy cùng bộ test trên script của `main` (qua một worktree tạm), kết quả phải FAIL.

## Result
Lần chạy đầu: 19 pass, 2 fail. Nguyên nhân là lỗi `grep` với 🔴 nói ở trên. Sửa xong, chạy lại:

```
== check-ready: fixture hợp lệ và template chưa điền
PASS  valid
PASS  template-unfilled
== check-ready: mỗi biến thể vi phạm đúng một tiêu chí
PASS  r1-open-question
PASS  r2-dependencies-empty
PASS  r3a-relation-lowercase
PASS  r3b-relation-nfd
PASS  r5-ac-missing-when
PASS  r6-requirement-without-ac
PASS  r7-ac-placeholder
PASS  r8-vague-word
PASS  r9-out-of-scope-empty
PASS  r10-unconfirmed-label
PASS  r11a-error-flow-without-ac
PASS  r11b-error-flow-unknown-ac
== check-spec: gọi check-ready
PASS  check-spec-valid
PASS  check-spec-approved-not-ready
== nhận dạng branch feat/ và feature/
PASS  check-spec.sh feat/042-branch-probe
PASS  check-spec.sh feature/042-branch-probe
PASS  check-scope.sh feat/042-branch-probe
PASS  check-scope.sh feature/042-branch-probe
PASS  check-spec.sh chore/042-branch-probe
PASS  check-spec.sh feat/listing-filter

22 passed, 0 failed
exit=0
```

Điều kiện CI mới, đánh giá bằng cách mô phỏng `startsWith` trên các tên branch mẫu:
```
if: startsWith(github.head_ref, 'feat/') || startsWith(github.head_ref, 'feature/')
feat/042-x             true
feature/042-x          true
feat/listing-filter    true
fix/auth               false
chore/x                false
```
`feat/listing-filter` có chạy job CI, nhưng script tự bỏ qua với exit 0 (dòng `check-spec.sh feat/listing-filter` ở trên), nên không có FAIL oan.

Cùng bộ test chạy trên script của `main`:
```
FAIL  valid — exit 127, cần 0
FAIL  template-unfilled — exit 127, cần 1
FAIL  r1-open-question — exit 127, cần 1
... (r2 → r11b: tất cả exit 127, vì check-ready.sh chưa tồn tại)
PASS  check-spec-valid
FAIL  check-spec-approved-not-ready — thiếu 'Spec chưa sẵn sàng (G1)'
FAIL  check-spec.sh feat/042-branch-probe — thiếu 'Kiểm tra spec: sdd/specs/042-branch-probe'
PASS  check-spec.sh feature/042-branch-probe
FAIL  check-scope.sh feat/042-branch-probe — thiếu 'Kiểm tra phạm vi: sdd/specs/042-branch-probe'
PASS  check-scope.sh feature/042-branch-probe
PASS  check-spec.sh chore/042-branch-probe
4 passed, 17 failed
```

Spec mới tạo bằng `new-spec.sh demo`:
```
Kiểm tra sẵn sàng: sdd/specs/001-demo
  ✗ Mục 'Phụ thuộc' trống — khai báo module sẽ chạm vào
  ✗ AC còn placeholder của template
  ✗ Mục 'Ngoài phạm vi' trống — liệt kê những gì agent KHÔNG được làm
  ✗ Luồng lỗi chưa trỏ tới AC: - **Nếu** <điều kiện> **thì** <phản hồi> (AC-x)
  ! Tiêu đề spec còn placeholder

check-ready: 4 lỗi, 1 cảnh báo
exit=1
```

Kiểm tra cú pháp:
```
syntax ok: template/sdd/scripts/check-ready.sh
syntax ok: template/sdd/scripts/check-scope.sh
syntax ok: template/sdd/scripts/check-spec.sh
syntax ok: template/sdd/scripts/lib.sh
syntax ok: template/sdd/scripts/new-spec.sh
syntax ok: tests/check-ready/run.sh
```

Kết luận từng tiêu chí:
- **C1.1** PASS: các dòng `valid`, `r1` → `r11b`. Mỗi biến thể được kiểm cả exit 1, đúng thông báo, và đúng `1 lỗi`.
- **C1.2** PASS: dòng `check-spec-approved-not-ready`.
- **C1.3** PASS: dòng `template-unfilled`, và output của `new-spec.sh demo` (4 lỗi).
- **C1.4** PASS: bốn dòng `feat/` và `feature/` cho `check-spec.sh` và `check-scope.sh`. Dòng `chore/` cho thấy branch không theo mẫu vẫn được bỏ qua như trước.
- **C1.5** PASS: `22 passed, 0 failed`, `exit=0`.
- **C1.6** PASS: bảng đánh giá điều kiện ở trên, cộng dòng test `feat/listing-filter`. **Giới hạn:** chưa chạy thật trên GitHub Actions. Workflow này là template cài vào dự án đích, nên lần chạy thật đầu tiên sẽ là PR đầu tiên của một dự án đã cài kit.

Chưa có shellcheck trên máy này, nên chưa chạy lint cho shell.

## Not done / follow-ups
- `new-spec.sh --branch` và dòng `**Branch:**` trong template vẫn dùng `feature/`. Thống nhất sang `feat/` (D7) ở GĐ 2 hoặc GĐ 3.
- Cỡ diff khoảng 429 dòng, gồm cả fixture spec (~90 dòng) và test runner (~140 dòng). Vượt mục tiêu 400 dòng một chút; không tách được mà vẫn giữ một thay đổi trọn vẹn.
- Lỗi `grep` với ký tự 4 byte có thể ảnh hưởng tới script khác sau này. Quy ước: so chuỗi có emoji thì dùng `awk`.
- Các lỗi review #3–#6 của `check-scope` vẫn còn (GĐ 5).
