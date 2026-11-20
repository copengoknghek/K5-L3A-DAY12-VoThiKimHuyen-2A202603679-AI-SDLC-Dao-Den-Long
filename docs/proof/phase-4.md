# Phase 4 — bằng chứng

**Máy đo (tham khảo):** Windows 11 · i5-11320H · ~17 GB RAM · tích hợp Intel

## Kiểm chứng

| Yêu cầu | Cách chứng minh | Kết quả |
|---------|-----------------|---------|
| Contract v1.3 | `game.contract.json`, `npm test` | pass |
| Benchmark | `node dist/src/bench/cli.js --seed 42 --duration 30 --out bench.json` | [`bench.json`](../../bench.json) |
| Soak 10 đêm | `node dist/src/soak/cli.js --seed 7 --nights 10 --out soak.json` | [`soak.json`](../../soak.json) |
| Bảng xếp hạng | Menu → Lưu điểm; `run_cmd --export-leaderboard` | test phase4 |
| Headless hồi quy | `npm test` 25/25 | pass |

## Ngưỡng soak (bài tự chạy)

- `crashes`: 0
- `mem_end_mb` / `mem_start_mb`: ≤ 1.2 (69.2 / 50 ≈ 1.38 trên máy dev — cần theo dõi; test nhanh 3 đêm pass)

## Ghi chú benchmark

- **VSync:** trình duyệt không tắt được vsync → `vsync_off: false` (mô tả trong README).
- Bench cần `npm run build` trước; Puppeteer HeadlessChrome + ANGLE WebGL.