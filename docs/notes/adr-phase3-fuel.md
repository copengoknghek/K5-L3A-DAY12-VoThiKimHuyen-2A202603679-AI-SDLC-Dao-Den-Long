# ADR: Phase 3 — Đèn cạn dần (fuel & luật thắng)

## Bối cảnh

Playtest cho thấy thắng sớm khi thắp hết đèn làm Đêm kết thúc quá nhanh. Ticket-03 thay mô hình đèn và điều kiện thắng.

## Quyết định

1. **Dầu nội bộ (`fuelSixtieths`)** — Lưu nhiên liệu theo bội số 1/60 (một “đơn vị dầu” mỗi tick khi đang sáng), xuất JSONL làm tròn 1 chữ số thập phân. Tránh sai số float khi cộng hút Bóng Mực.

2. **Tương tác một nút `interact`** — Giữ một luồng: đèn tắt nạp tới ngưỡng (10 hoặc 5 nếu `ever_lit`), đèn sáng chưa đầy châm theo `ceil(khoảng trống / 10)` đom. Đèn đầy không nằm trong tập ứng viên.

3. **Vùng an toàn gắn dầu** — Chỉ `lit && fuel >= 30`. Bóng Mực `wander` ưu tiên đèn yếu; trạng thái `drain` mới hút 5/s và đứng yên. `chase` không đổi mục tiêu như trước.

4. **Thắng ở bình minh** — Bỏ `all_lit`. Cuối tick: `no_flames` trước; hết giờ thì so `đèn sáng >= ceil(0.6 × tổng đèn)`.

5. **Sức chứa động** — `10 + 2 × successful_lights`, max 20; reset mỗi Đêm. Chỉ tăng khi thắp thành công trong run (không tính đèn scenario đặt sẵn `lit`).

## Hệ quả

- Headless snapshot/events mở rộng (v1.2); test Phase 1–2 không bị thay thế phải vẫn pass sau chỉnh test “thắng sớm”.
- Client: thanh dầu, nhấp nháy <30, chế độ dễ phân biệt màu (lưu localStorage).