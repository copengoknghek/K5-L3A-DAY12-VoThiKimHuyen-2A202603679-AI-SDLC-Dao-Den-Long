# Retro Phase 4 (1–2 trang)

## Điều hiệu quả với AI

- Harness **AGENTS.md** (lệnh headless/bench/soak) giảm lệch contract.
- Tách **sim** khỏi client giúp soak/bench không đụng JSONL.
- Test `phase4.test.ts` bắt v1.3 sớm.

## AI sai và cách phát hiện

- Bench đo FPS sai do nhầm đơn vị `dt` (cap 0.1 ms thay vì 100 ms) → số `avg_fps` vô lý; sửa bằng so sánh công thức ticket.
- Puppeteer `networkidle0` timeout → chuyển `load` + tăng timeout.

## Harness hữu ích nhất

`AGENTS.md` + checklist Phase trong README/CHANGELOG.

## Token / chi phí (ước tính)

~400k–800k token qua 4 phase; tiết kiệm bằng grep/test trước khi nhờ AI đổi `step.ts` lớn.

## Làm lại sẽ đổi

- Bench CLI dùng Vite preview thay static server tự viết.
- Soak test snapshot mỗi đêm để debug RNG input.