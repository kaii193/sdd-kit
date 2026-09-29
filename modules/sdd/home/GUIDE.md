# Hướng dẫn triển khai SDD (Spec-Driven Development)

> Dành cho **người** trong team. AI agent đọc `AGENTS.md`.
> Không thay thế `README.md` của dự án (cài đặt, cấu hình, chạy dự án vẫn ở README).

## Mục lục
1. [Tư duy cốt lõi](#1-tư-duy-cốt-lõi)
2. [Cài đặt & cấu hình lần đầu](#2-cài-đặt--cấu-hình-lần-đầu)
3. [Constitution](#3-constitution)
4. [Patterns](#4-patterns)
5. [Vòng lặp một tính năng](#5-vòng-lặp-một-tính-năng)
6. [Khi nào không cần spec](#6-khi-nào-không-cần-spec)
7. [Các lớp phòng thủ & cổng kiểm soát](#7-các-lớp-phòng-thủ--cổng-kiểm-soát)
8. [Script](#8-script)
9. [Brownfield](#9-brownfield)
10. [Dự án lớn: phụ thuộc giữa tính năng](#10-dự-án-lớn-phụ-thuộc-giữa-tính-năng)
11. [Vai trò trong team](#11-vai-trò-trong-team)
12. [Lỗi thường gặp](#12-lỗi-thường-gặp)
13. [Thư viện prompt](#13-thư-viện-prompt)

---

## 1. Tư duy cốt lõi

1. **SDD không phải vibe code.** Dev phải hiểu hệ thống. Spec là nơi hiểu biết đó được viết ra để người và agent dùng chung — không phải cách để khỏi cần hiểu.
2. **Mỗi tài liệu trả lời một câu hỏi.** Spec: *cái gì, tại sao*. Plan: *làm thế nào, dùng lại gì*. Tasks: *các bước*. Không trộn.
3. **Máy kiểm tra được thì để máy kiểm tra.** Hợp đồng giữa module là code (type, schema, OpenAPI), không phải văn bản. Ranh giới do lint ép. Hành vi do test bảo vệ. Tài liệu chỉ trỏ tới những thứ đó.
4. **Nhiều lớp, mỗi lớp bắt một loại lỗi.** Spec bắt sai ý định, plan bắt thiếu tái sử dụng, file mẫu dẫn dắt pattern, CI chặn vi phạm máy móc, người review phần còn lại.
5. **Spec là nguồn sự thật về ý định.** Đổi hành vi → sửa spec trước, code sau.
6. **Nhỏ thắng lớn.** Một spec: 1–5 ngày. Lớn hơn → tách.

**Điều kiện nền để SDD hiệu quả ở dự án lớn** (không có thì nên xây dần song song):
module có ranh giới rõ và cửa vào công khai · hợp đồng viết bằng code · test ở ranh giới module · CI chạy trên mọi PR · review có chủ module.

---

## 2. Cài đặt & cấu hình lần đầu

Thư mục này (thư mục gốc gf) được tạo bằng `npx github:kaii193/sdd-kit install --directory <thư-mục-gốc>` (xem `INSTALL.md` của kit). Repo code **không nhận file nào** từ kit; mỗi repo code được link vào một thư mục `projects/<dự-án>/` ở đây.

### 2.1 Link một dự án code: `/gf-init`
Mở Claude Code trong thư mục gốc, gõ `/gf-init`. Skill hỏi tên dự án và đường dẫn repo code, tạo `projects/<dự-án>/`, thêm repo vào `additionalDirectories` của `.claude/settings.json`, rồi phỏng vấn để điền cấu hình. Làm bằng tay thì chạy `node ~/.claude/gf/kit/bin/gf.js init-project --directory . --name <tên> --project <repo-code>`.

### 2.2 Cấu hình dự án: `projects/<dự-án>/config.sh`
| Biến | Ý nghĩa |
|---|---|
| `PROJECT_PATH`, `BASE_BRANCH` | Repo code đã link và nhánh chính (`/gf-init` tự điền) |
| `TEST_COMMAND`, `LINT_COMMAND` (bắt buộc), `INSTALL_COMMAND`, `TEST_MODULE_COMMAND`, `E2E_COMMAND`, `RUN_COMMAND` | Lệnh chạy trong repo code; gate và agent dùng các lệnh này |
| `MODULE_GLOBS` | Cách nhận diện module để `check-scope.sh` biết file nào thuộc module nào |
| `SCOPE_MODE`, `IGNORE_PATHS`, `SHARED_PATHS`, `VAGUE_WORDS` | Tinh chỉnh các script kiểm tra |

Ví dụ `MODULE_GLOBS=("src/*" "tests/*")`: `src/pricing/...` và `tests/pricing/...` đều thuộc module `pricing`. Monorepo dùng `("packages/*" "apps/*")`.

**Mới áp dụng:** đặt `SCOPE_MODE="warn"` vài tuần để team quen, sau đó chuyển `strict`.

### 2.3 Quyết định mặc định: `projects/<dự-án>/constitution.md` mục 4.5
Bắt buộc. Khi chạy tự động, agent không hỏi ai; gặp chỗ spec không nói tới thì theo các quyết định này.

### 2.4 Kiểm tra
```bash
node ~/.claude/gf/kit/bin/gf.js doctor --directory .
```

---

## 3. Constitution

**Để AI phỏng vấn, không để AI tự viết.**
- Greenfield: prompt [P1](#p1--phỏng-vấn-constitution).
- Brownfield: prompt [P2](#p2--khảo-sát-codebase-brownfield) trước, rồi P1 cho phần còn trống.

**Người phải tự kiểm tra:**
- [ ] "Không phải là" đủ rõ để chặn phình phạm vi
- [ ] Bảng module (3.2) phản ánh **ý đồ** kiến trúc, không chỉ hiện trạng; tên khớp `config.sh`
- [ ] Hợp đồng (3.3) trỏ tới file code thật
- [ ] Công cụ ép ranh giới (3.4) đã có hoặc đã lên kế hoạch
- [ ] (Brownfield) Quy tắc nghiệp vụ ngầm được người hiểu hệ thống xác nhận
- [ ] Mỗi lựa chọn công nghệ lớn có ADR

---

## 4. Patterns

`projects/<dự-án>/patterns.md` là nơi dạy agent **bằng ví dụ**.

1. Chọn 1–3 module "chuẩn mực" trong dự án, giữ chúng sạch.
2. Điền bảng file mẫu theo loại công việc (thêm endpoint, trang, component, truy cập DB, test…).
3. Điền bảng code dùng chung: tiện ích, service, hook mà agent hay viết lại.
4. Brownfield: prompt [P3](#p3--tìm-file-mẫu--code-dùng-chung) giúp liệt kê ứng viên; người chọn.

**Vòng cải tiến:** agent lặp một lỗi pattern ≥ 2 lần → ghi mục 4 của patterns.md → hỏi "biến thành lint rule được không?". Được → lỗi biến mất vĩnh viễn.

---

## 5. Vòng lặp một tính năng

```
5.1 Tìm hiểu ─► 5.2 Spec ─► 5.3 Plan ─► 5.4 Tasks ─► 5.5 PR hợp đồng ─► 5.6 Implement ─► 5.7 Nghiệm thu ─► 5.8 Merge & replan
   (dev)       G1 (người)   G2 (người)                (nếu cần)          (agent + CI)      G3 (người + CI)
```
Mở **phiên chat mới** ở mỗi bước lớn (spec, plan, implement) — file là bộ nhớ, không phải lịch sử chat.

### 5.1 Tìm hiểu — dev làm
Trả lời hai câu hỏi trước khi viết gì:
1. Tính năng chạm vào **những module nào**?
2. Có phải **sửa hợp đồng dùng chung** không?

Agent tra cứu giúp (prompt [P5](#p5--phân-tích-phụ-thuộc)) hoặc dùng công cụ: `madge`/`dependency-cruiser` (JS/TS), "Find All References" trong IDE, `nx affected` (monorepo). **Kết luận là của dev.** Không trả lời được hai câu trên → chưa bắt đầu.

### 5.2 Spec
```bash
bash .gf/scripts/new-spec.sh <dự-án> ap-ma-giam-gia
```
Lệnh tạo `projects/<dự-án>/specs/015-ap-ma-giam-gia/`. Branch `feat/015-ap-ma-giam-gia` trên repo code do agent tạo khi bắt đầu triển khai.
Soạn bằng `/gf-spec` (hoặc prompt [P4](#p4--soạn-spec)). Người tập trung vào:
- **Phụ thuộc:** module + quan hệ (xem bên dưới). Dev tự quyết cột Quan hệ.
- **Ngoài phạm vi:** chặn agent làm thêm.
- **AC:** kiểm tra được bằng máy.
  - ❌ `Then hệ thống báo lỗi`
  - ✅ `Then trả về HTTP 422, code "PROMO_EXPIRED", tổng tiền không đổi`

**Từ khóa quan hệ** (script đọc cột này):
| Quan hệ | Nghĩa | Agent được sửa? |
|---|---|---|
| `Chỉ đọc` | Dùng qua cửa vào công khai | ✗ |
| `Sửa nội bộ` | Sửa bên trong, không đổi hợp đồng | ✓ |
| `Sửa hợp đồng` | Đổi type/API/schema dùng chung | ✓ — PR riêng làm trước (5.5) |
| `Mới` | Module mới | ✓ |
| `Bị ảnh hưởng` | Đang dùng thứ bị đổi; test phải chạy lại | ✗ (cảnh báo nếu sửa) |

Ví dụ:
```markdown
| Module | Quan hệ | Ghi chú |
|---|---|---|
| cart, promotion | Chỉ đọc | |
| pricing | Sửa hợp đồng | Thêm `discounts` vào PriceResult — ADR-012 |
| checkout | Sửa nội bộ | |
| invoice | Bị ảnh hưởng | Đang dùng PriceResult |
```
Trả lời hết câu hỏi 🔴 (đổi thành ✅) → `**Trạng thái:** approved` → **G1**.

### 5.3 Plan — agent đề xuất, người duyệt
Prompt [P6](#p6--soạn-plan). Người kiểm tra ba mục:
- **Tái sử dụng (mục 3):** mục "Tạo mới" có thứ gì đã tồn tại không? Lý do không dùng lại có thuyết phục không?
- **Pattern (mục 4):** mỗi phần việc có trỏ tới file mẫu không?
- **File bị ảnh hưởng (mục 6):** có nằm trong module đã khai báo không?

Duyệt → `approved` → **G2**. Chạy `bash .gf/scripts/check-spec.sh` để xác nhận.

### 5.4 Tasks
Prompt [P7](#p7--chia-tasks). Mỗi task gắn AC, có file mẫu, có cách kiểm chứng.

### 5.5 PR hợp đồng — chỉ khi có `Sửa hợp đồng`
Tách phần đổi hợp đồng thành PR nhỏ riêng (branch `feat/015-contract-discounts`), merge **trước**:
1. Đổi hợp đồng theo kiểu không phá vỡ (thêm trường tùy chọn, giá trị mặc định).
2. Cập nhật contract test của module sở hữu.
3. Chạy test của mọi module `Bị ảnh hưởng`.
4. Chủ module duyệt (CODEOWNERS tự yêu cầu). Thay đổi lớn → ADR.

Thay đổi phá vỡ bắt buộc → **expand–contract**: thêm cái mới cạnh cái cũ → chuyển bên dùng → xóa cái cũ; mỗi bước một PR.

Sau khi merge, phần còn lại của tính năng chỉ còn là "dùng", rủi ro giảm hẳn.

### 5.6 Implement — agent làm, CI canh
Prompt [P8](#p8--thực-thi-giai-đoạn). Nguyên tắc:
- Từng giai đoạn, dừng review sau mỗi giai đoạn.
- Agent muốn sửa module chưa khai báo → từ chối, cập nhật spec/plan trước.
- Spec sai/thiếu → prompt [P11](#p11--sửa-spec-giữa-chừng), sửa spec trước, code sau.
- CI mỗi commit: test, lint, type check, ranh giới module, `check-scope`.

### 5.7 Nghiệm thu — G3
1. CI xanh.
2. Đi hết checklist cuối `tasks.md`.
3. Tự tay thử từng AC.
4. Prompt [P9](#p9--đối-chiếu-code-với-spec) (hành vi) và [P10](#p10--rà-tái-sử-dụng--pattern) (reuse, pattern).
5. Chủ module review nếu PR chạm module của họ.
6. Cập nhật spec/plan khớp code → spec `implemented`.

### 5.8 Merge & replan
Merge, rồi 10–15 phút với prompt [P12](#p12--replan): roadmap, ADR thiếu, nguyên tắc cần viết rõ hơn, patterns cần bổ sung, template cần chỉnh.

---

## 6. Khi nào không cần spec

| Loại việc | Cần spec? | Branch |
|---|---|---|
| Tính năng mới, thay đổi hành vi người dùng thấy | Có | `feat/NNN-...` |
| Sửa hợp đồng dùng chung | Có (hoặc là Giai đoạn 0 của spec) | `feat/NNN-contract-...` |
| Sửa lỗi nhỏ, rõ ràng, 1 module | Không — mô tả trong PR, thêm test tái hiện lỗi | `fix/...` |
| Refactor không đổi hành vi | Không nếu nhỏ; có nếu nhiều module | `refactor/...` |
| Nâng version, cấu hình, tài liệu | Không | `chore/...` |

Chỉ tính năng có spec mới đi qua bộ agent gf. Quy trình nặng cho việc nhỏ sẽ khiến team bỏ quy trình.

---

## 7. Các lớp phòng thủ & cổng kiểm soát

| Lớp | Bắt lỗi gì | Công cụ |
|---|---|---|
| Spec | Sai ý định, thiếu trường hợp | AC Given/When/Then, review |
| Plan | Viết lại thứ đã có, sai hướng | Mục Tái sử dụng, Pattern, review |
| Patterns | Lệch cấu trúc | File mẫu |
| CI | Vi phạm máy móc | Test, lint, type, ranh giới, `check-spec`, `check-scope` |
| Review | Phần máy không phán được | Người + CODEOWNERS |

| Gate | Trước khi | Điều kiện | Kiểm tra tự động |
|---|---|---|---|
| G1 | Viết plan | Spec approved và đạt mọi tiêu chí sẵn sàng: không còn 🔴, Phụ thuộc đúng từ khóa, mỗi FR có AC, AC đủ Given/When/Then và không có từ mơ hồ, luồng lỗi trỏ tới AC, Ngoài phạm vi có nội dung, không còn nhãn chưa xác nhận | `check-ready.sh` (qua `check-spec.sh`) |
| G2 | Viết code | Plan approved, có Tái sử dụng, Pattern | `check-spec.sh` |
| G3 | Merge | Checklist tasks.md, CI xanh, spec khớp code | CI của dự án + checklist tasks.md |

---

## 8. Script

### 8.1 Script
Chạy trong thư mục gốc gf. `<spec>` là đường dẫn tới thư mục spec, ví dụ `projects/shop-api/specs/015-ap-ma-giam-gia`.

| Lệnh | Tác dụng |
|---|---|
| `bash .gf/scripts/new-spec.sh <dự-án> <ten>` | Tạo spec mới trong dự án, đánh số tự động |
| `bash .gf/scripts/check-ready.sh <spec>` | G1: spec đạt các tiêu chí sẵn sàng chưa |
| `bash .gf/scripts/check-spec.sh <spec>` | G1/G2: trạng thái spec và plan, chạy `check-ready.sh` |
| `bash .gf/scripts/check-scope.sh <spec>` | Module bị sửa trong repo code có khớp mục Phụ thuộc không. So branch hiện tại của repo (`PROJECT_PATH`, hoặc `GF_CODE_DIR` nếu đặt) với `BASE_BRANCH` |

`check-scope.sh` báo:
- ✗ Module bị sửa nhưng không khai báo
- ✗ Module `Chỉ đọc` bị sửa
- ! Module `Bị ảnh hưởng` bị sửa
- ! Module khai báo sửa nhưng chưa có thay đổi
- ! File ngoài mọi module / file hạ tầng dùng chung (`SHARED_PATHS`)

### 8.2 Khi nào script chạy
Spec nằm trong thư mục gốc chứ không nằm trong repo code, nên CI của repo code không chạy được các script này. Gate máy chạy local: `/gf-spec` chạy `check-ready` trước khi đặt `approved`; bộ agent chạy `check-spec` và `check-scope` trong lúc triển khai.

### 8.3 Công cụ nên bổ sung (theo stack)
| Mục đích | JS/TS | Python | Java/Kotlin | Go |
|---|---|---|---|---|
| Ép ranh giới import | dependency-cruiser, eslint-plugin-boundaries | import-linter | ArchUnit | go-arch-lint |
| Phát hiện code trùng | jscpd | pylint duplicate-code, jscpd | PMD CPD | dupl |
| Tìm bên phụ thuộc | madge, nx affected | pydeps | jdeps | go list -deps |

---

## 9. Brownfield

1. **Không viết spec cho cả hệ thống.** Chỉ cho vùng đang thay đổi.
2. **Characterization test trước, sửa sau** (tasks Giai đoạn 0). Test chốt hành vi hiện tại, pass trước khi sửa gì.
3. **Spec mục 11 (Hành vi hiện tại)** do người hiểu hệ thống xác nhận — AI chỉ thấy code, không biết người dùng phụ thuộc vào gì.
4. **Ranh giới dựng dần.** Hệ thống cũ thường không có cửa vào module rõ ràng. Mỗi tính năng làm xong, dựng cửa vào cho module vừa chạm; thêm dần vào bảng module và `config.sh`.
5. **Bắt đầu với `SCOPE_MODE="warn"`** và vùng rủi ro thấp.

---

## 10. Dự án lớn: phụ thuộc giữa tính năng

| Tình huống | Xử lý |
|---|---|
| Tính năng dùng module khác | Khai báo `Chỉ đọc`; agent đọc cửa vào công khai của module đó |
| Tính năng đổi hợp đồng dùng chung | PR hợp đồng riêng, trước (5.5); chủ module duyệt; ADR nếu lớn |
| Đổi hợp đồng kiểu phá vỡ | Expand–contract, mỗi bước một PR |
| Vấn đề xuyên suốt (phân quyền, log, i18n) | Quy tắc chung ở constitution/patterns; spec chỉ tham chiếu |
| Hai spec cùng sửa một module | Bảng "Spec đang thực hiện" trong constitution; thống nhất hợp đồng trước hoặc tuần tự |
| Spec phụ thuộc spec chưa xong | Ghi "Liên quan"; làm spec nền trước, hoặc code theo stub của hợp đồng + feature flag |
| Mục Phụ thuộc quá dài (> 6–8 module) | Tín hiệu: tính năng quá to → tách; hoặc kiến trúc thiếu ranh giới → xử lý kiến trúc |

---

## 11. Vai trò trong team

| Vai trò | Trách nhiệm |
|---|---|
| Tech lead | Constitution, ADR, patterns, cấu hình công cụ ép ranh giới |
| Người đặt yêu cầu (PO/BA) | Duyệt spec: vấn đề, phạm vi, AC (G1) |
| Dev phụ trách spec | Tìm hiểu, xác định phụ thuộc, dẫn dắt spec, duyệt plan (G2), nghiệm thu (G3) |
| Chủ module | Bảo vệ hợp đồng; review PR chạm module |
| AI agent | Tra cứu, soạn nháp, code, test, tự rà soát, báo mâu thuẫn |
| CI | Chặn vi phạm máy móc |

---

## 12. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Code đúng spec nhưng sai ý | AC mơ hồ | AC có số liệu, mã lỗi cụ thể |
| Agent làm thêm thứ không yêu cầu | Thiếu "Ngoài phạm vi" | Liệt kê rõ |
| Agent sửa module khác | Phụ thuộc không khai báo / không ép | `check-scope.sh` strict + luật AGENTS.md |
| Viết lại hàm đã có | Không tìm trước | Mục Tái sử dụng trong plan + bảng code dùng chung |
| Mỗi chỗ một kiểu code | Không có file mẫu | patterns.md + lint rule |
| Spec cũ lệch code | Sửa code bỏ qua spec | Sửa spec trước; checklist G3 |
| Agent quên ngữ cảnh | Chat quá dài | Phiên mới mỗi bước |
| Test cũ bị sửa để pass | Agent "chữa cháy" | Luật AGENTS.md + xem diff thư mục test |
| Gates chỉ còn đóng dấu | Duyệt không đọc | Review tập trung Phụ thuộc, AC, Tái sử dụng — ba chỗ quan trọng nhất |
| Team bỏ quy trình | Quá nặng cho việc nhỏ | Mục 6: việc nhỏ không cần spec |

---

## 13. Thư viện prompt

> Thay `NNN-ten` bằng tên thật. 🆕 = mở phiên chat mới.

### P1 — Phỏng vấn constitution
```
Đọc projects/<dự-án>/constitution.md. Phỏng vấn tôi từng mục để điền file này, mỗi lần 2–3 câu.
Không tự bịa; chỗ tôi chưa quyết ghi TBD. Xong mỗi mục, tóm tắt để tôi xác nhận rồi mới ghi.
```

### P2 — Khảo sát codebase (brownfield)
```
Khảo sát codebase. Đề xuất nội dung cho mục 2, 3 và 5 của projects/<dự-án>/constitution.md.
Với bảng module (3.2): đề xuất tên module khớp cấu trúc thư mục và MODULE_GLOBS cho projects/<dự-án>/config.sh.
Đánh dấu [SUY ĐOÁN] mọi điều không chắc. Liệt kê riêng các đoạn có vẻ là quy tắc nghiệp vụ ngầm hoặc workaround.
Chỉ đề xuất, không sửa file.
```

### P3 — Tìm file mẫu & code dùng chung
```
Tìm trong codebase: (1) với mỗi loại công việc trong bảng 1 của projects/<dự-án>/patterns.md, 1–2 file ứng viên làm mẫu
kèm lý do; (2) các hàm tiện ích/service/hook được dùng lại nhiều nơi; (3) các chỗ có code gần như trùng nhau.
Chỉ báo cáo, không sửa file.
```

### P4 — Soạn spec 🆕
```
Đọc projects/<dự-án>/constitution.md. Tính năng: <mô tả 2–5 câu>.
Kết quả tìm hiểu của tôi: chạm module <...>; <có/không> sửa hợp đồng <...>.
Điền projects/<dự-án>/specs/NNN-ten/spec.md:
- Không viết chi tiết kỹ thuật.
- Mục Phụ thuộc: dùng đúng từ khóa quan hệ; nếu thấy module nào tôi bỏ sót, đưa vào Câu hỏi mở thay vì tự thêm.
- AC dạng Given/When/Then, kiểm tra được bằng test tự động.
- Điểm chưa rõ → Câu hỏi mở, 🔴 nếu chặn. Không tự quyết.
```

### P5 — Phân tích phụ thuộc
```
Tính năng <mô tả> có thể cần thay đổi <type/API/hàm>.
Tìm mọi module đang import hoặc dùng các thứ đó (theo MODULE_GLOBS trong projects/<dự-án>/config.sh).
Soạn bảng Phụ thuộc dạng | Module | Quan hệ đề xuất | Bằng chứng (file:dòng) |. Chỉ báo cáo.
```

### P6 — Soạn plan 🆕
```
Spec projects/<dự-án>/specs/NNN-ten/spec.md đã approved. Đọc constitution, patterns.md, ADR liên quan, spec,
và cửa vào công khai của các module trong mục Phụ thuộc. Viết plan.md:
- Mục 3 Tái sử dụng: TÌM trong codebase trước; mọi thứ tạo mới phải có lý do.
- Mục 4 Pattern: trỏ tới file mẫu trong patterns.md cho từng phần việc.
- Chỉ sửa module khai báo trong spec. Mâu thuẫn với constitution → dừng và báo.
```

### P7 — Chia tasks
```
Chia plan.md thành tasks.md. Mỗi task: gắn AC, ghi file mẫu, có cách kiểm chứng.
Có "Sửa hợp đồng" → T0.1 là PR hợp đồng riêng. Brownfield → T0.2 characterization test.
```

### P8 — Thực thi giai đoạn 🆕
```
Thực hiện Giai đoạn <X> trong projects/<dự-án>/specs/NNN-ten/tasks.md theo AGENTS.md.
Sau mỗi task: chạy test liên quan, tick checkbox, commit "[NNN-Tx] mô tả".
Cuối giai đoạn: chạy bash .gf/scripts/check-scope.sh, sửa lỗi nếu có, rồi dừng chờ tôi review.
```

### P9 — Đối chiếu code với spec
```
Đối chiếu code trên branch hiện tại với projects/<dự-án>/specs/NNN-ten/spec.md.
Liệt kê: (1) chỗ code khác spec, (2) AC chưa có test, (3) file ngoài plan mục 6,
(4) module bị sửa không có trong mục Phụ thuộc, hoặc module 'Chỉ đọc' bị sửa. Chỉ báo cáo.
```

### P10 — Rà tái sử dụng & pattern
```
Rà code mới trên branch hiện tại:
(1) hàm/component/type nào trùng hoặc gần giống thứ đã có trong codebase — chỉ rõ vị trí cái đã có;
(2) chỗ nào lệch so với file mẫu trong projects/<dự-án>/patterns.md;
(3) lỗi nào nên thành lint rule. Chỉ báo cáo.
```

### P11 — Sửa spec giữa chừng
```
Khi làm task <Tx> phát hiện: <vấn đề>. Đề xuất sửa spec.md (và plan.md nếu cần),
ghi vào Lịch sử thay đổi. Chưa sửa code cho tới khi tôi duyệt.
```

### P12 — Replan 🆕
```
Tính năng NNN vừa merge. Đề xuất cập nhật: roadmap và bảng "Spec đang thực hiện" trong constitution;
quyết định nên ghi ADR; bổ sung patterns.md (file mẫu, code dùng chung, lỗi lặp lại);
chỉnh sửa specs/_template nếu có mục thừa/thiếu. Chỉ đề xuất.
```
