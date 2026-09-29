# gf-autopilot

Dev viết spec. Bộ agent Claude Code tự triển khai, tự kiểm chứng theo spec, và báo cáo qua Telegram.

- `/gf-spec`: agent hỏi, soi và tra cứu giúp dev viết spec; ba critic debate spec; `check-ready` chặn spec chưa đủ để agent làm mà không phải hỏi lại.
- `/gf-implement` hoặc runner mỗi giờ trên Claude Desktop Schedule: PM chia task → QC viết test trước (khóa) → Coding implement → gate máy → Reviewer → QC nghiệm thu. Tối đa 3 vòng; mỗi PM task một PR draft; không tự merge.
- Máy trạng thái tất định giữ luật (vòng, FAILED, BLOCKED); agent không tự đếm, không tự ghi kết quả bước máy.

## Nguyên tắc
- Không thay thế hiểu biết của dev về hệ thống. Spec là nơi hiểu biết đó được viết ra; là thứ duy nhất người đưa vào.
- Hợp đồng giữa module là code, ranh giới do công cụ ép, hành vi do test bảo vệ.
- Máy kiểm tra được thì để máy kiểm tra; người review phần còn lại.

## Thành phần
| Thư mục | Nội dung |
|---|---|
| `modules/sdd/home/` | File cài vào thư mục gốc gf: `AGENTS.md`, `GUIDE.md`, `.gf/scripts/`, `.gf/templates/` |
| `modules/sdd/project/` | Template cho mỗi dự án được link (`config.sh`, `constitution.md`, `patterns.md`) |
| `modules/sdd/tools/claude-code/` | `CLAUDE.md` của thư mục gốc |
| `modules/gf/claude/` | Skill và agent cài vào `~/.claude` (`gf-init`, `gf-spec`, `gf-implement`, 9 agent) |
| `modules/gf/home/` | `runner.md`: prompt cho tác vụ Desktop Schedule |
| `bin/`, `lib/` | CLI: install, update, doctor, init-project, và engine `run …` |
| `examples/` | App mẫu `shop-api` và spec mẫu |
| `tests/` | Test tất định của CLI, engine và script |
| `docs/model.md`, `docs/decisions.md` | Mô hình và các quyết định thiết kế |

## Bắt đầu
Xem [INSTALL.md](INSTALL.md) để cài, sau đó đọc `GUIDE.md` trong thư mục gốc gf.

Repo trên GitHub vẫn là `kaii193/sdd-kit`, nên lệnh cài là `npx github:kaii193/sdd-kit …`.
