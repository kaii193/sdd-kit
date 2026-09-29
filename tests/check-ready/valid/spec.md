# Spec 001 — Áp mã giảm giá

**Trạng thái:** approved
**Tác giả:** dev-a · **Người duyệt:** dev-b · **Cập nhật:** 2026-09-28
**Branch:** `feat/001-ap-ma-giam-gia` · **Roadmap:** Phase 1
**Liên quan:** ADR-012

---

## 1. Bối cảnh & vấn đề
Khách hàng không nhập được mã giảm giá ở bước thanh toán nên bỏ giỏ hàng.

## 2. Mục tiêu
- Khách áp được một mã giảm giá còn hạn ở bước thanh toán

## 3. Phạm vi
### Trong phạm vi
- Áp một mã giảm giá cho một đơn hàng
### Ngoài phạm vi (agent KHÔNG được làm)
- Áp nhiều mã cùng lúc
- Trang quản trị tạo mã

## 4. Phụ thuộc
| Module | Quan hệ | Ghi chú |
|---|---|---|
| cart, promotion | Chỉ đọc | |
| pricing | Sửa nội bộ | |
| invoice | Bị ảnh hưởng | Đang dùng PriceResult |

## 5. Người dùng & luồng sử dụng
### Vai trò
| Vai trò | Mô tả | Quyền |
|---|---|---|
| Khách | Người mua hàng | Áp mã cho đơn của mình |

### Luồng chính
1. Khách nhập mã ở bước thanh toán
2. Hệ thống trừ giá trị mã vào tổng tiền

### Luồng thay thế & lỗi
- **Nếu** mã đã hết hạn **thì** từ chối mã, tổng tiền không đổi (AC-2)

## 6. Yêu cầu chức năng
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-1 | Hệ thống phải trừ giá trị mã còn hạn vào tổng tiền | Must |
| FR-2 | Hệ thống phải từ chối mã hết hạn | Must |

## 7. Yêu cầu phi chức năng
| ID | Loại | Yêu cầu đo được |
|---|---|---|
| NFR-1 | Hiệu năng | API áp mã p95 < 300ms |

## 8. Tiêu chí nghiệm thu
**AC-1** (FR-1)
- **Given** giỏ hàng tổng 500.000đ và mã `GIAM50K` còn hạn
- **When** khách áp mã `GIAM50K`
- **Then** tổng tiền là 450.000đ

**AC-2** (FR-2)
- **Given** mã `HETHAN` hết hạn từ 2026-01-01
- **When** khách áp mã `HETHAN`
- **Then** trả về HTTP 422, code "PROMO_EXPIRED", tổng tiền không đổi

## 9. Dữ liệu
- **Entity mới / thay đổi:** không có
- **Dữ liệu hiện có bị ảnh hưởng / migration:** không có

## 10. Ràng buộc & giả định
- **Ràng buộc:** mỗi đơn chỉ áp một mã
- **Giả định:** mã không phân biệt hoa thường

## 11. Tài nguyên
- **Thiết kế / asset:** không có giao diện
- **Hợp đồng có sẵn:** `src/pricing/index.ts`

## 12. Môi trường chạy thử
- Dùng lệnh chung trong config.sh

## 13. Brownfield: hành vi hiện tại (bỏ qua nếu greenfield)

## 14. Rủi ro
| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| Áp trùng mã khi bấm hai lần | Trung bình | Trừ tiền hai lần | Khóa theo đơn hàng |

## 15. Câu hỏi mở
| # | Câu hỏi | Mức | Người trả lời | Trả lời |
|---|---|---|---|---|
| Q1 | Mã có phân biệt hoa thường không? | ✅ | PO | Không phân biệt |

## 16. Lịch sử thay đổi
| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-09-28 | Khởi tạo | |
