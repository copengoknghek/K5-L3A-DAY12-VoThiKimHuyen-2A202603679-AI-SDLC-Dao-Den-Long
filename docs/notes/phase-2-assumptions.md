# Phase 2 — giả định & acceptance

## Số liệu

Dùng đúng TICKET-02 Phần 1 (không tự chọn lại). `game.contract.json` v1.1.

## Acceptance (Phần 3)

| Mục | Tiêu chí | Kiểm chứng |
|-----|----------|------------|
| Gió Lạc | Cướp 3 đom đóm, flee, pulse drop | `tests` drifter + chơi Đêm 2 |
| Bùa Gió | Nhặt C1 Đêm 2 tại (35,0,0); 600 tick, 7.2 m/s | fixture charm-n2 |
| 3 Đêm | Menu → intro Ông Đăng → chơi → kết quả → đêm sau / Bình Minh | client |
| Tạm dừng | Esc/P, snapshot paused, sim_tick đứng | fixture pause |
| Cài đặt | volume + mouse sens localStorage `ddl-settings` | client |
| Âm thanh | Web Audio pickup/pulse/hit/dash/win/lose | client |
| HUD | lửa, mm:ss đỏ ≤30s, k/n đèn, điểm, 10 ô đom đóm, CD lướt/tỏa, gợi ý E, mũi tên đèn | client |
| Palette | hex ticket ±10% | `src/client/stage.ts` + HUD CSS |
| Ánh sáng | 0.15+0.55*(lit/total) | `hemi.intensity` |

## Headless

`--night 1|2|3`. Snapshot có night, wind, vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s, motes.kind, drifters, charms.