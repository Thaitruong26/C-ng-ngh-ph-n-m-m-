# BrewLite — Tài liệu đặc tả chức năng giao diện Barista (KDS & Quản lý Kho)

> **Mục đích:** Tài liệu hướng dẫn chi tiết dành cho lập trình viên/thiết kế Frontend để xây dựng giao diện phân hệ **Barista** của BrewLite (bao gồm hàng đợi pha chế, quản lý kho nguyên liệu và quản lý công thức đồ uống).

---

## 1. Xác thực & Phân quyền

- **Role yêu cầu:** `BARISTA` (tài khoản demo: `barista@brewlite.com` / `Barista@123`).
- **Cơ chế:** Gửi Header `Authorization: Bearer <accessToken>` trong mọi request.
- **Xử lý lỗi phân quyền:**
  - `401 Unauthorized`: Token hết hạn hoặc chưa đăng nhập $\rightarrow$ Điều hướng về trang `/login`.
  - `403 Forbidden`: Tài khoản là `CUSTOMER`, không có quyền $\rightarrow$ Hiển thị màn hình chặn quyền truy cập.

---

## 2. Nhóm chức năng 1: Hàng đợi pha chế (Order Queue / KDS)

Dành cho nhân viên tại quầy theo dõi đơn hàng cần pha chế theo thời gian thực.

### 2.1. Lấy danh sách hàng đợi
- **Endpoint:** `GET /api/orders`
- **Query params:**
  - `status`: Mặc định lấy `PAID,PREPARING,READY`. Có thể lọc từng trạng thái.
  - `page`: Trang hiện tại (mặc định: `1`).
  - `limit`: Số đơn mỗi trang (mặc định: `20` hoặc `50`).
- **Sắp xếp:** `createdAt` tăng dần (đơn đặt trước hiển thị trước để pha chế theo thứ tự).
- **Cấu trúc dữ liệu trả về:**
```json
{
  "data": [
    {
      "id": 101,
      "code": "#101",
      "status": "PAID",
      "total": 85000,
      "customerName": "Khách Demo",
      "createdAt": "2026-10-29T08:30:00.000Z",
      "items": [
        {
          "productName": "Cà phê muối",
          "size": "M",
          "qty": 2,
          "toppings": [{ "name": "Trân châu đen", "price": 5000 }],
          "note": "Ít ngọt, nhiều đá"
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### 2.2. Chuyển bước đơn hàng (State Machine)
- **Endpoint:** `PATCH /api/orders/:id/status`
- **Body:** `{ "status": "PREPARING" | "READY" | "COMPLETED" }`
- **Luồng trạng thái hợp lệ:**
  - `PAID` $\rightarrow$ Bấm **"Bắt đầu pha"** $\rightarrow$ chuyển sang `PREPARING`.
  - `PREPARING` $\rightarrow$ Bấm **"Pha xong / Báo lấy món"** $\rightarrow$ chuyển sang `READY`.
  - `READY` $\rightarrow$ Bấm **"Đã giao khách"** $\rightarrow$ chuyển sang `COMPLETED` (đơn hoàn tất, rời khỏi hàng đợi).

### 2.3. Hủy đơn tại quầy
- **Endpoint:** `POST /api/orders/:id/cancel`
- **Điều kiện:** Chỉ được hủy khi đơn ở trạng thái `PENDING` hoặc `PAID` (chưa bấm sang `PREPARING`).
- **Tác động:** Hệ thống tự động hoàn kho nguyên liệu theo snapshot tiêu hao lúc đặt, hoàn tiền mock và thu hồi điểm tích lũy.

---

## 3. Nhóm chức năng 2: Quản lý Kho nguyên liệu (Inventory Management)

Thay thế cách quản lý theo số ly cũ bằng quản lý kho theo định lượng thực tế (`G`, `ML`, `PCS`).

### 3.1. Danh sách nguyên liệu & Cảnh báo sắp hết
- **Endpoint:** `GET /api/ingredients`
- **Query params:**
  - `search`: Từ khóa tìm kiếm theo tên (ví dụ: `sữa`, `trà`).
  - `low`: `true` $\rightarrow$ Chỉ lọc các nguyên liệu sắp hết (`stock <= lowThreshold`).
  - `page`: Trang hiện tại (mặc định: `1`).
  - `limit`: Số dòng mỗi trang (mặc định: `20`, tối đa: `50`).
- **Cấu trúc dữ liệu:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Muối",
      "unit": "G",
      "stock": 5,
      "lowThreshold": 100,
      "low": true
    },
    {
      "id": 2,
      "name": "Sữa tươi",
      "unit": "ML",
      "stock": 18000,
      "lowThreshold": 3000,
      "low": false
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 34, "totalPages": 2 }
}
```
- **Hiển thị trên UI:**
  - Badge cảnh báo màu đỏ/cam khi `low === true`.
  - Hiển thị rõ số lượng kèm đơn vị đo (`G`, `ML`, `PCS`).

### 3.2. Tạo mới nguyên liệu
- **Endpoint:** `POST /api/ingredients`
- **Body:**
```json
{
  "name": "Bột quế",
  "unit": "G",
  "stock": 2000,
  "lowThreshold": 300
}
```
- **Lỗi có thể xảy ra:**
  - `400 VALIDATION_ERROR`: Sai định dạng hoặc thiếu trường bắt buộc.
  - `409 INGREDIENT_ALREADY_EXISTS`: Tên nguyên liệu đã tồn tại.

### 3.3. Cập nhật thông tin nguyên liệu
- **Endpoint:** `PATCH /api/ingredients/:id`
- **Body:** `{ "name": "Bột quế Ceylon", "lowThreshold": 400 }` (không sửa `stock` hay `unit` ở đây).

### 3.4. Nhập thêm hàng vào kho (Restock)
- Dành cho khi quán nhập hàng buổi sáng hoặc bổ sung nguyên liệu trong ngày.
- **Endpoint:** `POST /api/ingredients/:id/stock`
- **Body:**
```json
{
  "quantity": 5000,
  "note": "Nhập 5 lít sữa từ kho tổng"
}
```
- **Response 200:** Trả về thông tin nguyên liệu với tồn kho đã được cộng dồn và cập nhật trạng thái `low`.

### 3.5. Kiểm kê & Ghi nhận hao hụt (Stock Adjustment)
- Dành cho cuối ca kiểm kê hoặc khi barista làm đổ vỡ, hư hỏng nguyên liệu.
- **Endpoint:** `POST /api/ingredients/:id/adjust`
- **Body:**
```json
{
  "actualStock": 1750,
  "reason": "Làm đổ 50ml khi pha chế ca sáng"
}
```
- **Quy tắc:**
  - Barista nhập **số lượng thực tế đếm được** (`actualStock >= 0`).
  - Bắt buộc nhập lý do (`reason` từ 3 - 200 ký tự).
- **Response 200:**
```json
{
  "id": 2,
  "stock": 1750,
  "diff": -50
}
```
*(Nếu `diff < 0` là hao hụt/mất mát; nếu `diff > 0` là kiểm kê dôi dư; nếu `diff = 0` là khớp).*

### 3.6. Nhật ký biến động kho (Stock Movements History)
- Xem lịch sử xuất/nhập/hao hụt của một nguyên liệu.
- **Endpoint:** `GET /api/ingredients/:id/movements?page=1&limit=20`
- **Cấu trúc dữ liệu:**
```json
{
  "data": [
    {
      "id": 88,
      "type": "ORDER_RESERVE",
      "quantity": -240,
      "orderId": 101,
      "userId": null,
      "reason": null,
      "createdAt": "2026-10-29T08:30:00.000Z"
    },
    {
      "id": 87,
      "type": "RESTOCK",
      "quantity": 5000,
      "orderId": null,
      "userId": 2,
      "reason": "Nhập hàng sáng",
      "createdAt": "2026-10-29T07:00:00.000Z"
    },
    {
      "id": 86,
      "type": "ADJUST",
      "quantity": -50,
      "orderId": null,
      "userId": 2,
      "reason": "Đổ vỡ khi pha",
      "createdAt": "2026-10-29T06:55:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```
- **Ý nghĩa `type`:**
  - `ORDER_RESERVE`: Trừ kho khi khách tạo đơn hàng (số lượng âm).
  - `ORDER_RELEASE`: Hoàn kho khi đơn hàng bị hủy (số lượng dương).
  - `RESTOCK`: Nhập thêm hàng (số lượng dương).
  - `ADJUST`: Điều chỉnh kiểm kê hoặc ghi nhận hao hụt.

---

## 4. Nhóm chức năng 3: Quản lý Công thức pha chế (Recipes)

### 4.1. Công thức sản phẩm (`Product Recipe`)
Định lượng được cấu hình chuẩn cho **size M** (size S tự động nhân 0.8, size L nhân 1.3 và làm tròn lên).

- **Xem công thức:** `GET /api/products/:id/recipe`
  - Response:
    ```json
    {
      "productId": 3,
      "items": [
        { "ingredientId": 24, "name": "Cà phê espresso/phin đã pha", "unit": "ML", "quantity": 50 },
        { "ingredientId": 7, "name": "Sữa đặc", "unit": "G", "quantity": 20 },
        { "ingredientId": 26, "name": "Kem nền / whipping cream", "unit": "ML", "quantity": 30 },
        { "ingredientId": 25, "name": "Muối", "unit": "G", "quantity": 1 }
      ]
    }
    ```
- **Cập nhật công thức:** `PUT /api/products/:id/recipe`
  - Body:
    ```json
    {
      "items": [
        { "ingredientId": 24, "quantity": 50 },
        { "ingredientId": 7, "quantity": 20 },
        { "ingredientId": 26, "quantity": 30 },
        { "ingredientId": 25, "quantity": 1 }
      ]
    }
    ```
  - *Lưu ý:* Gửi `items: []` nghĩa là xóa trắng công thức $\rightarrow$ món sẽ thành hết hàng (`inStock = false`, `stock = 0`).

### 4.2. Công thức Topping (`Topping Recipe`)
Định lượng cho **1 phần topping**.

- **Xem công thức topping:** `GET /api/toppings/:id/recipe`
- **Cập nhật công thức topping:** `PUT /api/toppings/:id/recipe`
  - Body:
    ```json
    {
      "items": [
        { "ingredientId": 13, "quantity": 40 },
        { "ingredientId": 14, "quantity": 10 }
      ]
    }
    ```

---

## 5. Nhóm chức năng 4: Tình trạng Menu sản phẩm (Product Availability)

- **Endpoint:** `GET /api/products/:id` (Công khai)
- **Dữ liệu trả về để Barista / Khách xem trạng thái món:**
```json
{
  "id": 20,
  "name": "Cà phê muối",
  "price": 42000,
  "stock": 5,
  "inStock": true,
  "limitedBy": "Muối",
  "sizes": [
    { "size": "S", "code": "S", "surcharge": 0, "maxCups": 6 },
    { "size": "M", "code": "M", "surcharge": 5000, "maxCups": 5 },
    { "size": "L", "code": "L", "surcharge": 10000, "maxCups": 3 }
  ],
  "toppings": [
    { "id": 1, "name": "Trân châu đen", "price": 5000, "available": true },
    { "id": 8, "name": "Kem cheese", "price": 10000, "available": false }
  ]
}
```
- **Ý nghĩa:**
  - `stock`: Số ly tối đa có thể pha chế ở size S.
  - `limitedBy`: Tên nguyên liệu đang bị thắt cổ chai khiến món bị giới hạn số lượng (ví dụ: `"Muối"`).
  - `maxCups`: Số ly tối đa có thể làm riêng cho từng size S, M, L.
  - `available`: Topping có đủ nguyên liệu để bán cho ít nhất 1 phần hay không.

---

## 6. Gợi ý cấu trúc điều hướng & Bố cục giao diện Barista

Để thuận tiện thao tác trên máy tính bảng hoặc máy POS tại quầy, giao diện `/barista` nên chia thành 3 Tab chính:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☕ BrewLite POS - Barista Panel                 [Ca sáng] ⏰ 09:15:30 [Đăng xuất]│
├─────────────────────────────────────────────────────────────────────────────┤
│  [📋 1. HÀNG ĐỢI PHA CHẾ (KDS)]  [📦 2. KHO NGUYÊN LIỆU]  [📖 3. CÔNG THỨC]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tab 1: Hàng đợi pha chế (KDS)                                              │
│  - Chia 3 cột: ĐÃ THANH TOÁN (PAID) | ĐANG PHA (PREPARING) | CHỜ GIAO (READY)│
│  - Thẻ đơn hiển thị: Mã đơn, Khách hàng, Giờ đặt, Timer đếm phút,          │
│    danh sách món + size + topping + ghi chú.                                │
│  - Action buttons: [Bắt đầu pha] -> [Xong món] -> [Đã giao khách]           │
│                                                                             │
│  Tab 2: Kho nguyên liệu                                                     │
│  - Bộ lọc: Ô tìm kiếm, Switch [Chỉ hiện sắp hết ⚠️]                         │
│  - Nút: [+ Thêm nguyên liệu]                                                │
│  - Bảng: Tên | Đơn vị | Tồn kho | Ngưỡng cảnh báo | Trạng thái | Thao tác  │
│  - Action buttons trên mỗi dòng:                                            │
│    + [📥 Nhập hàng] -> Mở modal nhập quantity + note                         │
│    + [⚖️ Kiểm kê / Báo hao hụt] -> Mở modal actualStock + reason            │
│    + [📜 Lịch sử] -> Mở Drawer xem danh sách biến động                      │
│                                                                             │
│  Tab 3: Công thức pha chế                                                   │
│  - Danh sách 20 món & 10 topping                                            │
│  - Khi chọn 1 món: hiển thị bảng định lượng size M                          │
│  - Cho phép thêm/xóa nguyên liệu, chỉnh sửa định lượng và bấm [Lưu công thức]│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
