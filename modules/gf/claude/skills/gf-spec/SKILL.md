---
name: gf-spec
description: Giúp dev viết spec cho một tính năng vừa đủ (1–5 ngày) trong thư mục gốc gf, đủ chi tiết để bộ agent implement mà không phải hỏi lại. Dùng khi dev muốn viết spec, mô tả một tính năng mới cần làm, hoặc gõ /gf-spec.
---

# gf-spec

Mục tiêu: một spec mà agent implement **không phải hỏi lại gì**. Dev quyết định nội dung, agent hỏi, soi và ghi lại. Spec chỉ được đặt `approved` khi `check-ready` pass.

## Điều kiện

Phiên đang mở trong thư mục gốc gf (có `.gf/manifest.json`) và đã có ít nhất một dự án trong `projects/`. Chưa có dự án nào thì hướng dẫn dev chạy `/gf-init` trước.

## Các bước

1. **Chọn dự án.** Có nhiều dự án trong `projects/` thì hỏi dev chọn dự án nào.

2. **Tiếp nhận.** Dev mô tả tính năng trong 2–5 câu. Nếu tính năng lớn hơn 1–5 ngày làm, hoặc chạm hơn 6–8 module, đề xuất tách nhỏ trước khi viết.

3. **Tạo thư mục spec:**
   ```bash
   bash .gf/scripts/new-spec.sh <dự-án> <ten-tinh-nang>
   ```

4. **Tra cứu repo code, chỉ đọc.** Đường dẫn repo là `PROJECT_PATH` trong `projects/<dự-án>/config.sh`. Tìm các module liên quan, những nơi đang dùng hợp đồng bị đổi, và hành vi hiện tại. Ghi các phần dựa trên dữ kiện (Phụ thuộc, Hành vi hiện tại) kèm bằng chứng `file:dòng` và nhãn `[ĐỀ XUẤT]`. Dev xác nhận thì bỏ nhãn.

5. **Phỏng vấn từng mục**, mỗi lần 1–2 câu: Bối cảnh → Mục tiêu → Phạm vi / Ngoài phạm vi → Luồng chính và luồng lỗi → Yêu cầu chức năng → AC. Ghi lại lời dev, đọc lại cho dev xác nhận. Câu nào không có nguồn thì gắn `[SUY ĐOÁN]`.

6. **Rèn AC.** Với từng AC:
   - Có quan sát được không? Có giá trị cụ thể không (số liệu, mã lỗi, trạng thái)?
   - Gợi ý các trường hợp biên: rỗng/null, biên, trùng lặp, đồng thời, phân quyền, bên phụ thuộc bị lỗi hoặc timeout, dữ liệu cũ. Dev chọn thêm thành AC hay đưa vào Ngoài phạm vi.
   - AC giao diện: hỏi rõ viewport, đường dẫn asset, và layout (có mặt, thứ tự, chứa trong, vị trí tương đối).
   - Mỗi luồng lỗi phải trỏ tới AC kiểm tra nó, dạng `(AC-x)`.

7. **Kiểm tra sẵn sàng:**
   ```bash
   bash .gf/scripts/check-ready.sh projects/<dự-án>/specs/<NNN-ten>
   ```
   Còn lỗi thì quay lại đúng mục bị lỗi và hỏi dev. Không tự điền cho qua.

8. **Chỉ khi `check-ready` pass**, đổi dòng `**Trạng thái:**` trong `spec.md` thành `approved`, rồi báo dev: runner sẽ lấy spec này trong lần chạy kế tiếp.

## Không làm

- Không viết chi tiết kỹ thuật (thuộc về plan).
- Không tự quyết thay dev. Chỗ chưa rõ đưa vào Câu hỏi mở, 🔴 nếu chặn.
- Không đặt `approved` khi `check-ready` còn lỗi.
