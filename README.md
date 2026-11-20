# Đảo Đèn Lồng — Phase 2 (3 Đêm)

<!-- Video demo: thêm link Release ở Phase 4 -->

Game 3D: Mây thắp đèn trên **Đảo Bến, Đảo Cau, Đảo Chuông**. Contract **v1.1**.

## Cài và chạy (≤ 3 lệnh)

```bash
npm ci
npm run build
npm run preview
```

Mở **http://127.0.0.1:4173**

## Điều khiển

| Phím | Hành động |
|------|-----------|
| W/S ↑↓ · A/D ←→ | Đi |
| Chuột | Xoay (nhạy trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt |
| E | Nạp đèn |
| F | Tỏa Sáng (tốn 3 đom đóm) |
| Esc / P | Tạm dừng |

## Điểm (chuẩn)

- +10 mỗi đom đóm **nạp** vào đèn  
- +100 mỗi đèn thắp  
- +5 mỗi Bóng Mực trúng Tỏa Sáng  
- Thắng đêm: `floor(giây còn)×2 + 50×Ngọn Lửa`  
- Tổng game = tổng điểm các đêm **thắng**

Số liệu: [`game.contract.json`](game.contract.json). Spec: [`docs/notes/phase-2-assumptions.md`](docs/notes/phase-2-assumptions.md).

## Headless (Test Contract v1.1)

```bash
node dist/src/headless/cli.js --seed 1 --night 1 --ticks 60 --out out.jsonl
```

`--night` = 1, 2 hoặc 3.

## Sáng tạo của tôi

- Mesh Mây (nón lá, khăn đỏ), cỏ/cây Đêm 1, Web Audio — không đổi headless.

## Bằng chứng

- Phase 1: [`docs/proof/phase-1.md`](docs/proof/phase-1.md)  
- Phase 2: [`docs/proof/phase-2.md`](docs/proof/phase-2.md)

---

Tài liệu lab: [GUIDE](GUIDE.md) · [CHECKPOINTS](CHECKPOINTS.md) · [SUBMISSION](SUBMISSION.md) · [RULES](RULES.md) · [RUBRIC](RUBRIC.md)