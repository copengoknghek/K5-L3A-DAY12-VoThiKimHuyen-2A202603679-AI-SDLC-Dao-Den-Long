# Đảo Đèn Lồng — Đêm 1 (Phase 1)

<!-- Video demo: thêm link Release ở Phase 4 -->

Game 3D: Mây thu đom đóm, thắp 5 Đèn Lồng Lớn, né Bóng Mực.

## Cài và chạy (≤ 3 lệnh)

```bash
npm ci
npm run build
npm run preview
```

Mở **http://127.0.0.1:4173** — click canvas để khóa chuột.

## Điều khiển

| Phím | Hành động |
|------|-----------|
| WASD | Di chuyển (theo hướng camera) |
| Chuột | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất |
| F | Tỏa sáng (xua Bóng Mực) |
| R | Chơi lại sau thắng/thua |

## Điểm

- +10 mỗi đom đóm nhặt  
- +100 mỗi đèn vừa thắp  
- +25 mỗi Bóng Mực bị stun bởi pulse  
- Khi **thắng**: thêm `floor(thời gian còn) × 1` + `flames còn × 20`

Chi tiết số trong [`game.contract.json`](game.contract.json) → `tuning`. Giả định: [`docs/notes/phase-1-assumptions.md`](docs/notes/phase-1-assumptions.md).

## Headless (Test Contract v1.0)

```bash
node dist/src/headless/cli.js --seed 1 --night 1 --ticks 60 --out out.jsonl
```

Thêm `--scenario path.json` và/hoặc `--inputs path.json`. Xem `npm test`.

## Sáng tạo của tôi

- Đom đóm nhấp nháy (sin) và đèn sáng dần khi thắp — chỉ hiển thị Three.js, **không** đổi output headless.

## Bằng chứng Phase 1

[`docs/proof/phase-1.md`](docs/proof/phase-1.md)

---

Tài liệu lab: [GUIDE](GUIDE.md) · [CHECKPOINTS](CHECKPOINTS.md) · [SUBMISSION](SUBMISSION.md) · [RULES](RULES.md) · [RUBRIC](RUBRIC.md)