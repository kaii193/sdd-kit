---
name: gf-init
description: Link một dự án code vào thư mục gốc gf và thiết lập để bộ agent implement theo spec. Dùng khi dev muốn bắt đầu dùng gf cho một repo code, khi dev gõ /gf-init, hoặc khi một dự án trong projects/ còn thiếu lệnh test, lint hay quyết định mặc định.
---

# gf-init

Thiết lập một dự án code để bộ agent gf làm việc trên nó. Kết quả là thư mục `projects/<tên>/` trong thư mục gốc gf, link tới repo code, có đủ cấu hình để `doctor` xanh.

## Điều kiện

Phiên phải đang mở trong **thư mục gốc gf**: thư mục có `.gf/manifest.json`. Nếu không phải, báo dev mở Claude trong thư mục gốc (thư mục đã truyền cho `--directory` khi cài) rồi dừng.

## Các bước

1. **Hỏi dev hai thứ**, mỗi lần một câu:
   - Tên dự án: chữ thường không dấu, nối bằng `-`, ví dụ `shop-api`.
   - Đường dẫn tuyệt đối tới repo code.

2. **Tạo thư mục dự án:**
   ```bash
   node "{{GF_KIT_BIN}}" init-project --directory . --name <tên> --project "<đường-dẫn>"
   ```
   Lệnh lỗi thì đưa nguyên văn thông báo cho dev và dừng. Không tự sửa rồi thử lại khi dev chưa đồng ý.

3. **Khảo sát repo code, chỉ đọc, không sửa gì.** Mục đích là đề xuất giá trị cho `projects/<tên>/config.sh`:
   - `BASE_BRANCH`
   - `MODULE_GLOBS`: thư mục chứa các module, ví dụ `src/*`, `packages/*`
   - Các lệnh `INSTALL_COMMAND`, `TEST_COMMAND`, `TEST_MODULE_COMMAND`, `LINT_COMMAND`, `E2E_COMMAND`, `RUN_COMMAND`. Lấy từ `package.json`, `Makefile`, `pyproject.toml`, file CI…

   Trình từng nhóm cho dev, ghi rõ bằng chứng (file:dòng) và đánh dấu `[SUY ĐOÁN]` những chỗ không chắc. Dev xác nhận nhóm nào thì ghi nhóm đó vào `config.sh`. Không đoán lệnh mà repo không có.

4. **Phỏng vấn để điền `constitution.md` và `patterns.md`**, mỗi lần 1–2 câu hỏi. Chỗ dev chưa quyết thì ghi `TBD`. Tuyệt đối không bịa.
   - Ưu tiên mục **4.5 Quyết định mặc định cho agent**. Đây là thứ agent dựa vào khi chạy tự động mà spec không nói tới.
   - `patterns.md`: đề xuất 1–2 file mẫu thật trong repo cho từng loại công việc; dev chọn.

5. **Kiểm tra:**
   ```bash
   node "{{GF_KIT_BIN}}" doctor --directory .
   ```
   Báo lại cho dev từng mục còn ✗ và cách sửa.

6. **Nhắc dev hai việc**, vì agent không tự làm được:
   - Mở lại Claude trong thư mục gốc và **chấp nhận hộp thoại tin cậy**. Repo code vừa được thêm vào `additionalDirectories`, mà thiết lập này chỉ có hiệu lực sau khi được chấp nhận.
   - Nếu muốn chạy độc lập: làm theo `runner.md` (tạo một lần cho cả thư mục gốc), rồi chạy `doctor --autonomous`.

## Không làm

- Không sửa file nào trong repo code.
- Không tự tạo spec. Việc đó là của `/gf-spec`.
