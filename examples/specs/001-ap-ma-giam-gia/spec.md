# Spec 001 — Áp mã giảm giá

**Trạng thái:** approved
**Tác giả:** dev-a · **Người duyệt:** dev-b · **Cập nhật:** 2026-09-29
**Branch:** `feat/001-ap-ma-giam-gia` · **Roadmap:** Phase 1
**Liên quan:** không có

---

## 1. Bối cảnh & vấn đề
Khách không áp được mã giảm giá khi tính giá đơn hàng, nên đội bán hàng phải trừ tay.

## 2. Mục tiêu
- `priceOrder` nhận thêm mã giảm giá và trả tổng tiền đã trừ

## 3. Phạm vi
### Trong phạm vi
- Một mã giảm giá cố định cho mỗi đơn hàng
### Ngoài phạm vi (agent KHÔNG được làm)
- Lưu mã giảm giá vào database
- Áp nhiều mã cùng lúc

## 4. Phụ thuộc
| Module | Quan hệ | Ghi chú |
|---|---|---|
| cart | Chỉ đọc | Dùng `cartTotal` |
| pricing | Sửa nội bộ | Thêm tham số mã giảm giá cho `priceOrder` |

## 5. Người dùng & luồng sử dụng
### Vai trò
| Vai trò | Mô tả | Quyền |
|---|---|---|
| Hệ thống bán hàng | Gọi `priceOrder` | Tính giá mọi đơn |

### Luồng chính
1. Hệ thống gọi `priceOrder(items, code)`
2. Mã còn hạn thì tổng tiền được trừ giá trị của mã

### Luồng thay thế & lỗi
- **Nếu** mã đã hết hạn **thì** ném lỗi có `code` là `PROMO_EXPIRED` (AC-2)

## 6. Yêu cầu chức năng
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-1 | Hệ thống phải trừ 50.000đ khi mã là `GIAM50K` | Must |
| FR-2 | Hệ thống phải từ chối mã `HETHAN` | Must |

## 7. Yêu cầu phi chức năng
| ID | Loại | Yêu cầu đo được |
|---|---|---|
| NFR-1 | Hiệu năng | `priceOrder` chạy dưới 5ms với 100 sản phẩm |

## 8. Tiêu chí nghiệm thu
**AC-1** (FR-1)
- **Given** giỏ có một sản phẩm giá 500.000đ, số lượng 1
- **When** gọi `priceOrder(items, "GIAM50K")`
- **Then** `total` là 450000 và `subtotal` là 500000

**AC-2** (FR-2)
- **Given** giỏ có một sản phẩm giá 500.000đ, số lượng 1
- **When** gọi `priceOrder(items, "HETHAN")`
- **Then** hàm ném lỗi có `code` là `PROMO_EXPIRED`

## 9. Dữ liệu
- **Entity mới / thay đổi:** không có
- **Dữ liệu hiện có bị ảnh hưởng / migration:** không có

## 10. Ràng buộc & giả định
- **Ràng buộc:** không thêm dependency
- **Giả định:** danh sách mã được viết cứng trong module pricing

## 11. Brownfield: hành vi hiện tại (bỏ qua nếu greenfield)

## 12. Rủi ro
| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| Làm đổi kết quả của lời gọi `priceOrder(items)` cũ | Thấp | Sai giá | Tham số mã là tùy chọn |

## 13. Câu hỏi mở
| # | Câu hỏi | Mức | Người trả lời | Trả lời |
|---|---|---|---|---|
| Q1 | Mã có phân biệt hoa thường không? | ✅ | PO | Có phân biệt |

## 14. Lịch sử thay đổi
| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-09-29 | Khởi tạo | |
