# 📌 Phân Công Nhiệm Vụ BrewLite (Hạn nộp 30/10) – cập nhật 26/10

**Mục tiêu chung:** BrewLite là app đặt cà phê không dùng tiền mặt. Khách xem menu, chọn size và topping, bỏ vào giỏ, đăng nhập, thanh toán rồi nhận mã đơn. Cả nhóm phải chạy được trọn luồng này từ đầu đến cuối trước ngày nộp **30/10**.

- **Backend (NestJS)** làm các API. **Frontend (Next.js)** làm giao diện và gọi các API đó.
- Hai bên nói chuyện với nhau qua tài liệu API (`docs/api.md`, bản v1.2). Muốn đổi tên trường hay mã lỗi thì sửa file này trong cùng PR và báo cho bên kia.
- Tiền luôn là **số nguyên VND** (ví dụ 45000). Giá do **server tính**, Frontend chỉ hiển thị.

*Mọi người nhớ chạy `git pull origin develop` để kéo code mới nhất về máy trước khi code tiếp nha!*

---

## 1. Tình trạng backend ngày 26/10 (đối chiếu với đề, Mục 8, 9, 12)

| Hạng mục | Task | Trạng thái |
|---|---|---|
| `GET /products`, `GET /products/:id`, `/toppings` | 2, 4 | ✅ Xong |
| `POST /auth/register`, `/auth/login`, JWT guard | 7 | ✅ Xong |
| `POST /payments` idempotent | 8, 10 | ✅ Có trong `payments.service.ts` (còn thiếu test (b)) |
| `POST /orders` | 6 | ⚠️ Có module, nhưng **đang lấy giá từ client** và **chưa kiểm tra tồn kho** |
| `GET /orders/me`, `GET /orders/:id` | 9 | ❌ Thiếu |
| State machine + `assertTransition` | 10 | ❌ Thiếu |
| Optimistic locking tồn kho (`Product.version`) | 10 | ❌ Thiếu |
| Test (a) trạng thái, (b) idempotent, (c) đặt đồng thời | 10 | ❌ Thiếu (mới có unit test của payments, auth, products) |

Phần ❌ và ⚠️ là phần **ăn điểm**, làm **trước tiên**. Trang Barista (mục 5) chỉ làm khi những dòng này đã xong.

---

## 2. Ai làm gì

| Mã | Phụ trách chính (điền tên thành viên vào bên cạnh mã) |
|---|---|
| **BE1** | Trưởng nhóm BE: `GET /orders/me`, `/orders/:id`, Docker, README, test luồng chính |
| **BE2** | Mã giảm giá, điểm thưởng, test đặt đồng thời (c) |
| **BE3** | State machine, `POST /orders` (tính lại giá, giữ tồn kho), hủy đơn |
| **BE4** | `POST /payments`, test idempotent (b), nối thanh toán với state machine |
| **FE1** | Trưởng nhóm FE: khung giao diện, Menu, đăng nhập/đăng ký |
| **FE2** | Chi tiết sản phẩm, giỏ hàng, lịch sử đơn, nhập mã giảm giá |
| **FE3** | Trang thanh toán, trang xác nhận đơn |

**Cách làm:** ngày trong ngoặc là hạn xong. Ai xong sớm thì báo trong Daily Scrum để giúp người khác. Trong lúc API chưa xong, Frontend dùng dữ liệu giả theo tài liệu API để làm giao diện trước, đừng chờ Backend.

---

## 3. Nhóm Backend (4 người): việc còn lại từ 26/10

### 1. BE1 (Trưởng nhóm BE, kiêm DevOps)

- **`GET /orders/me`** (JWT, chỉ đơn của mình, mới nhất trước, `{data, meta}`, `limit` mặc định 10) và **`GET /orders/:id`** (kèm `items`, `payments`, `pointsEarned`; 404 `ORDER_NOT_FOUND`; 403 `FORBIDDEN` nếu đơn của người khác). Khai báo route `me` **trước** `:id`. **(26/10)**
- Viết Dockerfile cho backend và frontend, đưa vào `docker-compose.yml` để một lệnh chạy cả 3 phần (frontend, backend, DB). **(27/10)**
- Viết README bàn giao, thử `docker compose up` từ máy sạch. **(28/10)**
- Test luồng chính từ đầu đến cuối (đăng nhập → đặt → thanh toán → xem đơn) với DB test riêng, chuẩn bị kịch bản demo. Chốt đóng băng tính năng chiều 28/10. **(29/10)**
- Review chéo PR của BE3.

### 2. BE2 (Khuyến mãi, điểm thưởng, test tồn kho)

- `POST /promotions/validate`: mã còn hạn, đủ giá trị tối thiểu, còn lượt dùng, tính số tiền giảm. **(26/10)**
- `LoyaltyService.award(tx, order)`: cộng 1 điểm cho mỗi 1.000đ, ghi `LoyaltyTransaction`, mỗi đơn chỉ cộng một lần. BE4 gọi khi đơn sang PAID. **(27/10)**
- Áp mã giảm giá trong `POST /orders` và tăng `usedCount` trong cùng transaction (làm sau khi BE3 merge `POST /orders`). **(27/10)**
- **Test (c) đặt đồng thời:** Cà phê muối còn 5 ly, bắn 10 đơn song song bằng `Promise.all`, kỳ vọng đúng 5 thành công, 5 `OUT_OF_STOCK`, stock cuối bằng 0. Thêm test giỏ 2 sản phẩm, sản phẩm thứ hai hết hàng thì không đơn nào được tạo. **(28/10)**

### 3. BE3 (Đơn hàng, trạng thái, tồn kho)

- **State machine:** bảng `TRANSITIONS` và hàm `assertTransition(from, to)` ném 409 `INVALID_TRANSITION` (theo mục 5 của API). **Test (a)**: `PENDING → COMPLETED`, `PENDING → READY`, `COMPLETED → PAID`, `CANCELLED → PENDING` đều bị chặn; luồng hợp lệ và `PAYMENT_FAILED → PAID` qua được. Làm **đầu tiên** vì BE4 và BE2 cần dùng. **(26/10)**
- **`POST /orders` sửa lại:** bỏ giá do client gửi (client chỉ gửi `productId`, `size`, `toppingIds`, `quantity`); dùng `PricingService.calculate()` để tính lại giá; lưu snapshot (`productName`, `unitPrice`, `lineTotal`) trong `OrderItem`. **(27/10)**
- **Giữ tồn kho + optimistic locking:** viết hàm `reserveStock(tx, items)` theo mục 4.2 của API: trừ bằng `updateMany` với điều kiện `version` và `stock >= qty`; sắp xếp theo `productId`; thử lại tối đa 10 lần, nghỉ ngẫu nhiên 10–50 ms; hết hàng thật thì `OUT_OF_STOCK`; một sản phẩm lỗi thì rollback cả đơn. **(27/10)**
- `POST /orders/:id/cancel`: tách hàm `cancelOrder` (hoàn kho, hoàn usedCount, hoàn tiền giả lập, thu hồi điểm) để sau này tác vụ tự hủy dùng lại. **(28/10)**
- Review chéo PR của BE1.

### 4. BE4 (Thanh toán)

- **Nối `payments.service.ts` với state machine:** mọi lần đổi trạng thái (PAID / PAYMENT_FAILED) phải qua `assertTransition`, rồi gọi `LoyaltyService.award`. **(27/10)**
- **Test (b):** gửi 2 lần cùng `Idempotency-Key` thì chỉ có **1 bản ghi `Payment`**, lần 2 trả lại đúng kết quả cũ kèm header `Idempotent-Replayed: true`, điểm thưởng chỉ cộng một lần. Thêm test gửi song song 5 request cùng key (cổng giả chỉ được gọi 1 lần), và cùng key nhưng khác nội dung thì 422 `IDEMPOTENCY_KEY_REUSED`. **(28/10)**
- Review chéo PR của BE2.

---

## 4. Nhóm Frontend (3 người)

### 5. FE1 (Trưởng nhóm FE)

- Kiểm tra Menu, đăng nhập/đăng ký chạy với API thật; nhận 401 thì chuyển về trang đăng nhập. **(26/10)**
- Thanh điều hướng (header), trạng thái đang tải / lỗi dùng chung cho toàn app, dùng được trên điện thoại. **(28/10)**

### 6. FE2 (Chi tiết sản phẩm, giỏ hàng, lịch sử)

- Giỏ hàng (Zustand, lưu `localStorage`) và trang giỏ. **(26/10)**
- Trang lịch sử đơn: gọi `GET /orders/me` (BE1 xong 26/10). **(27/10)**
- Ô nhập mã giảm giá (gọi `POST /promotions/validate`, báo lỗi rõ khi mã sai hoặc hết hạn) và hiển thị điểm thưởng. **(28/10)**

### 7. FE3 (Thanh toán và xác nhận đơn)

- Nối trang thanh toán với `POST /orders` thật. Hiển thị lỗi `OUT_OF_STOCK` (tên món, còn bao nhiêu). **(27/10)**
- Nối `POST /payments`: sinh `Idempotency-Key` bằng `crypto.randomUUID()` **một lần cho mỗi lần bấm xác nhận**, giữ nguyên nếu gửi lại. Lỗi 402 thì báo lỗi, **giữ nguyên giỏ hàng**, cho thử lại với key mới. Thành công thì xóa giỏ. **(27/10)**
- Trang xác nhận đơn: mã đơn, trạng thái, dòng "Mời tới quầy lấy nước", dữ liệu từ `GET /orders/:id` (BE1). **(28/10)**

---

## 5. Phần mở rộng (tùy chọn): trang Barista

Đề ghi chức năng nhân viên quầy **ngoài MVP**, không tính điểm. Làm **chỉ khi** các mục ❌ và ⚠️ ở mục 1 đã được merge.

**Quyết định vào tối 27/10:** nếu `POST /orders`, `GET /orders/me`, state machine và test (a), (b), (c) chưa xong thì **bỏ** phần này, demo đổi trạng thái bằng Swagger.

### Logic nghiệp vụ

- **Đổi trạng thái đơn do barista làm**, còn khách chỉ xem. Đường đi: `PAID → PREPARING → READY → COMPLETED`.
- **Trừ kho luôn do server làm** khi khách đặt đơn. Barista **không** trừ kho bằng tay.
- **Nhập kho do barista làm**, cộng dồn (không ghi đè), tăng `version` để đơn đang đặt song song đọc lại số mới.
- Barista được **hủy đơn khi còn PAID** (chưa pha). Đơn đã PREPARING thì không hủy được.

### Việc cần làm

| Ai | Việc | Hạn |
|---|---|---|
| BE1 | `GET /orders` (B): hàng đợi đơn của mọi khách, lọc `status`, mặc định `PAID,PREPARING,READY`, cũ nhất lên đầu, kèm `items` và `customerName`; gắn `@Roles('BARISTA')` | 27/10 |
| BE2 | `POST /products/:id/stock` (B): cộng dồn, `quantity` 1–1000; tùy chọn bảng `StockMovement` và `GET /products/:id/stock-movements` | 27/10 |
| FE1 | Trang `/barista` (đăng nhập bằng tài khoản barista, kiểm tra `role`): 3 cột Mới / Đang pha / Sẵn sàng, nút chuyển bước, tự làm mới mỗi 10 giây | 28/10 |
| FE2 | Trang `/barista/kho`: bảng tồn kho, ô "Nhập thêm", cảnh báo màu khi `stock` ≤ 3 | 28/10 |

### Quy trình của barista (một ca làm việc)

1. **Đăng nhập** bằng tài khoản barista (`barista@brewlite.com`). Hệ thống đưa vào trang `/barista`. Khách đăng nhập thì không vào được (403).
2. **Xem hàng đợi.** Trang tự làm mới, đơn mới đã thanh toán (PAID) hiện ở cột "Mới", đơn cũ nhất lên đầu. Mỗi đơn cho thấy mã đơn, món, size, topping, ghi chú, tên khách.
3. **Nhận đơn:** bấm "Nhận đơn" (PAID → PREPARING). Đơn chuyển sang cột "Đang pha", khách thấy trạng thái đổi trong lịch sử đơn.
4. **Pha xong:** bấm "Pha xong" (PREPARING → READY). Đơn sang cột "Sẵn sàng", chờ khách tới quầy.
5. **Giao khách:** khách đọc mã đơn, barista đối chiếu rồi bấm "Giao khách" (READY → COMPLETED). Đơn rời hàng đợi.
6. **Hủy đơn (hiếm):** chỉ khi đơn còn PAID, ví dụ hết nguyên liệu. Hệ thống hoàn tiền giả lập, hoàn kho và thu hồi điểm thưởng. Đơn đã pha thì không hủy được.
7. **Quản lý kho:** đầu ca hoặc khi có cảnh báo sắp hết, vào `/barista/kho`, chọn sản phẩm, nhập số lượng hàng mới. Số tồn tăng ngay, khách đặt được tiếp.
8. **Cuối ca:** kiểm tra cột "Mới", "Đang pha", "Sẵn sàng" đã trống, không còn đơn bỏ dở.

**Barista không được:** sửa giá, trừ kho bằng tay, nhảy bước (ví dụ PAID thẳng COMPLETED, hệ thống sẽ trả 409 `INVALID_TRANSITION`).

---

## ⚙️ Yêu cầu tiêu chuẩn (SOP) cho cả nhóm

- **Chuẩn hóa API:** mọi endpoint bám tài liệu API. Lỗi luôn trả đúng dạng chuẩn (`statusCode`, `code`, `message`) để Frontend dựa vào `code` mà xử lý. Dữ liệu gửi thiếu hoặc thừa phải bị chặn (validate).
- **Kiểm thử bảo mật** (Swagger tại `localhost:4000/api/docs` hoặc Thunder Client): code xong API nào phải tự test kỹ API đó.
  - Không gắn header `Authorization` ➡️ phải bị chặn và báo lỗi 401.
  - Có gắn header `Authorization` kèm token ➡️ phải cho qua và xử lý thành công.
  - Endpoint của barista: dùng token khách ➡️ phải 403.
- **Frontend:** mỗi màn hình có trạng thái đang tải và thông báo lỗi cơ bản. Không tự tính giá làm số chính thức: số đúng là số server trả về.
- **Quy trình Git:** không code trực tiếp lên nhánh chính. Mỗi người tự tạo nhánh mới (ví dụ `feature/be3-orders`, `feature/fe2-cart`), đẩy lên GitHub và mở Pull Request để người khác review trước khi gộp. Review chéo: BE1↔BE3, BE2↔BE4, FE1↔FE2, FE3 nhờ FE1.
- **Commit và PR:** mô tả rõ đã làm gì. Task coi là xong khi chạy được, không lỗi build, có validate, đã được review và có hướng dẫn trong README.
- **Daily Scrum 15 phút mỗi ngày:** hôm qua làm gì, hôm nay làm gì, có bị kẹt ở đâu không. Cuối ngày cập nhật trạng thái trong `BrewLite_Sprint_Backlog.xlsx` và biểu đồ burndown.

---

## Thời hạn hoàn thành

| Mốc | Việc |
|---|---|
| **26/10** | State machine (BE3), `GET /orders/me` và `/orders/:id` (BE1), `promotions/validate` (BE2), giỏ hàng (FE2) |
| **27/10** | `POST /orders` tính lại giá + giữ kho (BE3), Docker (BE1), nối thanh toán (BE4, FE3), loyalty (BE2). **Tối 27/10: quyết định có làm trang Barista không** |
| **28/10** | Test (b), (c), hủy đơn, README, trang xác nhận, lịch sử, mã giảm giá. **Đóng băng tính năng chiều 28/10** |
| **29/10** | Chỉ sửa lỗi, test end-to-end, tập demo |
| **30/10** | Cả nhóm demo trọn luồng, bàn giao mã nguồn, họp Retrospective, nộp bài |

Mọi người cố gắng hoàn thành càng sớm càng tốt nha! Ai bị kẹt thì nói ngay trong Daily Scrum, đừng đợi đến cuối Sprint.