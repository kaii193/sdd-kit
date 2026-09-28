# Constitution — <Tên dự án>

> Tài liệu cấp cao nhất. Mọi spec, plan, code phải tuân theo.
> Nguyên tắc: điều gì kiểm tra được bằng máy (type, lint, test) thì ghi ở đây **chỗ nó được kiểm tra**, không chỉ mô tả bằng lời.

**Phiên bản:** 1.0 · **Cập nhật:** YYYY-MM-DD · **Chủ sở hữu:** <tên/team>
**Loại dự án:** ☐ Greenfield ☐ Brownfield

---

## 1. Sứ mệnh
- **Vấn đề:** <2–3 câu>
- **Người dùng mục tiêu:** <ai, bối cảnh sử dụng>
- **Thành công đo bằng:** <chỉ số cụ thể>
- **Không phải là:** <những gì dự án KHÔNG làm>

## 2. Công nghệ
| Tầng | Lựa chọn | Phiên bản | Lý do / ADR |
|---|---|---|---|
| Ngôn ngữ | | | |
| Framework | | | |
| Database | | | |
| Hạ tầng / Deploy | | | |
| Test | | | |

**Dependency mới:** ☐ Tự do ☐ Phải hỏi trước ☐ Chỉ trong danh sách: <...>

## 3. Kiến trúc & ranh giới module

### 3.1 Tổng quan
<Mô tả hoặc sơ đồ Mermaid các thành phần chính.>

### 3.2 Danh sách module
> Tên module phải khớp với cách `sdd/config.sh` nhận diện (tên thư mục).

| Module | Trách nhiệm | Cửa vào công khai | Được phụ thuộc vào | Chủ sở hữu |
|---|---|---|---|---|
| <vd: pricing> | <tính giá, thuế> | `src/pricing/index.ts` | <cart, promotion> | @<tên> |

**Quy tắc:** module khác chỉ được import qua cửa vào công khai, không import vào bên trong.

### 3.3 Hợp đồng dùng chung (dạng code)
| Loại | Vị trí | Kiểm tra bởi |
|---|---|---|
| Type / interface dùng chung | <vd: src/*/index.ts, packages/contracts> | Type check |
| API | <vd: openapi.yaml> | <vd: contract test> |
| Schema DB / event | <vd: migrations/, schemas/> | <...> |

### 3.4 Công cụ ép ranh giới
- Kiểm tra import giữa module: <vd: dependency-cruiser / eslint-plugin-boundaries / ArchUnit / import-linter / chưa có>
- Kiểm tra phạm vi thay đổi theo spec: `sdd/scripts/check-scope.sh`
- Phát hiện code trùng: <vd: jscpd / chưa có>

## 4. Nguyên tắc
### 4.1 Code
- <Quy ước chính. Chi tiết pattern và file mẫu: xem `sdd/patterns.md`.>
### 4.2 Test
- <vd: Mỗi AC có test tự động; mỗi module có contract test cho cửa vào công khai>
### 4.3 Bảo mật & dữ liệu
- <vd: không log dữ liệu cá nhân; secret qua biến môi trường>
### 4.4 Hiệu năng & vận hành
- <vd: API p95 < 300ms; tính năng mới có log/metric>

## 5. Bối cảnh Brownfield (bỏ qua nếu greenfield)
- **Vùng không động vào:** <module/thư mục>
- **Vùng đang hiện đại hóa:** <module + hướng đi>
- **Nợ kỹ thuật đã biết:** <...>
- **Quy tắc nghiệp vụ ngầm:** <người hiểu hệ thống xác nhận>
- **Mức độ test:** <vùng nào thiếu test>

## 6. Lộ trình
| Giai đoạn | Mục tiêu | Spec | Trạng thái |
|---|---|---|---|
| Phase 1 | | 001, 002 | ☐ |

### Spec đang thực hiện (điều phối tránh đụng độ)
| Spec | Người phụ trách | Module sửa | Bắt đầu |
|---|---|---|---|
| | | | |

## 7. Lịch sử sửa đổi
| Ngày | Phiên bản | Thay đổi | Lý do / ADR |
|---|---|---|---|
| | 1.0 | Khởi tạo | |
