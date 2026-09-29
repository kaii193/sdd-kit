# AGENTS.md — Luật làm việc cho AI Agent

> Đọc ở đầu MỌI phiên trong thư mục gốc gf. Hướng dẫn cho người: `GUIDE.md`.

## 1. Thứ tự đọc ngữ cảnh
1. `projects/<dự-án>/constitution.md`: sứ mệnh, kiến trúc, ranh giới module, nguyên tắc, **mục 4.5 Quyết định mặc định cho agent**
2. `projects/<dự-án>/patterns.md`: file mẫu cần làm theo, tiện ích dùng chung
3. ADR liên quan trong `projects/<dự-án>/decisions/`
4. Spec đang làm: `projects/<dự-án>/specs/NNN-*/spec.md`, cùng `pm-tasks.json`, `tech/`, `runs/`
5. Interface công khai của các module trong mục **Phụ thuộc** của spec

## 2. Hai chế độ làm việc
| | Có người (`/gf-implement`) | Độc lập (runner, `--auto`) |
|---|---|---|
| Gặp chỗ spec không nói tới | Hỏi thẳng dev trong chat, mỗi lần một quyết định | Không hỏi, không dừng. Theo spec → constitution 4.5 → phương án ít rủi ro nhất; ghi `run assume` |
| Cần sửa module chưa khai báo trong Phụ thuộc | Hỏi dev có cập nhật spec không | Không sửa; tìm cách làm trong phạm vi đã khai; không được thì báo `RESULT: fail` kèm lý do |
| Cần hành động bị cấm (mục 5) | Hỏi dev | Không làm; ghi `run skip-action`; báo `RESULT: policy` nếu không làm tiếp được |

Máy trạng thái (`node <kit>/bin/gf.js run …`) quyết định bước kế tiếp và đếm vòng. **Không tự đếm, không tự nhảy bước, không sửa `status.json` hay `events.jsonl` bằng tay.**

## 3. Luật về phạm vi
- Chỉ làm spec có `**Trạng thái:** approved`.
- Không làm gì thuộc mục **Ngoài phạm vi**.
- Chỉ sửa module khai báo trong mục **Phụ thuộc** với quan hệ `Sửa hợp đồng`, `Sửa nội bộ` hoặc `Mới`.
- Module `Chỉ đọc`: chỉ được import qua interface công khai, không sửa bất kỳ file nào của nó.
- Code chỉ được sửa trong worktree của spec (`.worktrees/<dự-án>/<spec>`), không sửa trực tiếp repo code gốc.

## 4. Luật về tái sử dụng và pattern
- Trước khi tạo hàm, component, hook, service, type mới: tìm trong codebase và `patterns.md` xem đã có cái tương tự chưa. Có thì dùng lại.
- Viết code mới theo đúng file mẫu trong `patterns.md`; không tự nghĩ cấu trúc riêng.
- Không import vào bên trong module khác; chỉ dùng interface công khai của nó.
- Dependency mới: theo mục 4.5 của constitution.

## 5. Hành động bị cấm (mọi chế độ)
Sửa `FORBIDDEN_PATHS` (mặc định `deploy/`) · chạy migration vào database thật · `git push --force` · đọc, ghi hay in secret · merge PR. Gate máy chặn các thay đổi dưới `FORBIDDEN_PATHS`.

## 6. Luật về test
- Chỉ QC được sửa test. Test đã khóa bị Coding sửa thì gate FAIL.
- QC sửa test phải trích ID trong spec (`run relock --reason "AC-x …"`); số test và số assertion không được giảm.
- Mỗi AC trong spec có ít nhất một test tự động.

## 7. Commit và PR
- Commit theo Conventional Commits, chỉ dòng tiêu đề, ví dụ `feat(pricing): apply promo code`.
- Mỗi PM task một branch `feat/<spec>-p<n>` và một PR **draft**; không tự merge.

## 8. Lệnh dự án
Mỗi dự án khai lệnh trong `projects/<dự-án>/config.sh`: `INSTALL_COMMAND`, `TEST_COMMAND`, `TEST_MODULE_COMMAND`, `LINT_COMMAND`, `E2E_COMMAND`, `RUN_COMMAND`. Chạy trong worktree của spec.
