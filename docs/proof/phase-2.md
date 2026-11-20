# Bằng chứng Phase 2

| Yêu cầu | Lệnh / cách | Kết quả |
|---------|-------------|---------|
| Contract 1.1 | `game.contract.json` | Đạt |
| Regression P1 (số chuẩn) | `npm test` suite sim | Đạt |
| Dash, pause, charm, drifter, night 3 snapshot | `npm test` suite phase-2 | Đạt |
| Headless --night 2/3 | CLI `--night` 1–3 | Đạt |
| Client 3 đêm, HUD, pause | `npm run preview` | Đạt (chơi tay) |

```bash
npm test
node dist/src/headless/cli.js --seed 1 --night 2 --ticks 60 --out docs/proof/phase-2/n2.jsonl
```