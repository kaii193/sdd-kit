---
name: gf-spec
description: Giúp dev viết spec cho một tính năng vừa đủ (1–5 ngày) trong thư mục gốc gf, đủ chi tiết để bộ agent implement mà không phải hỏi lại, kèm debate spec giữa ba agent phản biện. Dùng khi dev muốn viết spec, mô tả một tính năng mới cần làm, hoặc gõ /gf-spec.
---

# gf-spec

Mục tiêu: một spec mà agent implement **không phải hỏi lại gì**, vì khi chạy độc lập sẽ không có ai để hỏi. Dev quyết định nội dung; agent hỏi, soi và ghi lại. Spec chỉ được đặt `approved` khi `check-ready` pass.

## Điều kiện

Phiên đang mở trong thư mục gốc gf (có `.gf/manifest.json`), và đã có ít nhất một dự án trong `projects/`. Chưa có dự án nào thì hướng dẫn dev chạy `/gf-init` trước.

## Các bước

1. **Chọn dự án.** Có nhiều dự án trong `projects/` thì hỏi dev chọn dự án nào.

2. **Tiếp nhận.** Dev mô tả tính năng trong 2–5 câu. Nếu tính năng lớn hơn 1–5 ngày làm, hoặc chạm hơn 6–8 module, đề xuất tách nhỏ trước khi viết.

3. **Tạo thư mục spec:** `bash .gf/scripts/new-spec.sh <dự-án> <ten-tinh-nang>`.

4. **Tra cứu.** Giao agent `gf-spec-researcher` (repo code là `PROJECT_PATH` trong `projects/<dự-án>/config.sh`). Ghi các phần dựa trên dữ kiện vào spec (Phụ thuộc, Hành vi hiện tại, Tài nguyên) kèm bằng chứng và nhãn `[ĐỀ XUẤT]`. Dev xác nhận thì bỏ nhãn.

5. **Phỏng vấn từng mục**, mỗi lần 1–2 câu: Bối cảnh → Mục tiêu → Phạm vi / Ngoài phạm vi → Luồng chính và luồng lỗi → Yêu cầu chức năng → AC → **Tài nguyên** → **Môi trường chạy thử**. Ghi lại lời dev, đọc lại cho dev xác nhận. Câu nào không có nguồn thì gắn `[SUY ĐOÁN]`.

6. **Rèn AC.** Với từng AC:
   - Có quan sát được không? Có giá trị cụ thể không (số liệu, mã lỗi, trạng thái)?
   - Gợi ý các trường hợp biên: rỗng/null, biên, trùng lặp, đồng thời, phân quyền, bên phụ thuộc bị lỗi hoặc timeout, dữ liệu cũ. Dev chọn thêm thành AC hay đưa vào Ngoài phạm vi.
   - AC giao diện: hỏi rõ viewport, đường dẫn asset, và layout (có mặt, thứ tự, chứa trong, vị trí tương đối).
   - Mỗi luồng lỗi phải trỏ tới AC kiểm tra nó, dạng `(AC-x)`.

7. **Debate spec** (tối đa 5 vòng; file nằm trong `<spec>/debate/`):
   - **Vòng 1:** giao song song, độc lập (không agent nào thấy bài của agent khác) cho `gf-spec-critic-user`, `gf-spec-critic-attacker`, `gf-spec-critic-maintainer`. Lưu câu trả lời vào `debate/round-1/user.md`, `attacker.md`, `maintainer.md`.
   - Giao `gf-spec-moderator` tổng hợp vòng đó.
   - **Vòng 2–5:** chỉ chạy khi moderator trả `DEBATE: CONTINUE`. Mỗi critic nhận bài của hai vai kia ở vòng trước, cùng `spec-review.md`, và trả lời từng luận điểm. Lưu vào `debate/round-<n>/`.
   - Moderator trả `DEBATE: STOP` thì các vấn đề đã nằm trong bảng Câu hỏi mở. Hỏi dev từng câu 🔴, ghi câu trả lời vào spec, đổi mức sang ✅.

8. **Kiểm tra sẵn sàng:** `bash .gf/scripts/check-ready.sh projects/<dự-án>/specs/<NNN-ten>`. Còn lỗi thì quay lại đúng mục bị lỗi và hỏi dev. Không tự điền cho qua.

9. **Chỉ khi `check-ready` pass**, đổi dòng `**Trạng thái:**` trong `spec.md` thành `approved`, rồi báo dev: runner sẽ lấy spec này ở lần chạy kế tiếp, hoặc dev tự chạy `/gf-implement <dự-án> <NNN>`.

## Không làm

- Không viết chi tiết kỹ thuật; đó là việc của Coding Agent (`tech/`).
- Không tự quyết thay dev. Chỗ chưa rõ đưa vào Câu hỏi mở, 🔴 nếu chặn.
- Không đặt `approved` khi `check-ready` còn lỗi.
