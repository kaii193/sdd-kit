# Bộ cài npx (GĐ 2)

Ngày: 2026-09-29 · Branch: `feat/npx-installer` (xếp chồng lên `feat/spec-readiness-check`) · Status: **DONE**

## Goal
Cài, cập nhật và kiểm tra kit bằng `npx github:kaii193/sdd-kit …`, không cần bash cho bước cài, không ghi đè file người dùng đã sửa. Thay thế `install.sh`.

## Success criteria
- [x] **C2.1** Cài `sdd` + `gf` vào repo trống, đúng danh sách file, có `.gf/manifest.json`. Đã chạy bằng test, bằng `npx file:<tgz>`, và bằng `npx github:kaii193/sdd-kit#feat/npx-installer`.
- [x] **C2.2** Không có `--yes` thì hỏi các tham số còn thiếu. Có `--yes` mà thiếu tham số bắt buộc thì exit 1 và nêu tên tham số.
- [x] **C2.3** Tool lạ thì exit 1. `gf` mà thiếu `claude-code` thì exit 1. `cursor`/`github-copilot` cài đúng file (tiêu chí đã sửa theo quyết định của bạn ngày 2026-09-29).
- [x] **C2.4** `update`: file của bạn giữ nguyên, không sinh `.gf-new`. Script của kit mà bạn đã sửa thì giữ nguyên và có thêm `*.gf-new`. Script chưa sửa thì được nâng cấp. File của kit bị xóa thì được cài lại.
- [x] **C2.5** `doctor` báo đúng các mục: git, đã cài kit, AGENTS.md mục 7, `MODULE_GLOBS`, biến Telegram. Mục `.claude/settings.json` được **dời sang GĐ 6**, theo thỏa thuận với bạn ngày 2026-09-29: tới GĐ 6 kit mới cài file này, nên kiểm bây giờ thì mục đó luôn đỏ.
- [x] **C2.6** Bước cài chạy được khi PATH chỉ có Node (không bash, không git). Test chạy bằng `node --test`.
- [x] **C2.7** `template/` và `adapters/` đã chuyển vào `modules/sdd/`, `install.sh` đã xóa. Bạn đã duyệt ngày 2026-09-29.

## Decisions and trade-offs
- **Cấu trúc module:** `modules/<tên>/files/**` được chép nguyên vào dự án. `modules/<tên>/tools/<tool>/**` chỉ chép khi tool đó được chọn. `module.json` khai `requires`, `requiresTools`, `userOwned`, `ciPaths`. Dùng thư mục thay vì liệt kê từng file, để thêm file vào kit không phải sửa danh sách ở chỗ khác.
- **Module `gf` hiện chưa có file nào**, chỉ có `module.json`. Nó giúp kiểm cơ chế phụ thuộc (`gf` kéo theo `sdd`) và ràng buộc `claude-code`. Skill và agent sẽ được thêm từ GĐ 3.
- **Quyền sở hữu và hash:** manifest lưu sha256 của từng file kit đã ghi. File đã tồn tại trước khi cài thì không được ghi vào manifest, và `update` không bao giờ đụng tới nó.
- **File `.sh` được chuẩn hóa sang LF khi cài.** Lý do: trên Windows với `core.autocrlf=true`, script trong thư mục làm việc của kit là CRLF, và bash trên Linux CI sẽ chạy hỏng. Việc này giải quyết lỗi review #9 cho các file được cài; repo kit vẫn chưa có `.gitattributes`.
- **`--force` bị bỏ.** `update` thay thế nó theo cách an toàn hơn. **`--no-ci` được giữ lại.**
- **Cài hai lần thì báo lỗi và chỉ sang `update`**, thay vì gộp cài thêm module. Chưa có nhu cầu cài thêm module vào dự án đã cài.
- `package.json` đặt `"license": "UNLICENSED"`, vì repo chưa có license. Chọn license là việc của bạn.
- **Tìm ra khi kiểm:** `npx <đường-dẫn>.tgz …` trên Windows trả exit 0 mà không chạy gì. Phải dùng dạng khai báo gói `npx file:<đường-dẫn>` mới chạy. Dạng `github:` cũng là khai báo gói, nên dự kiến chạy giống `file:`, nhưng chưa kiểm.

## How to verify
```bash
npm test
```
Chứng minh test không phải trang trí: chép kit sang thư mục tạm, tiêm từng lỗi vào code, chạy lại `node --test`. Mỗi lỗi phải làm ít nhất một test đỏ.

Cài qua npx từ gói đóng bằng `npm pack`:
```bash
npm pack --pack-destination <thư-mục>
npx --yes "file:<thư-mục>/sdd-kit-0.2.0.tgz" install --directory . --modules gf --tools claude-code,cursor --yes
```

## Result
`npm test`:
```
✔ flags unfilled project commands on a fresh install
✔ flags module globs that match no folder
✔ passes the base checks once commands are filled and module folders exist
✔ flags a folder that is not a git repository
✔ flags a project where the kit is not installed
✔ requires Telegram variables in autonomous mode without printing their values
✔ installs sdd and gf, pulling sdd in as a dependency, and records a manifest
✔ writes every shell script with LF line endings
✔ installs without bash on PATH
✔ rejects --yes without --tools and names the missing option
✔ prompts for missing values and installs after confirmation
✔ writes nothing when the confirmation is declined
✔ rejects an unknown tool
✔ rejects gf without claude-code
✔ rejects an unknown module
✔ installs the cursor and copilot rule files for the sdd module
✔ keeps files that already exist in the project
✔ skips the CI workflow with --no-ci
✔ refuses to install twice and points to update
✔ leaves a user-owned file untouched
✔ keeps a kit script the user edited and writes the new version beside it
✔ upgrades a kit file installed by an older kit version
✔ restores a deleted kit file
✔ refuses to update a project where the kit is not installed
ℹ tests 24
ℹ pass 24
ℹ fail 0
22 passed, 0 failed
npm test exit=0
```
(`22 passed` là bộ test `check-ready` của GĐ 1, chạy lại trên cấu trúc `modules/` mới.)

Tiêm lỗi:
```
MUTANT user-owned coi như của kit → ℹ fail 1
     ✖ leaves a user-owned file untouched
MUTANT bỏ so hash, luôn ghi đè → ℹ fail 1
     ✖ keeps a kit script the user edited and writes the new version beside it
MUTANT CRLF → ℹ fail 3
     ✖ keeps a kit script the user edited and writes the new version beside it
     ✖ upgrades a kit file installed by an older kit version
     ✖ writes every shell script with LF line endings
MUTANT bỏ kiểm requiresTools → ℹ fail 1
     ✖ rejects gf without claude-code
MUTANT bỏ đọc giá trị từ stdin → ℹ fail 1
     ✖ prompts for missing values and installs after confirmation
MUTANT doctor bỏ kiểm lệnh ...` → ℹ fail 1
     ✖ flags unfilled project commands on a fresh install
```
Ban đầu có hai test bị phát hiện là yếu, và đã được siết lại:
- `leaves a user-owned file untouched` vẫn pass khi code coi file của bạn là file của kit. Nay test kiểm thêm: không có `.gf-new`, và file được liệt kê ở mục "file của bạn".
- Test LF chỉ kiểm `check-ready.sh`, mà file nguồn đó vốn đã là LF. Nay test kiểm mọi file `.sh`.

`npm pack` và `npx file:`:
```
      1 bin
      6 lib
     22 modules
      1 package.json
      1 README.md

Đã ghi 19 file, bỏ qua 0 file đã tồn tại.
exit=0
. .. .cursor .gf .git .github AGENTS.md CLAUDE.md sdd
```

`npx github:` thật, sau khi push (repo `kaii193/sdd-kit` là PUBLIC):
```
$ npx --yes "github:kaii193/sdd-kit#feat/npx-installer" install --directory . --modules gf --tools claude-code,cursor,github-copilot --yes
Đã ghi 20 file, bỏ qua 0 file đã tồn tại.
exit=0
. .. .cursor .gf .git .github AGENTS.md CLAUDE.md sdd
"kitVersion": "0.2.0"

$ npx --yes "github:kaii193/sdd-kit#feat/npx-installer" doctor --directory .
✓ Git repository
✓ Node ≥ 18 (hiện: 24.18.0)
✓ bash ≥ 4 (hiện: 5)
✓ Đã cài kit (.gf/manifest.json)
✗ AGENTS.md mục 7 (lệnh dự án) đã điền — Thay các lệnh `...` bằng lệnh thật (test, lint, e2e) — gate chạy các lệnh này
✗ MODULE_GLOBS trong sdd/config.sh khớp thư mục có thật — Không có thư mục: src — sửa MODULE_GLOBS cho khớp cấu trúc dự án
! Biến môi trường TELEGRAM_BOT_TOKEN (chế độ độc lập) — Đặt TELEGRAM_BOT_TOKEN để runner gửi báo cáo Telegram
! Biến môi trường TELEGRAM_CHAT_ID (chế độ độc lập) — Đặt TELEGRAM_CHAT_ID để runner gửi báo cáo Telegram
✓ GitHub CLI đã đăng nhập (để mở PR) (chế độ độc lập)
doctor exit=1
```
Kết quả `doctor` như trên là đúng mong đợi: một dự án vừa cài thì chưa điền lệnh và chưa có `src/`.

Kết luận từng tiêu chí:
- **C2.1** PASS: test `installs sdd and gf…` pass; `npx file:` cài 19 file; `npx github:` cài 20 file (thêm `.github/copilot-instructions.md`).
- **C2.2** PASS: `rejects --yes without --tools…`, `prompts for missing values…`, `writes nothing when the confirmation is declined`.
- **C2.3** PASS: `rejects an unknown tool`, `rejects gf without claude-code`, `installs the cursor and copilot rule files…`.
- **C2.4** PASS: bốn test đầu của `update`.
- **C2.5** PASS: sáu test của `doctor` pass. Mục `.claude/settings.json` đã dời sang GĐ 6 theo thỏa thuận.
- **C2.6** PASS: `installs without bash on PATH`, và `npm test` chạy trên Windows.
- **C2.7** PASS: `git mv` giữ lịch sử file; `install.sh` đã xóa; `README.md`, `INSTALL.md`, `GUIDE.md` đã sửa theo cách cài mới.

## Thứ tự đọc (PR khoảng 1.045 dòng: 628 code, 381 test; phần đổi tên file tính 0 dòng)
1. `modules/sdd/module.json`, `modules/gf/module.json`, `package.json`
2. `lib/catalog.js` → `lib/installer.js`: phần lõi, tức quy tắc sở hữu và hash
3. `lib/cli.js`, `lib/prompt.js`, `lib/doctor.js`
4. `tests/cli/*.test.js`
5. Tài liệu: `INSTALL.md`, `README.md`, `GUIDE.md`

Không tách nhỏ hơn được, vì không thể xóa `install.sh` trước khi có CLI thay thế, và CLI không có test thì không review được.

## Not done / follow-ups
- Lệnh không có `#branch` (`npx github:kaii193/sdd-kit …`) sẽ lấy `main`. Lệnh này chỉ chạy được sau khi hai PR GĐ 1 và GĐ 2 được merge.
- `doctor` kiểm `.claude/settings.json` (danh sách cấm): làm ở GĐ 6 (C6.8).
- `doctor` gọi `bash` theo PATH. Trên Windows, nếu `C:\Windows\System32\bash.exe` (WSL) đứng trước Git Bash trong PATH, kết quả kiểm có thể sai. Chưa xử lý.
- Repo kit vẫn chưa có `.gitattributes` (lỗi review #9 ở phía repo kit).
- `new-spec.sh --branch` vẫn tạo branch `feature/` (follow-up từ GĐ 1).
