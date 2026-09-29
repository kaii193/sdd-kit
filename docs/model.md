# Mô hình gf-autopilot

## Cấu trúc ba tầng

```mermaid
flowchart TB
  subgraph P["Tầng dự án (projects/<dự-án>/): viết một lần, sửa khi replan"]
    C["Constitution: kiến trúc, module, quyết định mặc định 4.5"]
    PT["Patterns: file mẫu, code dùng chung"]
    CFG["config.sh: repo code, lệnh test/lint, module"]
  end
  subgraph F["Tầng tính năng: mỗi spec một worktree, mỗi PM task một branch"]
    S["Spec: cái gì, tại sao"] --> PM["pm-tasks.json: tính năng theo góc nhìn người dùng"] --> TT["tech/: task kỹ thuật"]
  end
  subgraph K["Tầng kiểm soát"]
    SM["Máy trạng thái: bước, vòng, FAILED/BLOCKED"]
    G["Gate: khóa test, check-scope, lint, test"]
    R["Reviewer, QC, người review PR"]
  end
  P --> F
  K --> F
```

| Tầng | Vai trò |
|---|---|
| Dự án | Đặt luật chơi cho mọi tính năng của một repo code |
| Tính năng | Chuyển ý định thành code: spec → PM task → task kỹ thuật |
| Kiểm soát | Chặn thay đổi lệch khỏi spec và quy ước, bằng máy trước, người sau |

## Quy trình một tính năng

```mermaid
flowchart LR
  A["/gf-spec: dev viết, 3 critic debate"] --> B{"check-ready"}
  B -- "đạt" --> C["approved"]
  B -- "chưa" --> A
  C --> D["runner mỗi giờ hoặc /gf-implement"]
  D --> E["PM: pm-tasks.json"]
  E --> F["stub → test QC → lock"]
  F --> G["implement → gate → review → QC"]
  G -- "chưa đạt, vòng < 3" --> G
  G -- "đạt" --> H["PR draft"]
  G -- "hết 3 vòng" --> I["FAILED: sửa spec"]
  I -.-> A
  H --> J["Telegram → người review, merge"]
```

| Bước | Người quyết định | Agent/máy thực hiện |
|---|---|---|
| Spec | Phạm vi, Phụ thuộc, AC, trả lời câu hỏi 🔴 | Tra cứu, phỏng vấn, debate, `check-ready` |
| PM task | — | `gf-pm`; máy kiểm mọi AC đều có task |
| Test | — | `gf-qc` viết trước; máy kiểm "đỏ tại assertion" và khóa |
| Code | — | `gf-coder`; gate máy chặn sửa test khóa, sai phạm vi, lint/test đỏ |
| Nghiệm thu | Review PR draft, merge | `gf-reviewer`, `gf-qc`; tối đa 3 vòng |
| Replan | Cập nhật constitution 4.5, patterns | `run metrics` |

## Các lớp phòng thủ

| Lớp | Bắt lỗi |
|---|---|
| Spec + debate + `check-ready` | Sai ý định, thiếu trường hợp, thiếu tài nguyên |
| Test trước, khóa | Code chạy nhưng sai AC; test viết cho có |
| Gate máy | Sửa ngoài phạm vi, sửa test đã khóa, đường dẫn bị cấm, lint/test đỏ |
| Reviewer | Lệch pattern, viết lại thứ đã có |
| Người | Phần máy không phán được |
