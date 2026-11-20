# Agent harness — Đảo Đèn Lồng (Phase 2)

## Lệnh

```bash
npm ci && npm run build
npm test
npm run preview
```

Headless (contract v1.3):

```bash
node dist/src/headless/cli.js --seed 42 --night 1 --ticks 120 --out out.jsonl
node dist/src/bench/cli.js --seed 42 --duration 30 --out bench.json
node dist/src/soak/cli.js --seed 7 --nights 10 --out soak.json
```

`--night` nhận 1, 2, 3. Bench/soak không đổi JSONL headless.

## Quy tắc

- Mọi số gameplay khớp `game.contract.json` (v1.1) và TICKET-02 Phần 1.
- Logic chỉ trong `src/sim/`. Client không đổi JSONL.
- 60 tick/s. Khoảng cách XZ trừ khi ticket nói 3D (Tỏa Sáng).
- Thứ tự tick: pause → counters → move/fall → pickup → đèn → vùng an toàn → pulse → shade/drifter → chạm → spawn → thắng/thua.
- Pause: `tick` tăng, `sim_tick` đứng.
- Dựng scenario không event, không điểm.
- Cùng seed + scenario + inputs → JSONL giống hệt.
- Sáng tạo client tắt/không ảnh hưởng headless.

## Kiểm chứng

- `npm test` xanh (gồm dash, pause, charm, drifter, night 3 snapshot).
- Một đêm headless ≤ 21600 tick nên xong nhanh (không GPU).