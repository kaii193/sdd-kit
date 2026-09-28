# Plan NNN — <Tên tính năng>

**Trạng thái:** draft
**Spec:** [spec.md](./spec.md) · **Người duyệt:** <tên>

> Plan trả lời **LÀM THẾ NÀO**. Mâu thuẫn với constitution → dừng, đề xuất ADR.
> Trạng thái: `draft` → `approved`.

---

## 1. Hướng tiếp cận
<3–5 câu. Phương án thay thế đã cân nhắc và lý do loại.>

## 2. Tuân thủ
- [ ] Đúng tech stack trong constitution
- [ ] Chỉ sửa module khai báo trong spec mục Phụ thuộc
- [ ] Chỉ dùng module khác qua cửa vào công khai
- [ ] Không thêm dependency ngoài quy định (hoặc đã xin phép: <...>)

## 3. Tái sử dụng
> Agent PHẢI tìm trong codebase và `sdd/patterns.md` trước khi điền mục này.

### 3.1 Dùng lại
| Thứ có sẵn | Vị trí | Dùng để |
|---|---|---|
| | | |

### 3.2 Tạo mới
| Thứ mới | Vị trí dự kiến | Vì sao không dùng cái có sẵn |
|---|---|---|
| | | |

## 4. Pattern áp dụng
| Phần việc | Làm theo file mẫu |
|---|---|
| | <từ sdd/patterns.md> |

## 5. Thay đổi hợp đồng (bỏ qua nếu không có `Sửa hợp đồng`)
- **Hợp đồng:** <type/API/schema nào, ở đâu>
- **Kiểu thay đổi:** ☐ Không phá vỡ (thêm trường tùy chọn…) ☐ Phá vỡ → expand–contract
- **Bên đang dùng bị ảnh hưởng:** <module + test sẽ chạy lại>
- **PR riêng:** `feature/NNN-contract-...` · **Chủ module duyệt:** @<tên> · **ADR:** <nếu có>

## 6. File bị ảnh hưởng
| File | Thêm/Sửa/Xóa | Mô tả |
|---|---|---|
| | | |

## 7. Thiết kế chi tiết
### 7.1 Dữ liệu
### 7.2 API / Interface
### 7.3 Logic chính

## 8. Chiến lược test
| AC | Loại test | File test |
|---|---|---|
| AC-1 | unit / integration / e2e | |

## 9. Triển khai
- **Migration:** <...>
- **Feature flag:** <...>
- **Rollback:** <...>
