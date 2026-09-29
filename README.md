# SDD Kit

Bộ công cụ Spec-Driven Development cài được vào mọi dự án, mọi ngôn ngữ, greenfield hoặc brownfield. Kit giúp team làm việc với AI coding agent theo hướng spec-first mà vẫn giữ được kiểm soát ở dự án lớn.

## Nguyên tắc
- SDD không thay thế hiểu biết của dev về hệ thống. Spec là nơi hiểu biết đó được viết ra để người và agent dùng chung.
- Spec trả lời cái gì và tại sao. Plan trả lời làm thế nào và dùng lại gì. Tasks là các bước.
- Hợp đồng giữa module là code, ranh giới do công cụ ép, hành vi do test bảo vệ. Tài liệu chỉ trỏ tới những thứ đó.
- Nhiều lớp phòng thủ, mỗi lớp bắt một loại lỗi.

## Thành phần
| Thư mục | Nội dung |
|---|---|
| `modules/sdd/files/` | File lõi được cài vào dự án: `AGENTS.md`, `sdd/`, `.github/` |
| `modules/sdd/tools/` | File nạp luật cho Claude Code, Cursor, Copilot |
| `modules/gf/` | Bộ agent gf cho Claude Code (đang xây) |
| `bin/`, `lib/` | Bộ cài `npx github:kaii193/sdd-kit` (install, update, doctor) |
| `tests/` | Test của bộ cài và của script kiểm tra spec |
| `docs/model.md` | Sơ đồ cấu trúc và quy trình |
| `docs/decisions.md` | Các quyết định thiết kế và lý do |

## Bắt đầu
Xem [INSTALL.md](INSTALL.md) để cài, sau đó đọc `sdd/GUIDE.md` trong dự án.
