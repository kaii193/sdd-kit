# Quyết định thiết kế

Ghi lại các điểm đã thống nhất khi xây dựng kit và lý do đằng sau.

## D1. SDD không phải vibe code
**Quyết định:** Dev phải hiểu hệ thống. Agent soạn nháp và viết code trong phạm vi đã khoanh, con người quyết định kiến trúc, phụ thuộc, tiêu chí nghiệm thu và nghiệm thu.
**Lý do:** Nếu agent tự viết spec, plan và dev chỉ bấm duyệt, quy trình chỉ còn là giấy tờ. Ở dự án lớn, lỗi tích tụ trong những thứ nghe hợp lý mà không ai kiểm chứng.

## D2. Tách spec, plan, tasks (đã thay bằng D13)
**Quyết định:** Spec trả lời cái gì và tại sao, plan trả lời làm thế nào và dùng lại gì, tasks là các bước có kiểm chứng.
**Lý do:** Người duyệt ý định và người duyệt kỹ thuật khác nhau. Trộn chung làm cả hai khó duyệt.

## D3. Phụ thuộc giữa tính năng là vấn đề kiến trúc
**Quyết định:** Giải quyết bằng kỹ thuật phần mềm tiêu chuẩn: ranh giới module có cửa vào công khai, hợp đồng bằng code, test ở ranh giới, chủ module review, PR nhỏ. SDD chỉ bổ sung mục Phụ thuộc trong spec.
**Lý do:** Vấn đề này có từ trước khi có AI và đã có lời giải. Đóng gói lại bằng tên gọi SDD chỉ làm nó phức tạp hơn.

## D4. Không dùng capability spec dạng Markdown
**Quyết định:** Không duy trì tài liệu Markdown mô tả hành vi hiện tại của từng module.
**Lý do:** Nó lặp lại những gì code đã nói và chắc chắn lệch khỏi code theo thời gian. Nguồn sự thật cho hành vi hiện tại là code, type, schema và test.

## D5. Mục Phụ thuộc khai báo theo module, không theo file
**Quyết định:** Bảng ba cột: Module, Quan hệ, Ghi chú. Năm từ khóa quan hệ cố định: Chỉ đọc, Sửa nội bộ, Sửa hợp đồng, Mới, Bị ảnh hưởng.
**Lý do:** Một tính năng sửa nhiều file nhưng chỉ chạm vài module. Liệt kê file không ai duy trì nổi. Danh sách file chi tiết thuộc về plan. Agent hoặc công cụ phân tích tĩnh tìm bên phụ thuộc, dev chỉ quyết định cột Quan hệ.

## D6. Sửa hợp đồng làm trước, trong PR riêng
**Quyết định:** Thay đổi hợp đồng dùng chung là Giai đoạn 0, PR riêng, chủ module duyệt, merge trước. Thay đổi phá vỡ dùng expand–contract.
**Lý do:** Sau khi hợp đồng đã merge, phần còn lại của tính năng chỉ còn là dùng, rủi ro giảm hẳn.

## D7. Spec không đảm bảo chất lượng code
**Quyết định:** Mỗi loại lỗi xử lý ở đúng tầng: hành vi ở spec, tái sử dụng ở plan, pattern ở patterns.md, vi phạm máy móc ở CI, phần còn lại ở review.
**Lý do:** Spec chỉ nói cái gì. Code đúng spec vẫn có thể viết lại hàm đã có hoặc lệch pattern. Nhồi thêm vào spec không giải quyết được.

## D8. Pattern dạy bằng file mẫu
**Quyết định:** patterns.md trỏ tới code thật trong dự án. Lỗi pattern lặp lại được ghi nhật ký và cân nhắc chuyển thành lint rule.
**Lý do:** Agent làm theo ví dụ tốt hơn làm theo quy tắc trừu tượng. Lint rule loại bỏ lỗi vĩnh viễn thay vì phải nhắc mãi.

## D9. Máy kiểm tra được thì để máy kiểm tra (CI đã thay bằng gate local, D14)
**Quyết định:** check-spec.sh chặn gate G1, G2. check-scope.sh so sánh module bị sửa với mục Phụ thuộc. CI chạy cả hai trên branch feature.
**Lý do:** Gate chỉ dựa vào người dễ thành đóng dấu cho qua.

## D10. Việc nhỏ không cần spec
**Quyết định:** Sửa lỗi nhỏ, refactor nhỏ, chore dùng branch fix, refactor, chore và không qua kiểm tra SDD.
**Lý do:** Quy trình nặng cho việc nhỏ khiến team bỏ quy trình.

## D11. Kit không đụng README của dự án
**Quyết định:** Hướng dẫn cho người nằm ở sdd/GUIDE.md, luật cho agent ở AGENTS.md.
**Lý do:** README của dự án dùng cho cài đặt, cấu hình và chạy dự án.

## D12. Người chỉ viết spec, agent làm phần còn lại
**Quyết định:** Dev viết spec bằng `/gf-spec`. Sau khi spec `approved`, bộ agent (PM, Coding, QC, Reviewer) triển khai theo máy trạng thái, có người ngồi cùng (`/gf-implement`) hoặc tự chạy mỗi giờ (runner trên Claude Desktop Schedule).
**Lý do:** Spec là chỗ người tạo ra nhiều giá trị nhất. Phần còn lại lặp lại được, nên máy làm và máy kiểm.

## D13. PM task và task kỹ thuật thay cho plan và tasks
**Quyết định:** PM chia spec thành PM task theo góc nhìn người dùng (`pm-tasks.json`). Coding tách mỗi PM task thành task kỹ thuật (`tech/<task>.md`). Template `plan.md`/`tasks.md` và gate G2 bị bỏ.
**Lý do:** Có hai bộ tài liệu cho cùng một việc thì một bộ sẽ lệch. Máy trạng thái chỉ đọc `pm-tasks.json`.

## D14. Gate chạy local thay cho CI
**Quyết định:** Spec nằm trong thư mục gốc gf, không nằm trong repo code, nên CI của repo code không thấy spec. `check-ready` chạy trước khi `approved`; `run lock` và `run gate` chạy mỗi vòng.
**Lý do:** Repo code không nhận file nào từ kit, để giữ repo code sạch.

## D15. Máy trạng thái giữ luật, không để LLM tự nhớ
**Quyết định:** Đếm vòng, chuyển bước, phân loại FAILED/BLOCKED nằm trong code tất định (`lib/engine/state-machine.js`). Agent chỉ báo kết quả của bước mình làm; bước máy (lock, gate) không ghi tay được.
**Lý do:** Phiên dài bị nén ngữ cảnh thì LLM có thể quên mình đang ở vòng mấy, mà cả hệ thống dựa vào luật "tối đa 3 vòng".

## D16. Test viết trước và bị khóa
**Quyết định:** QC viết test theo interface stub trước khi có code. Test phải đỏ tại assertion. Coding không được sửa test đã khóa; QC sửa test phải trích spec, và số test/assertion không được giảm.
**Lý do:** Nếu người viết code cũng tự viết test, phán quyết "test xanh" là vô nghĩa.
