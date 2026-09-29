# gf-autopilot — Cài đặt

File này chỉ hướng dẫn **cài kit**. Sau khi cài, hướng dẫn sử dụng nằm ở `GUIDE.md` trong thư mục gốc gf.

## Yêu cầu
- Node ≥ 18 để chạy bộ cài. Bước cài không cần bash.
- Git; bash ≥ 4 để chạy các script trong `.gf/scripts/` (Windows: Git Bash; macOS: `brew install bash`).
- Claude Code.

## Cài (một lần cho mỗi máy)
```bash
npx github:kaii193/sdd-kit install --directory D:/gf-work --modules gf --tools claude-code --yes
```
Không truyền `--yes` thì CLI hỏi từng tham số còn thiếu, liệt kê file sẽ ghi, rồi hỏi xác nhận.

Kết quả:

| Nơi | Nội dung |
|---|---|
| `~/.claude/skills/gf-init`, `gf-spec`, `gf-implement` | Skill dùng được trong mọi phiên Claude Code (thư mục thật lấy theo `CLAUDE_CONFIG_DIR` nếu có đặt) |
| `~/.claude/agents/gf-pm`, `gf-coder`, `gf-qc`, `gf-reviewer` | Bộ agent triển khai |
| `~/.claude/gf/kit/` | Bản sao CLI mà các skill gọi tới |
| `~/.claude/gf/manifest.json` | Version kit, danh sách thư mục gốc, hash từng file đã cài |
| `D:/gf-work/` (thư mục gốc) | `AGENTS.md`, `CLAUDE.md`, `GUIDE.md`, `runner.md`, `.gf/scripts/`, `.gf/templates/`, `projects/`, `.claude/settings.json`, `.gf/manifest.json` |

| Tham số | Giá trị |
|---|---|
| `--directory` | Thư mục gốc gf; chưa có thì được tạo |
| `--modules` | `sdd`: lõi · `gf`: bộ agent cho Claude Code, tự kéo theo `sdd` |
| `--tools` | `claude-code` |

Bộ cài **không ghi đè** file đã có sẵn.

## Link một dự án code
Mở Claude Code trong thư mục gốc, gõ `/gf-init`. Skill sẽ hỏi tên dự án và đường dẫn repo code, rồi gọi:
```bash
node ~/.claude/gf/kit/bin/gf.js init-project --directory D:/gf-work --name shop-api --project D:/code/shop-api
```
Lệnh tạo `projects/shop-api/` (gồm `config.sh`, `constitution.md`, `patterns.md`, `decisions/`, `specs/`) và thêm repo vào `additionalDirectories` trong `.claude/settings.json`. Repo code **không nhận file nào** từ kit.

## Chạy độc lập mỗi giờ (tùy chọn)
1. Đặt biến môi trường `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` cho tài khoản chạy Claude Desktop.
2. Làm theo phần đầu của `runner.md` trong thư mục gốc để tạo tác vụ Routines → Local: trỏ vào thư mục gốc, mỗi 1 giờ, chế độ `auto`, **không tích ô worktree**.
3. Mở Claude trong thư mục gốc một lần và chấp nhận hộp thoại tin cậy. `additionalDirectories` chỉ có hiệu lực sau bước này; mỗi lần `/gf-init` thêm dự án mới thì làm lại bước này.
4. Kiểm tra: `npx github:kaii193/sdd-kit doctor --directory D:/gf-work --autonomous`.

Mỗi giờ runner chạy `run scan` để quyết định việc cho từng spec:
- spec mới `approved` → triển khai;
- spec đang chạy (heartbeat < 90 phút) → bỏ qua;
- spec bị bỏ dở → làm tiếp;
- `blocked` → thử lại;
- `failed` và `spec.md` đã sửa → làm lại;
- `done`/`failed` → báo Telegram **một lần**.

`.claude/settings.json` được cài sẵn danh sách cấm: `git push --force`, `gh pr merge`, sửa `deploy/`, đọc `.env`. Theo tài liệu Claude Code, luật cấm cho Bash không phải một rào an toàn tuyệt đối, nên rào thật là gate máy (kiểm `git diff`).

## Cập nhật và kiểm tra
```bash
npx github:kaii193/sdd-kit update --directory D:/gf-work
npx github:kaii193/sdd-kit doctor --directory D:/gf-work [--autonomous]
```

`update` xử lý từng loại file như sau:

| Loại | Ví dụ | Khi `update` |
|---|---|---|
| Của bạn | `CLAUDE.md` của thư mục gốc, `.claude/settings.json`, mọi file trong `projects/` | Không bao giờ đụng |
| Của kit | Skill, `.gf/scripts/*`, `.gf/templates/*`, `AGENTS.md`, `GUIDE.md`, bản sao CLI | Nâng cấp nếu bạn chưa sửa. Đã sửa thì giữ nguyên, bản mới ghi vào `*.gf-new` để bạn tự so |

`doctor` kiểm:
- Node, bash, thư mục gốc, skill và bản sao CLI, `settings.json` hợp lệ.
- Với **từng dự án đã link**: repo code tồn tại và là git repo; `TEST_COMMAND`, `LINT_COMMAND` đã điền; `MODULE_GLOBS` khớp thư mục; mục 4.5 "Quyết định mặc định cho agent" đã điền; repo có trong `additionalDirectories`.
- Thêm `--autonomous` thì kiểm luôn biến môi trường Telegram và việc đăng nhập `gh`.

## Gỡ
- Xóa thư mục gốc.
- Xóa `~/.claude/skills/gf-init`, `gf-spec`, `gf-implement`, `~/.claude/agents/gf-*.md`, `~/.claude/gf/`.
- Repo code không cần gỡ gì.
