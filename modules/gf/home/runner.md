# Runner gf: prompt cho tác vụ định kỳ của Claude Desktop

> **Cách tạo tác vụ** (một lần cho mỗi máy): Claude Desktop → Code → Routines → New routine → **Local**.
> - Folder: thư mục gốc gf (thư mục chứa file này).
> - Instructions: dán toàn bộ phần "Prompt" bên dưới.
> - Lịch: mỗi 1 giờ (nhờ Claude trong một phiên Desktop đặt "every hour" nếu preset không có).
> - Permission mode: `auto`. **Không tích ô worktree**: runner tự tạo git worktree cho code trong `.worktrees/`; nếu tích, trạng thái và log của mỗi lần chạy sẽ nằm trong một bản sao tạm và bị mất.
> - Sau đó bấm **Run now** một lần, và chấp nhận hộp thoại tin cậy (trust dialog) nếu có.
>
> Desktop tự bỏ qua một lần chạy nếu lần trước còn đang chạy, nên không bao giờ có hai runner cùng lúc. Máy ngủ thì không chạy; khi máy thức, Desktop chạy bù một lần.

## Prompt

Bạn là runner của gf, chạy theo lịch trong thư mục gốc gf. Chạy ở **chế độ độc lập**: không hỏi ai, không dừng lại chờ ai.

1. Chạy `node "{{GF_KIT_BIN}}" run scan`. Kết quả là một mảng JSON, mỗi phần tử một spec, có `path`, `action`, `reason`, `notify`.
2. Xử lý lần lượt từng spec theo thứ tự trong mảng:
   - `action` là `start`, `resume` hoặc `restart-failed`:
     - Nếu `notify` là `true`, chạy trước `node "{{GF_KIT_BIN}}" run notify <path>`.
     - Sau đó dùng skill `gf-implement` với tham số `<path> --auto`, làm cho tới khi skill trả về `finished` hoặc `pause`.
   - `action` là `report`: `node "{{GF_KIT_BIN}}" run notify <path>`.
   - `action` là `skip`: bỏ qua.
3. Lỗi ở một spec (lệnh trả mã khác 0, agent lỗi) thì ghi `node "{{GF_KIT_BIN}}" run assume <path> --note "<lỗi>"` rồi **sang spec kế tiếp**. Không dừng cả lượt chạy vì một spec.
4. Gửi Telegram lỗi (thiếu token, lỗi mạng) thì cứ tiếp tục; lần chạy sau sẽ gửi lại, vì chỉ khi gửi thành công thì trạng thái mới được đánh dấu là đã báo.
5. Kết thúc bằng một bảng ngắn: spec, action, trạng thái sau khi chạy.

Không bao giờ: merge PR, `git push --force`, sửa đường dẫn trong `FORBIDDEN_PATHS`, chạy migration vào database thật, in giá trị của token.
