# Skill cho người: /gf-init, /gf-spec có debate, R12–R13 (GĐ 7)

Ngày: 2026-09-29 · Branch: `feat/gf-human-skills` (xếp chồng lên `feat/gf-runner`) · Status: **PARTIAL**

Phần máy (R12, R13, cài và kiểm agent) đã có test và đạt. Các tiêu chí về hành vi agent (phỏng vấn, debate) là **BLOCKED**: chưa chạy agent thật, theo quyết định của bạn.

## Goal
Spec đủ đầy tới mức agent triển khai không phải hỏi lại, vì khi chạy độc lập không có ai để hỏi. `/gf-spec` có debate giữa ba critic; `check-ready` chặn thêm hai mục Tài nguyên và Môi trường chạy thử.

## Success criteria
- [x] **R12** `check-ready`: mục **Tài nguyên** trống thì FAIL; đường dẫn file trong đó không có trong repo code thì FAIL (`r12a-resources-empty`, `r12b-resource-file-missing`).
- [x] **R13** `check-ready`: mục **Môi trường chạy thử** trống thì FAIL (`r13-test-environment-empty`).
- [x] Template, fixture test và spec mẫu có hai mục mới; spec mẫu `examples/specs/001-ap-ma-giam-gia` vẫn đạt `check-ready`.
- [x] Cài đủ 5 agent của debate spec (`gf-spec-researcher`, 3 critic, `gf-spec-moderator`); `doctor` báo nếu thiếu agent nào (test `install` và `doctor`).
- [ ] **C7.1** `/gf-init` phỏng vấn điền đủ `config.sh`, constitution, patterns trên repo thật. **BLOCKED** (hành vi agent).
- [ ] **C7.2** `/gf-spec` chỉ đặt `approved` sau khi `check-ready` pass. **BLOCKED** ở phần hành vi. Phần máy: `check-ready` là cổng duy nhất, và đã được test.
- [ ] **C7.3** Debate: số vòng ≤ 5, mọi luận điểm trỏ về spec, vấn đề đã cài được thêm vào Câu hỏi mở dưới dạng 🔴, đạt ≥ 2/3 lần. **BLOCKED**.
- [ ] **C7.4** Sửa template theo danh sách "agent thực sự cần gì" (C3.4). **BLOCKED**, vì C3.4 cần chạy thật. Hai mục R12/R13 được thêm trước, theo yêu cầu "spec phải đủ để model không vướng".
- [ ] **C7.5** Số liệu so sánh debate với một reviewer đơn lẻ. **BLOCKED**.

## Decisions and trade-offs
- **Hai mục mới là mục 11 và 12**, các mục sau đánh số lại (Brownfield 13, Rủi ro 14, Câu hỏi mở 15, Lịch sử 16). Script tìm mục theo tên nên không bị ảnh hưởng; `GUIDE.md` đã sửa chỗ nhắc "mục 11".
- **R12 chỉ kiểm các đường dẫn viết trong backtick, có dấu `/` và phần mở rộng**, không có `:`. Nhờ vậy URL và chữ thường không bị hiểu nhầm thành đường dẫn. Dòng còn `<…>` bị coi là chưa điền.
- **Critic chỉ có quyền đọc.** Skill `gf-spec` (phiên chính) ghi file của từng vòng; chỉ moderator được ghi `spec-review.md` và bảng Câu hỏi mở. Vòng 1 chạy song song và độc lập để các critic không xuôi theo nhau.
- **`GUIDE.md` mục 5, 7, 11 được viết lại theo luồng agent.** Thư viện prompt P1–P12 được giữ lại cho trường hợp làm tay.
- **Chưa giải quyết:** template `plan.md` và `tasks.md` vẫn được tạo cho mỗi spec, nhưng luồng agent không dùng chúng (PM ghi `pm-tasks.json`, Coding ghi `tech/`). `check-spec.sh` vẫn đòi `plan.md` approved, trong khi engine không gọi `check-spec`. Cần bạn quyết giữ hay bỏ (xem Follow-ups).

## How to verify
```bash
npm test
```

## Result
```
ℹ tests 92
ℹ pass 92
ℹ fail 0
31 passed, 0 failed
npm test exit=0
```
Ba test bash mới:
```
PASS  r12a-resources-empty
PASS  r12b-resource-file-missing
PASS  r13-test-environment-empty
```

## Not done / follow-ups
- C7.1–C7.5: chạy agent thật khi bạn cho phép.
- Quyết định về `plan.md`/`tasks.md` và `check-spec.sh` (G2) trong luồng agent: bỏ, hay giữ cho chế độ làm tay.
