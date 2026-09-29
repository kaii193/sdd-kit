# Spec NNN — <Tên tính năng>

**Trạng thái:** draft
**Tác giả:** <tên> · **Người duyệt:** <tên> · **Cập nhật:** YYYY-MM-DD
**Branch:** `feat/NNN-ten-tinh-nang` · **Roadmap:** Phase X
**Liên quan:** <spec khác, ADR, ticket>

> Spec trả lời **CÁI GÌ** và **TẠI SAO**. Chi tiết kỹ thuật do Coding Agent ghi trong `tech/`.
> Trạng thái: `draft` → `in-review` → `approved` → `implemented` (hoặc `superseded`).
> Chỉ đặt `approved` khi `bash .gf/scripts/check-ready.sh <thư mục spec>` pass. Nhãn `[SUY ĐOÁN]`, `[ĐỀ XUẤT]` phải được dev xác nhận rồi xóa trước đó.

---

## 1. Bối cảnh & vấn đề
<Vấn đề gì? Ai gặp? Hậu quả nếu không giải quyết?>

## 2. Mục tiêu
- <Mục tiêu đo được>

## 3. Phạm vi
### Trong phạm vi
- <...>
### Ngoài phạm vi (agent KHÔNG được làm)
- <...>

## 4. Phụ thuộc
> Liệt kê **module**, không liệt kê file. Tên module khớp `MODULE_GLOBS` trong `config.sh` của dự án.
> Quan hệ (dùng đúng từ khóa — script CI đọc cột này):
> `Chỉ đọc` · `Sửa nội bộ` · `Sửa hợp đồng` · `Mới` · `Bị ảnh hưởng`
> Nhiều module cùng quan hệ: viết cách nhau dấu phẩy.

| Module | Quan hệ | Ghi chú |
|---|---|---|
| | | |

## 5. Người dùng & luồng sử dụng
### Vai trò
| Vai trò | Mô tả | Quyền |
|---|---|---|
| | | |

### Luồng chính
1. Người dùng ...
2. Hệ thống ...

### Luồng thay thế & lỗi
> Mỗi luồng trỏ tới AC kiểm tra nó, ví dụ `(AC-2)`. Không có luồng lỗi nào thì xóa dòng mẫu.

- **Nếu** <điều kiện> **thì** <phản hồi> (AC-x)

## 6. Yêu cầu chức năng
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-1 | Hệ thống phải ... | Must |

## 7. Yêu cầu phi chức năng
| ID | Loại | Yêu cầu đo được |
|---|---|---|
| NFR-1 | Hiệu năng | |

## 8. Tiêu chí nghiệm thu
> Mỗi AC phải chuyển được thành ít nhất một test tự động. Có số liệu, mã lỗi, trạng thái cụ thể.
> Không dùng từ mơ hồ trong Given/When/Then (danh sách `VAGUE_WORDS` trong `config.sh` của dự án).
> AC giao diện: nêu viewport, asset (đường dẫn file), layout (có mặt, thứ tự, chứa trong, vị trí tương đối). Không so sánh screenshot.

**AC-1** (FR-1)
- **Given** <trạng thái ban đầu>
- **When** <hành động>
- **Then** <kết quả cụ thể, kiểm tra được>

## 9. Dữ liệu
- **Entity mới / thay đổi:** <...>
- **Dữ liệu hiện có bị ảnh hưởng / migration:** <...>

## 10. Ràng buộc & giả định
- **Ràng buộc:** <...>
- **Giả định:** <nếu sai thì spec phải xem lại>

## 11. Tài nguyên
> Mọi thứ agent cần để làm mà không phải hỏi lại. Đường dẫn file viết trong `backtick`, tương đối so với repo code; `check-ready` kiểm file có tồn tại.

- **Thiết kế / asset:** <link thiết kế, đường dẫn asset — hoặc "không có giao diện">
- **Hợp đồng có sẵn (API, schema, type):** <đường dẫn>
- **Dữ liệu mẫu / tài khoản test:** <...>

## 12. Môi trường chạy thử
> Cách chạy app và e2e cho tính năng này. Giống lệnh chung trong `config.sh` thì ghi "dùng lệnh chung".

- <...>

## 13. Brownfield: hành vi hiện tại (bỏ qua nếu greenfield)
- **Hành vi hiện tại:** <...>
- **PHẢI GIỮ NGUYÊN:** <...>
- **Characterization test cần có trước:** <...>

## 14. Rủi ro
| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| | | | |

## 15. Câu hỏi mở
> Mức: 🔴 chặn · 🟡 không chặn · ✅ đã giải quyết. Gate G1: không còn dòng 🔴.

| # | Câu hỏi | Mức | Người trả lời | Trả lời |
|---|---|---|---|---|
| Q1 | | | | |

## 16. Lịch sử thay đổi
| Ngày | Thay đổi | Lý do |
|---|---|---|
| | Khởi tạo | |
