# Cấu trúc thư mục gốc gf + dự án link (GĐ 2b)

Ngày: 2026-09-29 · Branch: `feat/gf-home-layout` (xếp chồng lên `feat/npx-installer`) · Status: **DONE**

## Goal
Chuyển kit sang cấu trúc đã chốt:
- Skill và CLI cài ở cấp user (`~/.claude`).
- Một thư mục gốc gf chứa nhiều dự án, mỗi dự án link tới một repo code.
- Repo code không nhận file nào từ kit.

## Success criteria
- [x] **C2b.1** `install --directory <gốc>` cài skill và bản sao CLI vào `~/.claude` (test dùng `CLAUDE_CONFIG_DIR`), tạo thư mục gốc, có manifest ở cả hai nơi. Đã kiểm bằng test và bằng `npx github:kaii193/sdd-kit#feat/gf-home-layout` thật.
- [x] **C2b.2** `init-project`: từ chối đường dẫn không phải git repo, tên sai, tên trùng, repo đã link, ký tự nguy hiểm; tạo `projects/<tên>/` từ template; thêm vào `additionalDirectories` mà giữ nguyên các cài đặt khác.
- [x] **C2b.3** `check-ready`, `check-spec`, `check-scope`, `new-spec` chạy với spec trong `projects/<tên>/specs/` và code ở repo đã link (hoặc ở `GF_CODE_DIR`). Toàn bộ các case R1–R11 của GĐ 1 chạy lại vẫn pass.
- [x] **C2b.4** `update` giữ quy tắc sở hữu cho cả `~/.claude` lẫn thư mục gốc. File trong `projects/` không bao giờ bị đụng.
- [x] **C2b.5** `doctor` kiểm thư mục gốc và từng dự án đã link: repo tồn tại và là git repo, lệnh đã điền, `MODULE_GLOBS`, mục 4.5 constitution, `additionalDirectories`, `settings.json` hợp lệ.
- [x] **C2b.6** Đã xóa `sdd-check.yml`, PR template, CODEOWNERS mẫu, file nạp luật Cursor/Copilot. `--tools` chỉ còn `claude-code`. Bạn duyệt ngày 2026-09-29.

## Decisions and trade-offs
- **Cấu hình dự án dùng `config.sh`, không dùng `gf.json`** như plan ghi. Lý do: các script kiểm tra là bash; đọc JSON trong bash cần `jq`, không phải máy nào cũng có. Plan đã sửa theo.
- **Chặn ký tự `" $ \` \\` và xuống dòng trong đường dẫn repo.** `config.sh` là file được `source`; nếu ghi thẳng đường dẫn chứa `$(...)` vào đó thì lệnh trong đường dẫn sẽ chạy mỗi khi source file. Test `rejects a path with characters that would break the bash config` dùng thư mục tên `shop$(whoami)`.
- **`init-project` đọc và kiểm `settings.json` trước khi ghi bất cứ thứ gì.** Bản đầu đọc sau khi đã ghi file dự án, nên JSON hỏng sẽ để lại một thư mục ghi dở. Lỗi này được phát hiện khi đọc lại code; test `writes nothing when settings.json is not valid JSON` chặn nó.
- **Bản sao CLI được cài vào `~/.claude/gf/kit/`**, và các skill gọi tới bản này bằng đường dẫn tuyệt đối. Đường dẫn được thay vào `{{GF_KIT_BIN}}` lúc cài. Nhờ vậy skill chạy được khi không có mạng, và luôn dùng đúng version đã cài.
- **Các script bắt buộc nhận đường dẫn thư mục spec.** Cơ chế suy spec từ tên branch đã bỏ, vì nó chỉ phục vụ CI (đã xóa). Lỗi review #6 (thoát mà không in gì khi branch không có spec) mất theo.
- **`CLAUDE.md` của thư mục gốc thuộc về bạn** (bạn có thể thêm luật riêng); `AGENTS.md` thuộc về kit.
- **`doctor` không nuốt lỗi `settings.json` hỏng** mà báo thành một mục riêng. Bản đầu nuốt lỗi rồi báo sai sang mục `additionalDirectories`.
- **Chưa làm:**
  - Skill `gf-implement` (GĐ 3).
  - Viết lại luật hành vi trong `AGENTS.md` cho chế độ tự động (GĐ 3). Hiện `AGENTS.md` mới chỉ được sửa đường dẫn và định dạng commit.
  - `GUIDE.md` mới được sửa để không còn sai về file và lệnh; viết lại cho luồng agent là việc của GĐ 7.

## How to verify
```bash
npm test
```
Tiêm lỗi: chép kit sang thư mục tạm, sửa code bằng `sed`, chạy lại `node --test`. Mỗi lỗi phải làm ít nhất một test đỏ.

## Result
`npm test` (Windows, Node 24.18.0, Git Bash 5.3):
```
✔ passes once the linked project is filled in
✔ flags empty commands and empty default decisions right after /gf-init
✔ flags module globs that match no folder in the code repo
✔ flags a linked repo that no longer exists
✔ flags a linked repo missing from additionalDirectories
✔ flags a settings.json that is not valid JSON instead of hiding it
✔ flags a missing skill
✔ only warns when no project is linked yet
✔ flags a folder that is not a gf home
✔ requires Telegram variables in autonomous mode without printing their values
✔ creates a project folder linked to the code repo
✔ adds the repo to additionalDirectories and keeps the other settings
✔ rejects a folder that is not a git repository
✔ rejects a project name that is not a lowercase slug
✔ rejects a name that is already used
✔ rejects a repo that is already linked under another name
✔ rejects a path with characters that would break the bash config
✔ writes nothing when settings.json is not valid JSON
✔ refuses to link a project into a folder that is not a gf home
✔ installs skills and a kit copy into the Claude dir and scaffolds the gf home
✔ renders the absolute path of the installed CLI into the skills
✔ installs a kit copy that runs on its own
✔ writes every shell script with LF line endings
✔ installs without bash on PATH
✔ rejects --yes without --tools and names the missing option
✔ prompts for missing values and installs after confirmation
✔ writes nothing when the confirmation is declined
✔ rejects tools that are no longer supported
✔ rejects an unknown module
✔ requires every tool a module declares
✔ keeps files that already exist in the gf home and does not track them
✔ refuses to install twice into the same gf home
✔ shares one Claude dir between two gf homes without overwriting an edited skill
✔ never touches the files of a linked project
✔ leaves a user-owned home file untouched without writing a new version beside it
✔ keeps a kit script the user edited and writes the new version beside it
✔ upgrades a home file installed by an older kit version
✔ upgrades a skill installed by an older kit version and keeps the CLI path rendered
✔ restores a deleted kit script and a deleted skill
✔ refuses to update a folder that is not a gf home
ℹ tests 40
ℹ pass 40
ℹ fail 0

== check-ready: fixture hợp lệ
PASS  valid
== check-ready: mỗi biến thể vi phạm đúng một tiêu chí
PASS  r1-open-question … PASS  r11b-error-flow-unknown-ac   (12 case)
== check-ready: đầu vào sai
PASS  missing-spec-argument
PASS  spec-outside-a-project
== check-spec: gọi check-ready
PASS  check-spec-valid
PASS  check-spec-approved-not-ready
== new-spec: tạo spec trong dự án, đánh số tự động
PASS  new-spec-first
PASS  new-spec-branch-name
PASS  new-spec-second
PASS  new-spec-unfilled-not-ready
PASS  new-spec-unknown-project
== check-scope: so thay đổi trên repo code đã link
PASS  scope-declared-module
PASS  scope-read-only-module
PASS  scope-uses-gf-code-dir

25 passed, 0 failed
npm test exit=0
```

Tiêm lỗi:
```
MUTANT bỏ chặn ký tự nguy hiểm → ℹ fail 1
     ✖ rejects a path with characters that would break the bash config
MUTANT file của bạn bị coi là của kit → ℹ fail 1
     ✖ leaves a user-owned home file untouched without writing a new version beside it
MUTANT không thay đường dẫn CLI vào skill → ℹ fail 6
     ✖ renders the absolute path of the installed CLI into the skills
     ✖ upgrades a skill installed by an older kit version and keeps the CLI path rendered
     (+4 test init-project/doctor, vì template dự án cũng dùng cơ chế thay biến)
MUTANT samePath luôn sai → ℹ fail 2
     ✖ passes once the linked project is filled in
     ✖ rejects a repo that is already linked under another name
MUTANT doctor coi mục 4.5 luôn đã điền → ℹ fail 1
     ✖ flags empty commands and empty default decisions right after /gf-init
MUTANT doctor giấu lỗi settings.json → ℹ fail 1
     ✖ flags a settings.json that is not valid JSON instead of hiding it
MUTANT đọc settings sau khi ghi file → ℹ fail 2
     ✖ adds the repo to additionalDirectories and keeps the other settings
     ✖ writes nothing when settings.json is not valid JSON
```

Chạy thử bằng tay từ đầu tới cuối (install → init-project → new-spec → check-ready → doctor): 43 file được ghi; skill chứa đường dẫn CLI tuyệt đối; `config.sh` có `PROJECT_PATH` dạng `C:/…`; `settings.json` có repo trong `additionalDirectories`; `doctor` chỉ báo ✗ hai mục đúng mong đợi (lệnh chưa điền, mục 4.5 chưa điền).

Kết luận từng tiêu chí:
- **C2b.1** PASS: ba test `installs skills…`, `renders…`, `installs a kit copy that runs on its own` pass. Cài bằng `npx github:` thật (với `CLAUDE_CONFIG_DIR` trỏ vào thư mục tạm, không đụng `~/.claude` thật): skill `gf-init`, `gf-spec` được cài; `init-project` chạy qua bản CLI đã cài; `doctor` chỉ báo ✗ đúng hai mục một dự án vừa link còn thiếu.
- **C2b.2** PASS: chín test `init-project`.
- **C2b.3** PASS: 25/25 case bash, gồm `scope-uses-gf-code-dir`.
- **C2b.4** PASS: bảy test `update`.
- **C2b.5** PASS: mười test `doctor`.
- **C2b.6** PASS: các file đã xóa; test `rejects tools that are no longer supported`.

## Thứ tự đọc (PR khoảng 1.342 dòng thêm / 706 dòng xóa)
1. `modules/*/module.json`, rồi cây `modules/` (phần lớn là đổi tên file)
2. `lib/files.js`, `lib/catalog.js`, `lib/installer.js`
3. `lib/projects.js` (init-project, kiểm đường dẫn), `lib/doctor.js`, `lib/cli.js`
4. `modules/sdd/home/.gf/scripts/lib.sh`, rồi các script
5. `modules/gf/claude/skills/*/SKILL.md`
6. Test: `tests/cli/*`, `tests/check-ready/run.sh`
7. Tài liệu: `INSTALL.md`, `README.md`, `GUIDE.md`, `AGENTS.md`

Vượt mục tiêu 400 dòng. Đây là một lần đổi cấu trúc trọn vẹn: script, bộ cài và tài liệu phải đổi cùng lúc thì kit mới dùng được. Tách nhỏ hơn thì PR ở giữa sẽ để kit trong trạng thái hỏng.

## Not done / follow-ups
- GĐ 3: skill `gf-implement`, luật hành vi tự động trong `AGENTS.md`, mục Tài nguyên và Môi trường chạy thử trong template (R12, R13).
- `GUIDE.md` cần viết lại cho luồng agent (GĐ 7).
- `doctor` gọi `bash` theo PATH; WSL bash có thể đứng trước Git Bash (còn từ GĐ 2).
- Repo kit chưa có `.gitattributes`.
