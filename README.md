# Đảo Đèn Lồng — v1.0.0

**Video demo:** [Demo.mp4 trên GitHub](https://github.com/copengoknghek/K5-L3A-DAY12-VoThiKimHuyen-2A202603679-AI-SDLC-Dao-Den-Long/blob/main/docs/demo/Demo.mp4) (~10 MB, dưới 5 phút) · [Release v1.0.0](https://github.com/copengoknghek/K5-L3A-DAY12-VoThiKimHuyen-2A202603679-AI-SDLC-Dao-Den-Long/releases/download/v1.0.0/Demo.mp4) *(nếu đính thêm asset)* · [Repo](https://github.com/copengoknghek/K5-L3A-DAY12-VoThiKimHuyen-2A202603679-AI-SDLC-Dao-Den-Long)

Game 3D: Mây **giữ đảo sáng tới bình minh** trên **Đảo Bến, Đảo Cau, Đảo Chuông**. Contract **v1.3** (benchmark, soak, bảng xếp hạng, tiếp cận).

## Cài và chạy (≤ 3 lệnh)

```bash
npm ci
npm run build
npm run preview
```

Mở **http://127.0.0.1:4173** (hoặc `node dist/src/run/cli.js` — khởi động preview).

## Yêu cầu hệ thống

- Node.js 20+
- Trình duyệt WebGL2 (Chrome/Edge khuyến nghị)
- ~500 MB dung lượng (kèm devDependencies Puppeteer cho bench)

## Điều khiển (mặc định; đổi trong Cài đặt)

| Phím | Hành động |
|------|-----------|
| W/S/A/D | Đi |
| Chuột | Xoay (nhạy trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt |
| E | Thắp / châm dầu đèn |
| F | Tỏa Sáng |
| Esc | Tạm dừng |

**Tiếp cận:** phụ đề/chỉ báo (Bóng, gió, 10 giây cuối, dầu thấp), giảm chuyển động, chữ lớn ×1.25, UI ≥ 18 px @ 1280×720.

## Kiểm thử

```bash
npm test
```

**Windows PowerShell** (bản cũ không hỗ trợ `&&` — chạy **từng dòng**, hoặc nối bằng `;`):

Nếu `npm ci` báo **EPERM** trên `esbuild.exe`: dừng `npm run preview` / cửa sổ đang chạy game (Ctrl+C), đóng tab preview, rồi `npm install` (hoặc xóa `node_modules` và `npm ci` lại).

```powershell
npm ci; npm run build
npm test
node dist/src/bench/cli.js --seed 42 --duration 30 --out bench.json
node dist/src/soak/cli.js --seed 7 --nights 10 --out soak.json
node dist/src/run/cli.js
# chơi: npm run preview
```

### Headless (JSONL)

```bash
node dist/src/headless/cli.js --seed 1 --night 1 --ticks 60 --out out.jsonl
```

### Benchmark (WebGL + Puppeteer)

```bash
node dist/src/bench/cli.js --seed 42 --duration 30 --out bench.json
```

Cửa sổ **1280×720**, 3 s khởi động rồi đo. **VSync:** trên trình duyệt không tắt được hoàn toàn → `vsync_off: false` trong `bench.json`.

### Soak (10 đêm headless)

```bash
node dist/src/soak/cli.js --seed 7 --nights 10 --out soak.json
```

### Xuất bảng xếp hạng

Sau khi chơi và **Lưu điểm** (đồng bộ `leaderboard.json` qua preview):

```bash
node dist/src/run/cli.js --export-leaderboard out.json
```

## Phát hành v1.0.0

Bản chạy: thư mục **`dist/client/`** (web tĩnh sau `npm run build`) + headless CLI trong `dist/src/`. Gắn tag `phase-4` và GitHub Release `v1.0.0` kèm `dist/client` hoặc hướng dẫn 3 lệnh trên.

## Bằng chứng & tài liệu

- [Phase 1](docs/proof/phase-1.md) · [Phase 2](docs/proof/phase-2.md) · [Phase 3](docs/proof/phase-3.md) · [Phase 4](docs/proof/phase-4.md)
- [CHANGELOG](CHANGELOG.md) · [CREDITS](CREDITS.md) · [LICENSE](LICENSE)
- Retro: [docs/notes/retro-phase4.md](docs/notes/retro-phase4.md) · AI log: [P1](docs/notes/phase-1-ai-log.md) · [P2](docs/notes/phase-2-ai-log.md) · [P3](docs/notes/phase-3-ai-log.md)
- Nộp bài (tag/Release/video): [docs/notes/NOP-BAI-HUONG-DAN.md](docs/notes/NOP-BAI-HUONG-DAN.md)
- Kết quả mẫu: [`bench.json`](bench.json) · [`soak.json`](soak.json)

## Sáng tạo

Mesh Mây, cỏ/cây, Web Audio — không đổi đầu ra headless.