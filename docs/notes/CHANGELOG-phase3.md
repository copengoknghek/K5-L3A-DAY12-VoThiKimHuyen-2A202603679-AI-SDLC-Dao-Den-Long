# Breaking changes — Phase 3 (contract v1.2)

| Thay đổi | Trước (v1.1) | Sau (v1.2) |
|---|---|---|
| Thắng | `all_lit` ngay khi mọi đèn sáng | `dawn_survived` khi hết giờ, ≥60% đèn còn sáng |
| Thời lượng Đêm | 300 / 330 / 360 s | 240 / 270 / 300 s |
| Đèn đã sáng | Không tắt | Hết dầu → `lantern_out`, có thắp lại (5 đom) và châm dầu |
| Vùng an toàn | Mọi đèn `lit` | Chỉ đèn `lit` và `fuel ≥ 30` |
| Bóng Mực | Không vào vùng an toàn | `drain` ở đèn yếu |
| Điểm | +10/đom nạp, thưởng thời gian còn lại | +5/đom; thưởng bình minh theo dầu còn |
| Snapshot | Không có `fuel`, `capacity` | Có `fuel`, `ever_lit`, `relit_count`, `capacity`; shade có `drain` |
| Sự kiện | Không có `refuel`, `lantern_out`, `fuel_drain` | Thêm các sự kiện trên |