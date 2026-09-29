# SDD Kit — Cài đặt

Bộ công cụ Spec-Driven Development cài được vào mọi dự án (mọi ngôn ngữ, greenfield hoặc brownfield).
File này chỉ hướng dẫn **cài kit**; sau khi cài, hướng dẫn sử dụng nằm ở `sdd/GUIDE.md` trong dự án.

## Yêu cầu
- Node ≥ 18 để chạy bộ cài. Bước cài không cần bash.
- Git; bash ≥ 4 để chạy các script trong `sdd/scripts/` (Windows: Git Bash; macOS: `brew install bash`)
- CI mặc định: GitHub Actions (CI khác: xem GUIDE mục 8.3)

## Cài
```bash
npx github:kaii193/sdd-kit install --directory /duong/dan/du-an --modules gf --tools claude-code --yes
```
Không truyền `--yes` thì CLI hỏi từng tham số còn thiếu, liệt kê file sẽ ghi, rồi hỏi xác nhận.

| Tham số | Giá trị |
|---|---|
| `--modules` | `sdd`: lõi SDD · `gf`: bộ agent cho Claude Code, tự kéo theo `sdd` |
| `--tools` | `claude-code` → `CLAUDE.md` · `cursor` → `.cursor/rules/sdd.mdc` · `github-copilot` → `.github/copilot-instructions.md`. Nhiều tool thì cách nhau dấu phẩy. Module `gf` bắt buộc có `claude-code` |
| `--no-ci` | Không cài `.github/workflows/` |

Bộ cài **không ghi đè** file có sẵn, kể cả `README.md` của dự án (kit không đụng tới file này). Danh sách file đã cài được ghi vào `.gf/manifest.json`; nên commit file này.

## Cập nhật và kiểm tra
```bash
npx github:kaii193/sdd-kit update --directory /duong/dan/du-an
npx github:kaii193/sdd-kit doctor --directory /duong/dan/du-an [--autonomous]
```

`update` chia file làm hai loại:

| Loại | Ví dụ | Khi `update` |
|---|---|---|
| Của bạn | `AGENTS.md`, `CLAUDE.md`, `sdd/config.sh`, `sdd/constitution.md`, `sdd/patterns.md`, `.github/pull_request_template.md` | Không bao giờ đụng |
| Của kit | `sdd/scripts/*`, template spec, workflow CI | Nâng cấp nếu bạn chưa sửa. Đã sửa thì giữ nguyên, bản mới ghi vào `*.gf-new` để bạn tự so |

`doctor` kiểm: git repo, Node, bash, đã cài kit, AGENTS.md mục 7 đã điền, `MODULE_GLOBS` khớp thư mục. Thêm `--autonomous` thì kiểm luôn biến môi trường Telegram và việc đăng nhập `gh`.

## Những gì được cài
| Đường dẫn | Vai trò |
|---|---|
| `AGENTS.md` | Luật cho AI agent |
| `CLAUDE.md`, `.cursor/rules/sdd.mdc`, `.github/copilot-instructions.md` | File nạp luật theo `--tools` |
| `.gf/manifest.json` | Version kit, module, tool và hash của từng file đã cài |
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
Xóa `AGENTS.md`, file nạp luật, `sdd/`, `.gf/`, `.github/workflows/sdd-check.yml`, `.github/pull_request_template.md`.
