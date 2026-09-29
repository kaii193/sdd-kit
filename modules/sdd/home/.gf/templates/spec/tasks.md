# Tasks NNN — <Tên tính năng>

**Plan:** [plan.md](./plan.md) · **Tiến độ:** 0 / N

> Mỗi task nhỏ, gắn AC, có cách kiểm chứng. Commit: `[NNN-Tx] mô tả`.
> Hết mỗi giai đoạn: DỪNG chờ review.

---

## Giai đoạn 0 — Chuẩn bị
> Xóa task không áp dụng.

- [ ] **T0.1** (Nếu `Sửa hợp đồng`) Sửa hợp đồng theo plan mục 5 + cập nhật contract test — **PR riêng, merge trước**
  - Kiểm chứng: test của module sở hữu và mọi module đang dùng hợp đồng đều pass
- [ ] **T0.2** (Brownfield) Characterization test cho hành vi hiện tại ở <module>
  - Kiểm chứng: pass trên code hiện tại, chưa sửa gì

## Giai đoạn 1 — Nền tảng
- [ ] **T1.1** <mô tả>
  - AC: AC-x · Mẫu: <file mẫu> · Kiểm chứng: <lệnh / kết quả>

## Giai đoạn 2 — Tính năng chính
- [ ] **T2.1** <mô tả>
  - AC: AC-x · Mẫu: <file mẫu> · Kiểm chứng: <...>

## Giai đoạn 3 — Hoàn thiện
- [ ] **T3.1** Luồng lỗi / edge case
- [ ] **T3.2** Log, metric, tài liệu

---

## Checklist nghiệm thu — Gate G3 (người thực hiện)
**Tự động**
- [ ] CI xanh: test, lint, type check, kiểm tra ranh giới
- [ ] `check-spec.sh` và `check-scope.sh` pass

**Hành vi**
- [ ] Tự tay thử từng AC ít nhất một lần
- [ ] Không có test cũ bị xóa / skip / sửa để pass

**Chất lượng code**
- [ ] Không có hàm/component trùng với thứ đã có (đối chiếu plan mục 3)
- [ ] Code mới theo đúng file mẫu (plan mục 4)
- [ ] Lỗi pattern lặp lại → đã ghi vào `patterns.md` của dự án, mục 4

**Tài liệu**
- [ ] Spec, plan khớp với code cuối cùng; trạng thái spec → `implemented`
- [ ] Constitution: cập nhật roadmap, xóa khỏi bảng "Spec đang thực hiện"
- [ ] Ghi chú cho replan: <...>
