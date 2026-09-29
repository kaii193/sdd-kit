# Sửa các cách lách check-scope (GĐ 5)

Ngày: 2026-09-29 · Branch: `fix/check-scope-bypasses` (xếp chồng lên `feat/gf-implement-engine`) · Status: **DONE**

## Goal
Không lách được `check-scope` bằng các cách đã tìm ra trong buổi review ngày 2026-09-28.

## Success criteria
- [x] **C5.1** Mỗi lỗi review còn tồn tại có một test tái hiện: FAIL trước khi sửa, PASS sau khi sửa.
  - #2 ở tầng `check-scope`: từ khóa quan hệ viết thường (`chỉ đọc`) làm module bị sửa tự do. Nay so khớp chính xác; từ khóa lạ thì báo lỗi.
  - #3: file tên có dấu (`giỏ-hàng.ts`) bị git đặt trong ngoặc kép (`"src/cart/gi\341…"`) nên lọt khỏi module. Nay dùng `core.quotePath=false` và `-z`.
  - #4: `git mv` từ `cart` sang `pricing` chỉ in đường dẫn đích, nên `cart` không bị tính là đã sửa. Nay dùng `--no-renames`.
  - #5 (trùng số spec) và #6 (branch không có spec thì im lặng thoát) không còn tồn tại: từ GĐ 2b, script nhận đường dẫn spec tường minh và không suy spec từ tên branch nữa.

## How to verify
```bash
bash tests/check-ready/run.sh
```

## Result
Trước khi sửa (test mới chạy trên script cũ):
```
PASS  scope-declared-module
PASS  scope-read-only-module
PASS  scope-uses-gf-code-dir
FAIL  scope-unicode-file-in-read-only-module — exit 0, cần 1
FAIL  scope-file-moved-out-of-read-only-module — exit 0, cần 1
FAIL  scope-lowercase-relation — exit 0, cần 1
25 passed, 3 failed
```
Sau khi sửa:
```
PASS  scope-declared-module
PASS  scope-read-only-module
PASS  scope-uses-gf-code-dir
PASS  scope-unicode-file-in-read-only-module
PASS  scope-file-moved-out-of-read-only-module
PASS  scope-lowercase-relation
28 passed, 0 failed
```
Test end-to-end của engine (gate gọi `check-scope`): `ℹ tests 13 · ℹ pass 13 · ℹ fail 0`.

## Not done / follow-ups
- `module_of` vẫn chỉ hỗ trợ glob dạng `prefix/*`. Glob có `*` ở giữa (`packages/*/src/*`) chưa được hỗ trợ.
