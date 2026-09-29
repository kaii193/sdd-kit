# Engine gf-implement: máy trạng thái, gate, bộ agent (GĐ 3 + 4)

Ngày: 2026-09-29 · Branch: `feat/gf-implement-engine` (xếp chồng lên `feat/gf-home-layout`) · Status: **PARTIAL**

Phần máy (máy trạng thái, gate, worktree, báo cáo, Telegram) đã có test tất định và đạt. **Phần hành vi của agent chưa chạy thật** (bạn chốt ngày 2026-09-29: "Chưa cần test"), nên mọi tiêu chí về hành vi agent là **BLOCKED**.

## Goal
Có một engine tất định để đưa một spec approved đi qua PM → stub → test QC (khóa) → implement → gate → review → QC. Engine có:
- Tối đa 3 vòng, dừng sớm khi đạt; FAILED thì sang task sau; BLOCKED thì dừng spec mà không tốn vòng.
- Mỗi PM task một branch xếp chồng.
- Báo cáo, và Telegram chỉ gửi khi trạng thái đổi.

Bộ agent và skill `gf-implement` gọi engine này.

## Success criteria
Tiêu chí lấy từ plan (C3.x và C4.x). Vì hai giai đoạn được gộp, các tiêu chí được phân lại thành hai nhóm: nhóm máy và nhóm agent.

**Máy (có test tất định):**
- [x] **M1** (C3.1) Máy trạng thái: đi đúng thứ tự các bước; bước sai bị từ chối; `status.json` đọc lại được sau khi dừng tiến trình (mọi lệnh đều đọc lại từ file).
- [x] **M2** (C3.2, C4.5) Gate: sửa test đã khóa → FAIL; test đỏ do lỗi import → không tính là đỏ; test pass sẵn → trả lại QC một lần; QC sửa test mà không trích spec, hoặc làm giảm số test/assertion → từ chối.
- [x] **M3** (C4.1) Mọi AC của spec thuộc ít nhất một PM task; `pm-tasks.json` sai thì bị từ chối kèm danh sách lỗi; hỏng 3 lần thì spec BLOCKED.
- [x] **M4** (C4.2 phần máy) Tối đa 3 vòng; dừng ở vòng đạt; FAILED rồi sang task sau; spec `done` hoặc `failed` khi hết task.
- [x] **M5** (C4.3) Lệnh test không chạy được → spec BLOCKED ngay, không tốn vòng; lần sau làm tiếp đúng bước đó.
- [x] **M6** (C4.4) Task gắn `policy` → `blocked_by_policy`, không được thử.
- [x] **M7** (C4.8) Chạm `MAX_AGENT_CALLS_PER_RUN` → tạm dừng; lần chạy sau làm tiếp.
- [x] **M8** (C4.7 phần máy) Mỗi PM task một branch `feat/<spec>-p<n>`, xếp chồng lên branch của task trước.
- [x] **M9** (C4.6 phần máy) Đường dẫn bị cấm, sửa module `Chỉ đọc` (qua check-scope) → gate FAIL; agent không ghi tay được kết quả của bước máy.
- [x] **M10** (C6.b đến sớm) Telegram gửi đúng một lần cho mỗi trạng thái; token không bao giờ xuất hiện trong output.
- [x] **M11** (C4.6 chỉ số) `run metrics` tính được các chỉ số.

**Agent (cần chạy Claude thật): BLOCKED**
- [ ] **A1** (C3.3) `/gf-implement` chạy từ đầu tới cuối trên app mẫu, đạt ≥ 2/3 lần.
- [ ] **A2** (C4.2 hành vi) Agent thật đi hết 3 vòng khi AC không làm được.
- [ ] **A3** (C4.6 hành vi) Mỗi phản biện của Coding đều trích spec; QC trả lời từng điểm.
- [ ] **A4** (C4.9) Chế độ có người: agent hỏi dev; chế độ độc lập: ghi `ASM` rồi chạy tiếp.
- [ ] **A5** (C3.4) Danh sách những gì agent thực sự cần từ spec. Chỉ lập được sau khi chạy thật.

## Decisions and trade-offs
- **Máy trạng thái viết bằng Node, không viết bằng bash như plan ghi** (`gf-state.sh`). Lý do: trạng thái là JSON (D16), mà bash thì không đọc được JSON nếu thiếu `jq`. Các lệnh nằm dưới `gf run …` của bản CLI đã cài.
- **Máy trạng thái là các hàm thuần** (`lib/engine/state-machine.js`, `scan.js`). Mọi I/O (git, lệnh dự án, file) nằm ở `runner.js`, `gate.js`, `worktree.js`, `report.js`. Nhờ vậy 28 test luật chạy không cần git hay tiến trình con.
- **Agent không ghi tay được bước máy.** `run record --step gate` bị từ chối; chỉ `run gate` mới ghi được kết quả gate.
- **"Đỏ đúng nghĩa"** = lệnh test fail **và** output không khớp các mẫu lỗi import/biên dịch (Node, Python, TypeScript, Java, Go). Đây là heuristic, ghi rõ trong code.
- **Đếm test và assertion bằng regex, không phụ thuộc ngôn ngữ** (node:test, jest, pytest, JUnit, Go). Có test riêng. Tìm ra và sửa một lỗi: dòng `import assert from` bị đếm là một assertion.
- **"Lệnh không tồn tại" chỉ tính theo mã thoát 127.** Bản đầu còn dò chữ trong output, nhưng như vậy có thể phân loại nhầm một test fail thật thành BLOCKED; đã bỏ.
- **Lệnh dự án chạy với môi trường đã bỏ `NODE_TEST_CONTEXT`.** Nếu không, `node --test` lồng trong một test runner khác sẽ trả exit 0 dù có test fail. Tìm ra khi chạy test end-to-end; ngoài đời cũng có thể xảy ra.
- **Stub không được ném lỗi "not implemented"** (luật trong agent `gf-coder`), để test của QC chạy tới được assertion.
- **Sửa spec sau khi failed** → mọi task failed quay lại hàng đợi từ bước stub (D19). Không cố đoán task nào bị ảnh hưởng.
- **App mẫu** `examples/shop-api` (Node thuần, không dependency) và spec mẫu `examples/specs/001-ap-ma-giam-gia` là repo thử của GĐ 3, đồng thời là thứ test end-to-end dùng.

## How to verify
```bash
npm test
```

## Result
```
ℹ tests 85
ℹ pass 85
ℹ fail 0
25 passed, 0 failed
npm test exit=0
```
Trong 85 test có: 28 test máy trạng thái, 8 test bảng quyết định của runner, 13 test end-to-end engine trên app mẫu (git worktree thật, `node --test` và lint thật), 4 test đếm assertion, và 32 test bộ cài/doctor/init-project của GĐ 2b.

Test end-to-end:
```
✔ drives a spec to done through the real lock and gate on the example app
✔ fails a task after three rejected rounds and moves on to the next task
✔ rejects an implementation that edits a locked test
✔ sends QC back when its tests already pass before any implementation
✔ does not count a test that fails on a missing module as red
✔ blocks the spec instead of spending rounds when the test command cannot run
✔ rejects changes under a forbidden path
✔ rejects changes to a module the spec declares read-only
✔ refuses to let an agent record a machine step by hand
✔ lets QC change a locked test only with a spec reference and without losing assertions
✔ pauses a run at the agent call cap and continues on the next run
✔ reports a finished spec to Telegram exactly once and never prints the token
✔ computes metrics across every spec in the gf home
```

Tiêm lỗi (mỗi lỗi phải làm test đỏ):
```
MUTANT cho thêm 1 vòng → ℹ fail 5
MUTANT không kiểm test đã khóa → ℹ fail 1
MUTANT lỗi import vẫn tính là đỏ → ℹ fail 1
MUTANT cho ghi tay bước máy → ℹ fail 1
MUTANT Telegram báo lặp → ℹ fail 1
MUTANT bỏ ngưỡng heartbeat → ℹ fail 1
MUTANT blocked vẫn tốn vòng → ℹ fail 3
MUTANT không lọc NODE_TEST_CONTEXT → ℹ fail 8
```

Lần chạy end-to-end đầu tiên có 8/13 test đỏ, vì `NODE_TEST_CONTEXT` bị truyền xuống. Sửa xong còn 3 đỏ: 2 do helper của test ghi đè `core.autocrlf`, khiến mọi file trông như đã bị sửa; 1 do lỗi đếm assertion nói ở trên. Đã sửa cả ba.

## Thứ tự đọc (khoảng 2.080 dòng thêm: 1.006 code, 727 test, 214 prompt agent/skill, 133 app mẫu)
1. `lib/engine/state-machine.js`: luật (đọc cùng `tests/cli/state-machine.test.js`)
2. `lib/engine/scan.js`: bảng quyết định của runner (`tests/cli/scan.test.js`)
3. `lib/engine/gate.js`, `worktree.js`, `runner.js`: I/O
4. `lib/engine/report.js`, `metrics.js`, `commands.js`, `home-scan.js`, `context.js`
5. `modules/gf/claude/skills/gf-implement/SKILL.md`, `modules/gf/claude/agents/*`
6. `modules/sdd/home/AGENTS.md`
7. `tests/cli/engine.test.js`

Vượt xa mục tiêu 400 dòng. Engine chỉ có nghĩa khi đủ vòng lặp; tách máy trạng thái khỏi gate sẽ ra một PR không chạy được gì.

## Not done / follow-ups
- A1–A5: chạy agent thật trên `examples/shop-api`, khi bạn cho phép.
- Tạo PR draft cho mỗi task mới chỉ là chỉ dẫn trong skill (`gh pr create`); chưa có test.
- Heuristic "đỏ đúng nghĩa" và đếm assertion có thể sai với framework lạ. Nếu gặp, bổ sung mẫu vào `gate.js`.
