# Patterns — File mẫu & code dùng chung

> Agent làm theo **ví dụ** tốt hơn làm theo **mô tả**. File này trỏ tới code thật trong dự án.
> Giữ các file mẫu sạch: chúng sẽ được nhân bản khắp dự án.

## 1. File mẫu theo loại công việc
| Khi cần… | Làm theo | Ghi chú |
|---|---|---|
| Thêm endpoint API | <vd: src/orders/controller.ts → service.ts → repository.ts> | |
| Thêm màn hình / trang | <vd: src/web/pages/orders/> | |
| Thêm component UI | <vd: src/ui/Button/> | |
| Truy cập database | <vd: src/orders/repository.ts> | Không query trực tiếp ngoài repository |
| Xử lý lỗi | <vd: src/orders/service.ts> | |
| Viết test đơn vị | <vd: tests/orders/service.test.ts> | |
| Viết contract test | <vd: tests/pricing/contract.test.ts> | |
| Migration DB | <vd: migrations/2026_01_add_orders.sql> | |

## 2. Code dùng chung — tìm ở đây trước khi viết mới
| Nhu cầu | Dùng | Vị trí |
|---|---|---|
| Format tiền / ngày | <vd: formatMoney, formatDate> | <vd: src/shared/format.ts> |
| Gọi HTTP | | |
| Validate input | | |
| Log | | |
| Phân quyền | | |

## 3. Không làm (anti-pattern)
| Không làm | Thay bằng | Đã có lint rule? |
|---|---|---|
| <vd: import vào bên trong module khác> | Import qua `index.ts` | ☐ |
| <vd: tự viết hàm format tiền> | `formatMoney` | ☐ |

## 4. Nhật ký lỗi lặp lại
> Mỗi khi agent lặp lại cùng một lỗi pattern ≥ 2 lần: ghi vào đây, rồi cân nhắc biến thành lint rule.

| Ngày | Lỗi | Xử lý (thêm mẫu / thêm lint rule / sửa AGENTS.md) |
|---|---|---|
| | | |
