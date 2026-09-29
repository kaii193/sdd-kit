# Bỏ plan.md và tasks.md khỏi luồng spec

Ngày: 2026-09-29 · Branch: `feat/drop-plan-tasks` (xếp chồng lên `feat/gf-human-skills`) · Status: **DONE**

## Goal
Chỉ giữ luồng agent: PM ghi `pm-tasks.json`, Coding ghi `tech/<task>.md`. Bỏ template `plan.md`/`tasks.md` và gate G2, vì không còn thứ gì dùng tới (bạn chốt ngày 2026-09-29, và đã duyệt việc xóa file).

## Success criteria
- [x] `new-spec.sh` chỉ tạo `spec.md` (template `plan.md` và `tasks.md` đã xóa).
- [x] `check-spec.sh` chỉ kiểm spec `approved` và `check-ready`; không còn đòi `plan.md`.
- [x] Không còn tài liệu nào được cài hướng dẫn dùng `plan.md`/`tasks.md`. Trong `GUIDE.md`: đã bỏ các prompt P6/P7/P8, sửa P9/P11/P12 và các bảng.
- [x] `docs/decisions.md`: D2 và D9 được đánh dấu đã thay thế; thêm D12–D16 cho các quyết định lớn của luồng agent. `docs/model.md` được vẽ lại theo luồng mới.

## How to verify
```bash
npm test
```

## Result
```
ℹ tests 93
ℹ pass 93
ℹ fail 0
31 passed, 0 failed
npm test exit=0
```
Các case `check-spec-valid`, `check-spec-approved-not-ready`, `new-spec-*` vẫn pass khi fixture không còn `plan.md`.

## Not done / follow-ups
- Spec đã tạo từ trước (nếu có) vẫn còn `plan.md`/`tasks.md` trong thư mục của nó. Không script nào đọc chúng nữa; có thể xóa tay.
