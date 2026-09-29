# SDD Kit — Cài đặt

Bộ công cụ Spec-Driven Development cài được vào mọi dự án (mọi ngôn ngữ, greenfield hoặc brownfield).
File này chỉ hướng dẫn **cài kit**; sau khi cài, hướng dẫn sử dụng nằm ở `sdd/GUIDE.md` trong dự án.

## Yêu cầu
- Git; bash ≥ 4 (Linux có sẵn; macOS: `brew install bash`)
- CI mặc định: GitHub Actions (CI khác: xem GUIDE mục 8.3)

## Cài
```bash
bash install.sh /duong/dan/du-an --tool claude
```

| `--tool` | Tạo thêm |
|---|---|
| `claude` | `CLAUDE.md` |
| `cursor` | `.cursor/rules/sdd.mdc` |
| `copilot` | `.github/copilot-instructions.md` |
| bỏ trống | Không tạo gì thêm, agent tự đọc `AGENTS.md` |
Tuỳ chọn: `--no-ci` (không cài workflow), `--force` (ghi đè file đã có).
Script **không ghi đè** file có sẵn (kể cả `README.md` của dự án — kit không đụng tới file này).

## Những gì được cài
| Đường dẫn | Vai trò |
|---|---|
| `AGENTS.md` | Luật cho AI agent |
| `CLAUDE.md`, `.cursor/rules/sdd.mdc`, `.github/copilot-instructions.md` | Adapter theo `--tool` |
| `.github/workflows/sdd-check.yml` | CI chạy check-spec và check-scope |
| `.github/pull_request_template.md` | Checklist Gate G3 |
| `.github/CODEOWNERS.example` | Mẫu chủ sở hữu module |
| `sdd/GUIDE.md` | Hướng dẫn triển khai cho người |
| `sdd/config.sh` | Cấu hình module, nhánh chính |
| `sdd/constitution.md` | Hiến pháp dự án |
| `sdd/patterns.md` | File mẫu và code dùng chung |
| `sdd/decisions/adr-template.md` | Mẫu ADR |
| `sdd/specs/_template/` | Mẫu spec, plan, tasks |
| `sdd/scripts/` | `new-spec.sh`, `check-ready.sh`, `check-spec.sh`, `check-scope.sh`, `lib.sh` |

## Gỡ
Xóa `AGENTS.md`, file adapter, `sdd/`, `.github/workflows/sdd-check.yml`, `.github/pull_request_template.md`.
