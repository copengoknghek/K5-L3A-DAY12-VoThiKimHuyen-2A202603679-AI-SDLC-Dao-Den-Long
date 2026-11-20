# Việc bạn tự làm sau khi push (không commit tự động)

## 1. Video demo

- File gốc quay màn hình: `Đảo Đèn Lồng - Google Chrome 2026-11-20 23-26-17.mp4` (~221 MB) — **quá 100 MB**, không nên commit nguyên file lên GitHub.
- Đã (hoặc sẽ) có bản nén: `docs/demo/demo.mp4` nếu `ffmpeg` chạy thành công.
- **Khuyến nghị:** đính kèm `demo.mp4` vào **GitHub Release `v1.0.0`**, rồi cập nhật link ở đầu README (xem mẫu URL trong README).

Repo: https://github.com/copengoknghek/K5-L3A-DAY12-VoThiKimHuyen-2A202603679-AI-SDLC-Dao-Den-Long

```powershell
gh release create v1.0.0 Demo.mp4 --title "v1.0.0" --notes "Video demo lab Day 12"
# hoặc nếu Release đã tạo:
gh release upload v1.0.0 Demo.mp4
```

Link người chấm bấm (đã ghi ở đầu README):
`https://github.com/copengoknghek/K5-L3A-DAY12-VoThiKimHuyen-2A202603679-AI-SDLC-Dao-Den-Long/releases/download/v1.0.0/Demo.mp4`

Nén thủ công nếu cần:

```powershell
ffmpeg -i "Đảo Đèn Lồng - Google Chrome 2026-11-20 23-26-17.mp4" -t 300 -c:v libx264 -crf 28 -preset veryfast -c:a aac -b:a 96k docs/demo/demo.mp4
```

## 2. Tag & Release

```powershell
git add -A
git status
git commit -m "feat: Phase 3-4, cờ VN, demo và bằng chứng nộp bài"

git tag phase-3   # trỏ commit hoàn thành phase 3 nếu tách commit
git tag phase-4
git push origin HEAD
git push origin phase-1 phase-2 phase-3 phase-4
git tag -a v1.0.0 -m "Đảo Đèn Lồng v1.0.0"
git push origin v1.0.0
```

Nếu `phase-3` / `phase-4` chưa từng push, gắn lại trỏ đúng commit **trước hạn lab** (xem [SUBMISSION.md](../../SUBMISSION.md)).

## 3. Kiểm tra cuối

```powershell
npm ci
npm run build
npm test
```

- Repo **Public**, tên đúng quy ước.
- Mở README link video cửa sổ ẩn danh.
- Nộp link repo lên **LMS**.

## 4. Checklist SUBMISSION §7

Xem [SUBMISSION.md](../../SUBMISSION.md) — đối chiếu tag, Release, proof, harness `AGENTS.md`, CREDITS/LICENSE.