# Giả định Phase 1

| Chủ đề | Giả định |
|--------|----------|
| Flames | `flames` = máu/ánh sáng; ban đầu 5 (tuning). |
| Nhặt đom đóm | Tự động trong `pickup_radius` 1.2 m, không cần nút. |
| Nạp đèn | Cạnh `interact`; đèn gần nhất trong 2 m; cần 5 đom đóm (`lantern_cost`). |
| Bóng Mực | 3 con ban đầu (seed); đuổi 3.2 m/s; va chạm 1 m. |
| Pulse | Tốn 1 flame; bán kính 8 m; stun 2 s; đẩy 4 m; cooldown 1.5 s. |
| An toàn | Bán kính 6 m quanh đèn **đã thắp**. |
| Thắng / thua | 5 đèn lit → thắng; flames ≤ 0 → thua; hết 180 s → thua dawn. |
| Đảo | Bán kính 40 m; `fall_enabled` false — kẹp viền, không phạt rơi. |
| Nhảy | 7.5 m/s, g = 24 m/s² (không nằm trong tuning JSON). |
| Đèn mặc định | Vòng bán kính 25 m, L1 tại (0, 0, 25). |