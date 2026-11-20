# Agent harness — Đảo Đèn Lồng (Phase 1)

## Lệnh

```bash
npm ci && npm run build   # build_cmd trong game.contract.json
npm test                  # sim + headless CLI
npm run preview           # game 3D (port 4173)
```

Headless (sau build):

```bash
node dist/src/headless/cli.js --seed 42 --night 1 --ticks 120 --out out.jsonl
```

## Quy tắc khi sửa code

- Mọi số gameplay phải khớp `game.contract.json` → `tuning`.
- Logic game chỉ trong `src/sim/`; client Three.js không đổi luật headless.
- Tick cố định 60/s; khoảng cách va chạm trên mặt phẳng XZ.
- Dựng scenario không phát event, không cộng điểm.
- Cùng seed + scenario + inputs → JSONL giống hệt.

## Kiểm chứng trước khi kết thúc

- `npm test` phải xanh.
- Chạy lại headless với fixture `tests/fixtures/` nếu đụng sim hoặc CLI.