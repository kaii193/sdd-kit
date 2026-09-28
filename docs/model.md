# Mô hình SDD Kit

## Cấu trúc ba tầng

```mermaid
flowchart TB
  subgraph P["Tầng dự án: viết một lần, sửa khi replan"]
    C["Constitution: sứ mệnh, kiến trúc, module"]
    PT["Patterns: file mẫu, code dùng chung"]
    A["ADR: quyết định kiến trúc"]
  end
  subgraph F["Tầng tính năng: mỗi tính năng một branch"]
    S["Spec: cái gì, tại sao"] --> PL["Plan: cách làm, tái sử dụng"] --> T["Tasks: các bước, nghiệm thu"]
  end
  subgraph K["Tầng kiểm soát: canh gác mọi thay đổi"]
    AG["AGENTS.md: luật cho agent"]
    SC["Scripts: check-spec, check-scope"]
    CI["CI và review: test, lint, chủ module"]
  end
  P --> F
  K --> F
```

| Tầng | Vai trò |
|---|---|
| Dự án | Đặt luật chơi, dẫn dắt mọi tính năng |
| Tính năng | Chuyển ý định thành code qua spec, plan, tasks |
| Kiểm soát | Chặn thay đổi lệch khỏi spec và quy ước |

## Quy trình một tính năng

```mermaid
flowchart LR
  A["Tìm hiểu: dev xác định module, hợp đồng"] --> B["Spec: Gate G1"]
  B --> C["Plan: Gate G2"]
  C --> D["Tasks"]
  D --> E{"Sửa hợp đồng?"}
  E -- "Có" --> F["PR hợp đồng riêng, merge trước"]
  E -- "Không" --> G["Implement: agent làm, CI canh"]
  F --> G
  G --> H["Nghiệm thu: Gate G3"]
  H --> I["Merge, replan"]
  I -.-> A
  G -. "Spec sai hoặc thiếu" .-> B
```

| Bước | Người quyết định | Agent thực hiện |
|---|---|---|
| Tìm hiểu | Module chạm vào, có sửa hợp đồng không | Tra cứu nơi đang dùng |
| Spec | Phạm vi, quan hệ phụ thuộc, AC, duyệt G1 | Soạn nháp |
| Plan | Duyệt G2: tái sử dụng, pattern, file bị sửa | Đề xuất |
| Tasks | Kiểm tra mỗi task có AC và cách kiểm chứng | Chia bước |
| PR hợp đồng | Chủ module duyệt, ADR nếu lớn | Sửa hợp đồng và contract test |
| Implement | Review sau mỗi giai đoạn | Code, test, commit theo task |
| Nghiệm thu | Thử từng AC, duyệt G3 | Đối chiếu code với spec |
| Merge, replan | Cập nhật roadmap, ADR, patterns | Đề xuất cập nhật |

## Các lớp phòng thủ

| Lớp | Bắt lỗi |
|---|---|
| Spec | Sai ý định, thiếu trường hợp |
| Plan | Viết lại thứ đã có, sai hướng |
| Patterns | Lệch cấu trúc code |
| Scripts và CI | Sửa ngoài phạm vi, vi phạm máy móc |
| Review | Phần máy không phán được |
