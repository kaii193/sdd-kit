# AGENTS.md — Luật làm việc cho AI Agent

> Đọc ở đầu MỌI phiên. Hướng dẫn cho người: `GUIDE.md` (agent không cần đọc trừ khi được yêu cầu).

## 1. Thứ tự đọc ngữ cảnh
1. `projects/<dự-án>/constitution.md` — sứ mệnh, kiến trúc, ranh giới module, nguyên tắc
2. `projects/<dự-án>/patterns.md` — file mẫu cần làm theo, tiện ích dùng chung
3. ADR liên quan trong `projects/<dự-án>/decisions/`
4. Tính năng hiện tại: `projects/<dự-án>/specs/NNN-*/spec.md` → `plan.md` → `tasks.md`
5. Interface công khai của các module trong mục **Phụ thuộc** của spec

## 2. Luật về phạm vi
- KHÔNG viết code khi spec chưa `approved`. KHÔNG code khi plan chưa `approved`.
- KHÔNG làm gì thuộc mục **Ngoài phạm vi**.
- CHỈ sửa module khai báo trong mục **Phụ thuộc** với quan hệ `Sửa hợp đồng`, `Sửa nội bộ` hoặc `Mới`.
- Module `Chỉ đọc` → chỉ được import qua interface công khai, KHÔNG sửa bất kỳ file nào.
- Cần sửa module chưa khai báo → DỪNG, đề xuất cập nhật spec/plan, chờ duyệt.
- Gặp điểm mơ hồ → hỏi lại, ghi vào **Câu hỏi mở**. KHÔNG tự đoán.

## 3. Luật về tái sử dụng & pattern
- TRƯỚC KHI tạo hàm, component, hook, service, type mới: tìm trong codebase và `patterns.md` của dự án xem đã có cái tương tự chưa. Có → dùng lại. Không dùng được → ghi lý do vào mục **Tái sử dụng** của plan.
- Viết code mới theo đúng file mẫu trong `patterns.md` của dự án, không tự nghĩ cấu trúc riêng.
- KHÔNG import vào bên trong module khác; chỉ dùng interface công khai của nó.
- KHÔNG thêm dependency mới nếu constitution không cho phép hoặc chưa được hỏi ý.

## 4. Luật về hợp đồng dùng chung
- Thay đổi hợp đồng (type, API, schema, event dùng chung) được làm TRƯỚC, trong PR riêng, theo `tasks.md` Giai đoạn 0.
- Ưu tiên thay đổi không phá vỡ (thêm trường tùy chọn). Thay đổi phá vỡ → expand–contract, không đổi thẳng.

## 5. Luật về test
- KHÔNG xóa, bỏ qua (skip) hay sửa test hiện có để làm test pass. Test fail → báo cáo.
- Mỗi AC trong spec phải có ít nhất một test tự động.

## 6. Khi làm task
- Làm từng task theo thứ tự trong `tasks.md`. Hết giai đoạn thì DỪNG chờ review.
- Xong task: chạy test liên quan → tick checkbox → commit theo Conventional Commits, chỉ dòng tiêu đề, ví dụ `feat(pricing): apply promo code`.
- Phát hiện spec sai/thiếu → DỪNG, đề xuất sửa spec (ghi Lịch sử thay đổi), chờ duyệt.
- Trước khi báo xong: chạy `bash .gf/scripts/check-scope.sh <thư mục spec>` và sửa mọi lỗi.

## 7. Lệnh dự án
Mỗi dự án khai lệnh trong `projects/<dự-án>/config.sh`: `INSTALL_COMMAND`, `TEST_COMMAND`, `TEST_MODULE_COMMAND`, `LINT_COMMAND`, `E2E_COMMAND`, `RUN_COMMAND`. Chạy các lệnh này trong repo code (`PROJECT_PATH`) hoặc trong worktree của spec.
