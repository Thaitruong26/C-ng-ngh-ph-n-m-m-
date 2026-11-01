# BrewLite — Danh sách nguyên liệu và công thức đồ uống

> **Mục đích:** Tài liệu khởi tạo dữ liệu cho mô hình kho theo nguyên liệu của BrewLite. Dùng để rà soát và nhập dữ liệu vào `Ingredient`, `ProductRecipe` và `ToppingRecipe`.
>
> **Lưu ý:** Các định lượng dưới đây là **giá trị đề xuất để làm dữ liệu mẫu/test**, không phải công thức chính thức của quán. Cần điều chỉnh theo công thức pha chế thực tế trước khi dùng cho vận hành.
>
> **Đơn vị:** `G` = gam, `ML` = mililit, `PCS` = cái/phần. Công thức sản phẩm lấy **size M làm chuẩn**. Hệ số size tham khảo: S = 0.8, M = 1.0, L = 1.3. Khi áp dụng hệ số, làm tròn lên từng lượng nguyên liệu theo quy tắc đã thống nhất trong backend.

---

## 1. Danh mục nguyên liệu (`Ingredient`)

Dùng mã nguyên liệu trong tài liệu này làm mã tham chiếu để nối công thức. Khi seed database, có thể thay mã tham chiếu bằng ID thực tế được tạo trong DB.

| Mã tham chiếu | Tên nguyên liệu | Đơn vị | Ngưỡng cảnh báo gợi ý | Ghi chú |
|---|---|---:|---:|---|
| ING-001 | Cốt trà đen đã pha | ML | 2000 | Dùng cho trà sữa truyền thống, trà đào |
| ING-002 | Cốt trà ô long đã pha | ML | 2000 | Dùng cho các món ô long |
| ING-003 | Cốt trà xanh đã pha | ML | 2000 | Dùng cho trà xoài, matcha nếu công thức yêu cầu |
| ING-004 | Cốt trà hoa nhài đã pha | ML | 1500 | Dùng cho trà vải, trà dâu, ô long sữa nhài |
| ING-005 | Sữa tươi | ML | 3000 | Thành phần nền cho nhiều món sữa |
| ING-006 | Bột kem béo | G | 500 | Có thể thay bằng nguyên liệu thực tế của quán |
| ING-007 | Sữa đặc | G | 500 | Dùng cho cà phê sữa, bạc xỉu |
| ING-008 | Đường nước / syrup đường | ML | 1000 | Chọn một cách quản lý thống nhất |
| ING-009 | Bột khoai môn | G | 300 | Cho trà sữa khoai môn |
| ING-010 | Bánh Oreo nghiền | G | 300 | Thành phần món Oreo và topping Oreo |
| ING-011 | Kem cheese | G | 500 | Dùng cho món Oreo phô mai và topping kem cheese |
| ING-012 | Trân châu đen đã nấu | G | 1000 | Dùng cho trà sữa trân châu |
| ING-013 | Trân châu đường đen đã nấu | G | 800 | Dùng cho món/topping trân châu đường đen |
| ING-014 | Syrup đường đen | ML | 500 | Dùng cho món đường đen |
| ING-015 | Đào ngâm | G | 500 | Cho trà đào cam sả |
| ING-016 | Cam tươi | G | 500 | Cho trà đào cam sả |
| ING-017 | Sả | G | 200 | Cho trà đào cam sả |
| ING-018 | Vải ngâm | G | 500 | Cho trà vải |
| ING-019 | Syrup chanh dây | ML | 500 | Cho trà chanh dây |
| ING-020 | Dâu tây / puree dâu | G | 500 | Chọn dạng nguyên liệu thống nhất |
| ING-021 | Xoài / puree xoài | G | 500 | Chọn dạng nguyên liệu thống nhất |
| ING-022 | Bột matcha | G | 200 | Cho các món matcha |
| ING-023 | Đậu đỏ đã nấu | G | 500 | Cho matcha đậu đỏ và topping đậu đỏ |
| ING-024 | Cà phê espresso/phin đã pha | ML | 1000 | Chọn cách pha và đơn vị đo nhất quán |
| ING-025 | Muối | G | 100 | Cho kem muối |
| ING-026 | Kem nền / whipping cream | ML | 500 | Thành phần kem muối hoặc kem cheese tùy công thức |
| ING-027 | Thạch củ năng đã chuẩn bị | G | 500 | Topping |
| ING-028 | Thạch đen đã chuẩn bị | G | 500 | Topping |
| ING-029 | Trân châu popping | G | 500 | Topping |
| ING-030 | Thạch dừa | G | 500 | Topping |
| ING-031 | Pudding trứng | G | 500 | Topping |
| ING-032 | Bột trà nướng / cốt ô long nướng | G | 200 | Chỉ dùng nếu quán quản lý riêng với cốt ô long |
| ING-033 | Mứt dâu | G | 500 | Cho matcha sữa dâu |
| ING-034 | Mứt xoài | G | 500 | Cho ô long sữa tươi xoài |
| ING-035 | Nước lọc | ML | 5000 | Chỉ theo dõi nếu quy trình kho cần quản lý |
| ING-036 | Đá viên | G | 3000 | Chỉ theo dõi nếu muốn tính cả đá vào định lượng |

### Quy tắc thiết kế danh mục

- Không tạo hai nguyên liệu khác nhau chỉ vì tên gọi khác nhau nếu thực tế dùng cùng một loại hàng.
- Nếu `cốt trà` được pha theo mẻ, hãy thống nhất lưu kho theo `ML` cốt trà thành phẩm; không đồng thời trừ cả lá trà khô và cốt trà cho cùng một công đoạn.
- Với nguyên liệu đã sơ chế như trân châu, đào ngâm hoặc cốt trà, nên chọn một điểm ghi nhận tồn kho rõ ràng để tránh trừ nguyên liệu hai lần.
- Ngưỡng cảnh báo là giá trị gợi ý, cần chỉnh theo lượng bán và chu kỳ nhập hàng thực tế.

---

## 2. Công thức sản phẩm (`ProductRecipe`)

**Định lượng đề xuất cho một ly size M**, chưa bao gồm topping khách chọn thêm. Các con số chỉ để tạo dữ liệu thử nghiệm; hãy thay bằng công thức thật trước khi vận hành.

| Sản phẩm | Nguyên liệu | Mã nguyên liệu | Lượng / ly M | Đơn vị |
|---|---|---|---:|---|
| Trà Sữa Truyền Thống | Cốt trà đen đã pha | ING-001 | 150 | ML |
| Trà Sữa Truyền Thống | Sữa tươi | ING-005 | 120 | ML |
| Trà Sữa Truyền Thống | Bột kem béo | ING-006 | 20 | G |
| Trà Sữa Truyền Thống | Đường nước / syrup đường | ING-008 | 20 | ML |
| Ô Long Sữa | Cốt trà ô long đã pha | ING-002 | 180 | ML |
| Ô Long Sữa | Sữa tươi | ING-005 | 100 | ML |
| Ô Long Sữa | Bột kem béo | ING-006 | 15 | G |
| Ô Long Sữa | Đường nước / syrup đường | ING-008 | 20 | ML |
| Trà Sữa Khoai Môn | Cốt trà đen đã pha | ING-001 | 130 | ML |
| Trà Sữa Khoai Môn | Sữa tươi | ING-005 | 100 | ML |
| Trà Sữa Khoai Môn | Bột khoai môn | ING-009 | 25 | G |
| Trà Sữa Khoai Môn | Bột kem béo | ING-006 | 15 | G |
| Trà Sữa Khoai Môn | Đường nước / syrup đường | ING-008 | 15 | ML |
| Trà Sữa Oreo Phô Mai | Cốt trà đen đã pha | ING-001 | 130 | ML |
| Trà Sữa Oreo Phô Mai | Sữa tươi | ING-005 | 100 | ML |
| Trà Sữa Oreo Phô Mai | Bột kem béo | ING-006 | 15 | G |
| Trà Sữa Oreo Phô Mai | Đường nước / syrup đường | ING-008 | 15 | ML |
| Trà Sữa Oreo Phô Mai | Bánh Oreo nghiền | ING-010 | 10 | G |
| Trà Sữa Oreo Phô Mai | Kem cheese | ING-011 | 30 | G |
| Trà Sữa Trân Châu Đen | Cốt trà đen đã pha | ING-001 | 150 | ML |
| Trà Sữa Trân Châu Đen | Sữa tươi | ING-005 | 120 | ML |
| Trà Sữa Trân Châu Đen | Bột kem béo | ING-006 | 20 | G |
| Trà Sữa Trân Châu Đen | Đường nước / syrup đường | ING-008 | 20 | ML |
| Trà Sữa Trân Châu Đường Đen | Cốt trà đen đã pha | ING-001 | 140 | ML |
| Trà Sữa Trân Châu Đường Đen | Sữa tươi | ING-005 | 120 | ML |
| Trà Sữa Trân Châu Đường Đen | Bột kem béo | ING-006 | 15 | G |
| Trà Sữa Trân Châu Đường Đen | Syrup đường đen | ING-014 | 20 | ML |
| Trà Đào Cam Sả | Cốt trà đen đã pha | ING-001 | 200 | ML |
| Trà Đào Cam Sả | Đào ngâm | ING-015 | 40 | G |
| Trà Đào Cam Sả | Cam tươi | ING-016 | 30 | G |
| Trà Đào Cam Sả | Sả | ING-017 | 5 | G |
| Trà Đào Cam Sả | Đường nước / syrup đường | ING-008 | 15 | ML |
| Trà Vải | Cốt trà hoa nhài đã pha | ING-004 | 200 | ML |
| Trà Vải | Vải ngâm | ING-018 | 40 | G |
| Trà Vải | Đường nước / syrup đường | ING-008 | 15 | ML |
| Trà Chanh Dây | Cốt trà đen đã pha | ING-001 | 180 | ML |
| Trà Chanh Dây | Syrup chanh dây | ING-019 | 30 | ML |
| Trà Chanh Dây | Đường nước / syrup đường | ING-008 | 15 | ML |
| Trà Dâu Tây | Cốt trà hoa nhài đã pha | ING-004 | 180 | ML |
| Trà Dâu Tây | Dâu tây / puree dâu | ING-020 | 40 | G |
| Trà Dâu Tây | Đường nước / syrup đường | ING-008 | 15 | ML |
| Trà Xoài | Cốt trà xanh đã pha | ING-003 | 180 | ML |
| Trà Xoài | Xoài / puree xoài | ING-021 | 50 | G |
| Trà Xoài | Đường nước / syrup đường | ING-008 | 15 | ML |
| Ô Long Sữa Nhài | Cốt trà ô long đã pha | ING-002 | 140 | ML |
| Ô Long Sữa Nhài | Cốt trà hoa nhài đã pha | ING-004 | 40 | ML |
| Ô Long Sữa Nhài | Sữa tươi | ING-005 | 100 | ML |
| Ô Long Sữa Nhài | Đường nước / syrup đường | ING-008 | 15 | ML |
| Ô Long Sữa Tươi Nướng | Cốt trà ô long đã pha | ING-002 | 160 | ML |
| Ô Long Sữa Tươi Nướng | Sữa tươi | ING-005 | 120 | ML |
| Ô Long Sữa Tươi Nướng | Bột kem béo | ING-006 | 10 | G |
| Ô Long Sữa Tươi Xoài | Cốt trà ô long đã pha | ING-002 | 150 | ML |
| Ô Long Sữa Tươi Xoài | Sữa tươi | ING-005 | 100 | ML |
| Ô Long Sữa Tươi Xoài | Mứt xoài | ING-034 | 35 | G |
| Ô Long Sữa Tươi Xoài | Đường nước / syrup đường | ING-008 | 10 | ML |
| Matcha Latte | Sữa tươi | ING-005 | 220 | ML |
| Matcha Latte | Bột matcha | ING-022 | 4 | G |
| Matcha Latte | Đường nước / syrup đường | ING-008 | 15 | ML |
| Matcha Sữa Dâu | Sữa tươi | ING-005 | 200 | ML |
| Matcha Sữa Dâu | Bột matcha | ING-022 | 4 | G |
| Matcha Sữa Dâu | Mứt dâu | ING-033 | 35 | G |
| Matcha Đậu Đỏ | Sữa tươi | ING-005 | 200 | ML |
| Matcha Đậu Đỏ | Bột matcha | ING-022 | 4 | G |
| Matcha Đậu Đỏ | Đậu đỏ đã nấu | ING-023 | 40 | G |
| Cà Phê Sữa | Cà phê espresso/phin đã pha | ING-024 | 50 | ML |
| Cà Phê Sữa | Sữa đặc | ING-007 | 35 | G |
| Cà Phê Sữa | Nước lọc | ING-035 | 30 | ML |
| Bạc Xỉu | Cà phê espresso/phin đã pha | ING-024 | 30 | ML |
| Bạc Xỉu | Sữa tươi | ING-005 | 150 | ML |
| Bạc Xỉu | Sữa đặc | ING-007 | 25 | G |
| Cà Phê Muối | Cà phê espresso/phin đã pha | ING-024 | 50 | ML |
| Cà Phê Muối | Sữa đặc | ING-007 | 20 | G |
| Cà Phê Muối | Kem nền / whipping cream | ING-026 | 30 | ML |
| Cà Phê Muối | Muối | ING-025 | 1 | G |

### Ghi chú về công thức

- Công thức ở trên chưa tính đá và topping chọn thêm. Nếu đá được quản lý tồn kho, hãy bổ sung định lượng đá cho từng món hoặc quy định riêng theo size.
- Những món có thành phần chưa được thể hiện đầy đủ trong mô tả sản phẩm cần được chủ quán xác nhận.
- Nếu một món thực tế sử dụng syrup, puree, bột pha sẵn hoặc cốt trà khác, hãy thay nguyên liệu tương ứng; không nên dùng danh sách mẫu này như công thức pha chế chính thức.
- `quantity` trong `ProductRecipe` là lượng nguyên liệu cho **một ly size M**, không phải lượng cho cả mẻ.

---

## 3. Công thức topping (`ToppingRecipe`)

Các topping có trong seed hiện tại. Đây là định lượng mẫu cho **một phần topping**.

| Topping trong seed | Nguyên liệu | Mã nguyên liệu | Lượng / phần | Đơn vị |
|---|---|---|---:|---|
| Trân châu đen | Trân châu đen đã nấu | ING-012 | 40 | G |
| Trân châu đường đen | Trân châu đường đen đã nấu | ING-013 | 40 | G |
| Trân châu đường đen | Syrup đường đen | ING-014 | 10 | ML |
| Thạch củ năng | Thạch củ năng đã chuẩn bị | ING-027 | 40 | G |
| Thạch đen | Thạch đen đã chuẩn bị | ING-028 | 40 | G |
| Trân châu popping vị trái cây | Trân châu popping | ING-029 | 40 | G |
| Đậu đỏ | Đậu đỏ đã nấu | ING-023 | 40 | G |
| Oreo nghiền | Bánh Oreo nghiền | ING-010 | 15 | G |
| Kem cheese | Kem cheese | ING-011 | 30 | G |
| Thạch dừa | Thạch dừa | ING-030 | 40 | G |
| Pudding trứng | Pudding trứng | ING-031 | 40 | G |

**Lưu ý:** Tên topping và tên nguyên liệu không nhất thiết giống nhau. Ví dụ topping “Kem cheese” có thể dùng nguyên liệu thành phẩm “Kem cheese”. Nếu quán sản xuất kem cheese từ nhiều nguyên liệu thô, cần quyết định quản lý kho theo nguyên liệu thô hay theo thành phẩm để tránh trừ kho hai lần.

---

## 4. Ánh xạ các topping theo `toppingId`

Trong seed hiện tại, topping được tạo theo thứ tự sau. Không nên dựa vào ID tự tăng cố định trong database; khi seed, hãy tra lại topping bằng `name` hoặc dùng một mã định danh ổn định.

| Tên topping | Mã nguyên liệu tham chiếu |
|---|---|
| Trân châu đen | ING-012 |
| Trân châu đường đen | ING-013, ING-014 |
| Thạch củ năng | ING-027 |
| Thạch đen | ING-028 |
| Trân châu popping vị trái cây | ING-029 |
| Đậu đỏ | ING-023 |
| Oreo nghiền | ING-010 |
| Kem cheese | ING-011 |
| Thạch dừa | ING-030 |
| Pudding trứng | ING-031 |

---

## 5. Quy tắc tính kho

### 5.1. Một dòng sản phẩm

Với từng nguyên liệu trong công thức:

`Lượng cần = ceil(lượng công thức size M × hệ số size) × số ly`

Theo quy tắc đã nêu, làm tròn lên sau khi nhân hệ số size và trước khi nhân số ly.

### 5.2. Topping

`Lượng topping cần = lượng nguyên liệu mỗi phần × số phần topping`

Nếu một khách chọn 2 phần trân châu đen, với định lượng mẫu 40 g/phần, hệ thống cần 80 g trân châu đen.

### 5.3. Toàn đơn

Cộng tất cả lượng cần theo `ingredientId` trước khi kiểm tra tồn kho. Không kiểm tra độc lập từng dòng sản phẩm rồi mới trừ kho.

### 5.4. Số ly có thể bán

Với từng nguyên liệu cần cho một món:

`Số ly theo nguyên liệu = floor(stock / lượng nguyên liệu cần cho một ly)`

`Số ly tối đa = min(số ly theo từng nguyên liệu)`

Nếu sản phẩm không có công thức hợp lệ, đánh dấu không thể bán (`inStock = false`), không mặc định lượng tiêu hao bằng 0.

---

## 6. Checklist trước khi seed vào database

- [ ] Xác nhận đơn vị đo và cách quản lý nguyên liệu sơ chế.
- [ ] Xác nhận định lượng thực tế cho từng món size M.
- [ ] Xác nhận định lượng từng topping.
- [ ] Quyết định có quản lý đá và nước lọc trong kho hay không.
- [ ] Tạo `Ingredient` bằng `upsert` theo tên hoặc mã ổn định.
- [ ] Tạo `ProductRecipe` bằng khóa duy nhất `(productId, ingredientId)`.
- [ ] Tạo `ToppingRecipe` bằng khóa duy nhất `(toppingId, ingredientId)`.
- [ ] Seed tồn kho ban đầu kèm `StockMovement` loại mở đầu kho nếu áp dụng.
- [ ] Kiểm tra tất cả 20 sản phẩm và 10 topping đều có công thức hợp lệ.
- [ ] Chạy test tính nguyên liệu, gộp nhu cầu, rollback, hủy đơn và đặt hàng đồng thời.

---

## 7. Danh sách sản phẩm được bao phủ

Tài liệu này bao phủ 20 sản phẩm trong seed:

1. Trà Sữa Truyền Thống
2. Ô Long Sữa
3. Trà Sữa Khoai Môn
4. Trà Sữa Oreo Phô Mai
5. Trà Sữa Trân Châu Đen
6. Trà Sữa Trân Châu Đường Đen
7. Trà Đào Cam Sả
8. Trà Vải
9. Trà Chanh Dây
10. Trà Dâu Tây
11. Trà Xoài
12. Ô Long Sữa Nhài
13. Ô Long Sữa Tươi Nướng
14. Ô Long Sữa Tươi Xoài
15. Matcha Latte
16. Matcha Sữa Dâu
17. Matcha Đậu Đỏ
18. Cà Phê Sữa
19. Bạc Xỉu
20. Cà Phê Muối

**Trạng thái:** Đây là bản đặc tả dữ liệu mẫu để thống nhất cấu trúc và quan hệ giữa nguyên liệu, sản phẩm, topping. Cần xác nhận định lượng với công thức thực tế trước khi sử dụng để trừ kho trong môi trường vận hành.
