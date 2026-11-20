# Bằng chứng Phase 1

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---------|------------------|---------|
| Headless JSONL | `npm test` + `sample-pickup.jsonl` | Đạt |
| Nhặt đom đóm | Event `mote_picked` trong JSONL mẫu | Đạt |
| Nạp / thắp đèn | Test `deposit and lantern_lit` | Đạt |
| Pulse | Test `pulse stuns shade` | Đạt |
| Va chạm Bóng Mực | Test `shade hit` + invuln | Đạt |
| Thắng | Test `win all_lit` | Đạt |
| Tất định | Test deterministic JSONL | Đạt |
| Game 3D | `npm run preview`, chơi Đêm 1 | Đạt (HUD + điều khiển) |

## Lệnh đã chạy

```bash
npm test
npm run build
node dist/src/headless/cli.js --seed 42 --night 1 \
  --scenario tests/fixtures/pickup-mote.json \
  --inputs tests/fixtures/move-north.json \
  --ticks 120 --out docs/proof/phase-1/sample-pickup.jsonl
```

File mẫu: [sample-pickup.jsonl](phase-1/sample-pickup.jsonl)