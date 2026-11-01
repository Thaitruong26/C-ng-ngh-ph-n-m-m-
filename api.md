# BrewLite: Thiết kế API chi tiết (v1.2)

Tài liệu thiết kế API cho nhóm, bám theo đề bài BrewLite (NestJS + Next.js + PostgreSQL/Prisma). File này đặt tại `docs/api.md` trong repo. Bản v1.2 thêm phần **Barista** (xem hàng đợi đơn, đổi trạng thái, nhập kho) đánh dấu **(B)**. Phần Barista nằm ngoài 10 task của đề nên chỉ làm sau khi xong phần bắt buộc.

## 1. Phạm vi và nguyên tắc thiết kế

**Kiến trúc phân lớp** (giống mẫu Dapper Lab, thay công nghệ theo đề):

Client (Next.js / Swagger) → Controller (HTTP) → Service (nghiệp vụ) → Repository/Prisma (truy vấn) → PostgreSQL

- **Controller**: nhận request, validate DTO bằng class-validator, trả response. Không chứa nghiệp vụ.

- **Service**: chứa nghiệp vụ (tính giá, tồn kho, state machine, idempotency, loyalty).

- **Prisma**: truy cập CSDL. Mọi thao tác nhiều bảng phải nằm trong prisma.\$transaction.

**Nguyên tắc quan trọng:**

1.  **Giỏ hàng nằm ở frontend** (Zustand). Server chỉ nhận giỏ khi gọi POST /orders.

2.  **Server tự tính giá**, không tin giá client gửi lên (client chỉ gửi productId, size, toppingIds, quantity).

3.  Tiền tệ là **số nguyên VND** (45000, không dùng số thực).

4.  Mọi endpoint trừ menu, auth và health đều cần JWT.

## 2. Quy ước chung

| Mục           | Quy ước                                                                          |
|---------------|----------------------------------------------------------------------------------|
| Base URL      | http://localhost:4000/api                                                        |
| Swagger       | http://localhost:4000/api/docs                                                   |
| Định dạng     | JSON, Content-Type: application/json                                             |
| Xác thực      | Header Authorization: Bearer \<accessToken\>                                     |
| Đặt tên field | camelCase                                                                        |
| Thời gian     | ISO 8601 UTC, ví dụ 2026-10-08T09:30:00.000Z                                     |
| Validation    | ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }) |
| CORS          | Cho phép origin của frontend (http://localhost:3000)                             |

### 2.1. Định dạng lỗi thống nhất

```
{
  "statusCode": 409,
  "code": "OUT_OF_STOCK",
  "message": "Sản phẩm 'Cappuccino' chỉ còn 2 phần",
  "details": [{ "productId": 3, "available": 2, "requested": 5 }],
  "path": "/api/orders",
  "timestamp": "2026-10-08T09:30:00.000Z"
}
```

Dùng một ExceptionFilter toàn cục để mọi lỗi đều ra dạng này. code là chuỗi ổn định để frontend xử lý (xem mục 7).

### 2.2. Mã HTTP dùng trong dự án

| Mã  | Khi nào                                                                                                            |
|-----|--------------------------------------------------------------------------------------------------------------------|
| 200 | Thành công (GET, cập nhật)                                                                                         |
| 201 | Tạo mới thành công (kể cả replay của lần thanh toán thành công)                                                    |
| 400 | Dữ liệu sai định dạng (validation)                                                                                 |
| 401 | Thiếu hoặc sai JWT, sai mật khẩu                                                                                   |
| 402 | Thanh toán thất bại (kể cả replay của lần thất bại)                                                                |
| 403 | Có JWT nhưng không có quyền (xem đơn người khác, sai role)                                                         |
| 404 | Không tìm thấy tài nguyên                                                                                          |
| 409 | Xung đột nghiệp vụ (email trùng, hết hàng, chuyển trạng thái sai, đơn đang có thanh toán xử lý)                    |
| 422 | Dữ liệu hợp lệ về định dạng nhưng sai nghiệp vụ (mã giảm giá không hợp lệ, Idempotency-Key tái dùng với body khác) |

### 2.3. Phân trang

Query: page (mặc định 1), limit (mặc định 10, tối đa 50). Response:

```
{ "data": [ ... ], "meta": { "page": 1, "limit": 10, "total": 27, "totalPages": 3 } }
```

## 3. Mô hình dữ liệu

Đề yêu cầu tối thiểu 5 thực thể. Nhóm nên thêm các cột và bảng đánh dấu **(+)** để Task 4 và Task 10 làm được mà không phải sửa schema giữa chừng.

### 3.1. Enum

| Enum             | Giá trị                                                               |
|------------------|-----------------------------------------------------------------------|
| OrderStatus      | PENDING, PAID, PREPARING, READY, COMPLETED, PAYMENT_FAILED, CANCELLED |
| PaymentMethod    | WALLET, CARD                                                          |
| PaymentStatus    | PROCESSING, SUCCESS, FAILED                                           |
| Size             | S, M, L                                                               |
| Role (+)         | CUSTOMER, BARISTA                                                     |
| DiscountType (+) | PERCENT, FIXED                                                        |

### 3.2. Các bảng

**Product**

| Cột          | Kiểu    | Ràng buộc / ghi chú                        |
|--------------|---------|--------------------------------------------|
| id           | Int     | PK, autoincrement                          |
| name         | String  | not null, unique                           |
| description  | String? |                                            |
| price        | Int     | Giá gốc (size S), VND, ≥ 0                 |
| imageUrl     | String  |                                            |
| category (+) | String  | Cà phê, Trà, Đá xay...                     |
| stock        | Int     | ≥ 0, số phần còn bán                       |
| version (+)  | Int     | default 0, **dùng cho optimistic locking** |
| isActive (+) | Boolean | default true                               |

**Topping (+)**: id, name (unique), price (Int), isActive.

**User**

| Cột           | Kiểu     | Ràng buộc / ghi chú              |
|---------------|----------|----------------------------------|
| id            | Int      | PK                               |
| email         | String   | unique, lưu chữ thường           |
| passwordHash  | String   | bcrypt, không bao giờ trả ra API |
| fullName (+)  | String   |                                  |
| role (+)      | Role     | default CUSTOMER                 |
| loyaltyPoints | Int      | default 0, ≥ 0                   |
| createdAt     | DateTime |                                  |

**Order**

| Cột                  | Kiểu        | Ghi chú                          |
|----------------------|-------------|----------------------------------|
| id                   | Int         | PK, hiển thị là \#1042           |
| userId               | Int         | FK User                          |
| status               | OrderStatus | default PENDING                  |
| subtotal (+)         | Int         | Tổng tiền hàng trước giảm giá    |
| discountAmount (+)   | Int         | default 0                        |
| total                | Int         | = subtotal − discountAmount      |
| promoCode (+)        | String?     | Mã đã áp                         |
| pointsEarned (+)     | Int         | default 0, điểm đã cộng khi PAID |
| createdAt, updatedAt | DateTime    |                                  |

**OrderItem**

| Cột             | Kiểu    | Ghi chú                                                                               |
|-----------------|---------|---------------------------------------------------------------------------------------|
| id              | Int     | PK                                                                                    |
| orderId         | Int     | FK Order, onDelete Cascade                                                            |
| productId       | Int     | FK Product                                                                            |
| productName (+) | String  | **Chụp lại tên** lúc đặt                                                              |
| size            | Size    |                                                                                       |
| toppings (+)    | Json    | Mảng \[{id, name, price}\], chụp lại lúc đặt                                          |
| unitPrice (+)   | Int     | Giá 1 phần đã gồm size + topping                                                      |
| qty             | Int     | 1 đến 20                                                                              |
| lineTotal       | Int     | = unitPrice × qty                                                                     |
| note (+)        | String? | Ghi chú của khách, tối đa 200 ký tự (ví dụ "ít đá"); hai dòng khác note thì không gộp |

Lý do chụp lại tên, topping, giá: sau này menu đổi giá thì đơn cũ không bị đổi theo.

**Payment**

| Cột                  | Kiểu          | Ghi chú                                                                                |
|----------------------|---------------|----------------------------------------------------------------------------------------|
| id                   | Int           | PK                                                                                     |
| orderId              | Int           | FK Order                                                                               |
| idempotencyKey       | String        | **UNIQUE**                                                                             |
| requestHash (+)      | String        | SHA-256 của **toàn bộ body** (orderId, method, mockResult), phát hiện tái dùng key sai |
| amount               | Int           |                                                                                        |
| method               | PaymentMethod |                                                                                        |
| status (+)           | PaymentStatus | Bắt đầu là PROCESSING khi chiếm key, sau đó SUCCESS hoặc FAILED                        |
| providerRef (+)      | String?       | Mã giao dịch của mock gateway                                                          |
| failureReason (+)    | String?       |                                                                                        |
| responseSnapshot (+) | Json          | Response đã trả (null khi còn PROCESSING), dùng để replay                              |
| createdAt            | DateTime      |                                                                                        |

**PromoCode (+)**: id, code (unique, in hoa), type (DiscountType), value (Int; % hoặc VND), minOrderValue (Int), maxDiscount (Int?, trần cho loại PERCENT), startsAt, expiresAt, usageLimit (Int?), usedCount (Int, default 0), isActive.

**LoyaltyTransaction (+)** (không bắt buộc, nên có để chứng minh cộng điểm): id, userId, orderId (unique, đảm bảo mỗi đơn chỉ cộng điểm một lần), points, createdAt.

**StockMovement (B, tùy chọn)**: nhật ký kho, giúp giải thích vì sao số tồn đổi.

| Cột       | Kiểu     | Ràng buộc / ghi chú |
|-----------|----------|---------------------|
| id        | Int      | PK, autoincrement |
| productId | Int      | FK Product |
| type      | Enum     | ORDER_RESERVE (trừ khi đặt), ORDER_RELEASE (hoàn khi hủy), RESTOCK (barista nhập) |
| quantity  | Int      | Âm là trừ, dương là cộng |
| orderId   | Int?     | FK Order, có với ORDER_RESERVE và ORDER_RELEASE |
| userId    | Int?     | Barista nhập kho |
| createdAt | DateTime | default now |

Ghi dòng này **trong cùng transaction** với lúc đổi `Product.stock`, để nhật ký luôn khớp số tồn.

### 3.3. Quan hệ

User 1—N Order, Order 1—N OrderItem, Product 1—N OrderItem, Order 1—N Payment (có thể nhiều lần thử), PromoCode liên kết với Order qua promoCode.

## 4. Quy tắc nghiệp vụ dùng chung

### 4.1. Cách tính giá (Task 4 và Task 6)

```
unitPrice = product.price + sizeSurcharge[size] + tổng(topping.price)
lineTotal = unitPrice × qty
subtotal  = tổng(lineTotal)
```

| Size | Phụ thu |
|------|---------|
| S    | +0      |
| M    | +5.000  |
| L    | +10.000 |

Topping mẫu: Trân châu +5.000, Kem cheese +7.000, Thạch +4.000.

> **Lưu ý:** wireframe trong đề (Cappuccino M = 45.000, Trà đào L ×2 = 78.000, tổng 123.000) cho thấy giá không đổi theo size. Con số phụ thu ở trên là **giả định của nhóm**, cần chốt với giảng viên. Đặt bảng phụ thu trong một file hằng số (common/pricing/pricing.constants.ts) để đổi một chỗ là xong.

### 4.2. Tồn kho và optimistic locking (Task 10)

- **Giữ hàng ngay khi tạo đơn** (POST /orders), không đợi thanh toán.

- **Trừ kho luôn do server tự làm** khi tạo đơn. Barista không trừ kho bằng tay, vì như vậy dễ quên hoặc trừ sai.

- **Nhập kho (B)** do barista làm qua `POST /products/:id/stock` (mục 6.16): cộng dồn số lượng, không ghi đè.

- **Hoàn kho** khi đơn chuyển sang CANCELLED.

- Đơn PAYMENT_FAILED vẫn giữ hàng (khách có thể thử lại), cho đến khi hủy.

- **Giới hạn của MVP:** PENDING và PAYMENT_FAILED chưa có cơ chế tự hết hạn, nên đơn bị bỏ dở giữ hàng cho đến khi người dùng chủ động hủy. Nếu còn thời gian, thêm Order.expiresAt (15 phút) và một cron (@nestjs/schedule) tự hủy đơn PENDING quá hạn bằng đúng luồng hủy ở mục 6.11.

Thuật toán trừ kho cho mỗi sản phẩm (trong một transaction, **sắp xếp theo productId tăng dần** để tránh deadlock):

```
// Chạy trong prisma.$transaction; nếu ném STOCK_RETRY thì thử lại CẢ giao dịch
const r = await tx.product.updateMany({
  where: { id, version: current.version, stock: { gte: qty } },
  data:  { stock: { decrement: qty }, version: { increment: 1 } },
});
if (r.count === 0) {
  const now = await tx.product.findUnique({ where: { id } });
  if (now.stock < qty) throw OUT_OF_STOCK;  // thật sự hết hàng: dừng ngay
  throw STOCK_RETRY;                        // còn hàng nhưng version đã đổi: thử lại
}
```

Nếu một sản phẩm trong giỏ thất bại thì **toàn bộ transaction rollback**, không có đơn nào được tạo. Khi chỉ lệch version mà kho vẫn còn hàng thì thử lại cả giao dịch, tối đa 10 lần, nghỉ ngẫu nhiên 10 đến 50 ms giữa các lần; chỉ khi hết lượt mới ném STOCK_CONFLICT. Với 10 request đồng thời, mỗi vòng chỉ chắc chắn một request thắng, nên 3 lần thử là không đủ và test (c) ở mục 10 sẽ chập chờn.

### 4.3. Khuyến mãi (Task 10)

Mã hợp lệ khi **đồng thời**: isActive, nằm trong \[startsAt, expiresAt\], usedCount \< usageLimit (nếu có), subtotal ≥ minOrderValue.

```
PERCENT: discount = min( floor(subtotal × value / 100), maxDiscount ?? ∞ )
FIXED:   discount = min( value, subtotal )
total    = subtotal − discount
```

Tăng usedCount bằng updateMany có điều kiện usedCount \< usageLimit trong cùng transaction tạo đơn để tránh vượt giới hạn khi đặt đồng thời.

### 4.4. Điểm thưởng (Task 10)

- Quy tắc: **1 điểm cho mỗi 1.000đ** của total (làm tròn xuống).

- Chỉ cộng **khi đơn chuyển sang PAID**, trong cùng transaction với việc đổi trạng thái. Hiện thực bằng hàm LoyaltyService.award(tx, order) (BE2 viết); luồng POST /payments (BE4) gọi hàm này bên trong transaction thứ hai.

- LoyaltyTransaction.orderId unique nên gọi lại cũng không cộng trùng.

## 5. Máy trạng thái đơn hàng

| Từ trạng thái  | Sang trạng thái | Kích hoạt bởi                          |
|----------------|-----------------|----------------------------------------|
| PENDING        | PAID            | POST /payments thành công              |
| PENDING        | PAYMENT_FAILED  | POST /payments thất bại                |
| PENDING        | CANCELLED       | Khách hủy                              |
| PAYMENT_FAILED | PAID            | Thử thanh toán lại thành công          |
| PAYMENT_FAILED | CANCELLED       | Khách hủy                              |
| PAID           | PREPARING       | Barista nhận đơn                       |
| PAID           | CANCELLED       | Khách hoặc barista hủy khi chưa pha (hoàn tiền mock, hoàn kho) |
| PREPARING      | READY           | Barista pha xong                       |
| READY          | COMPLETED       | Barista giao cho khách                 |

COMPLETED và CANCELLED là trạng thái kết thúc. Mọi chuyển khác đều bị chặn.

Hiện thực bằng một bảng cấu hình và một hàm thuần (dễ unit test):

```
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:        ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PAID', 'CANCELLED'],
  PAID:           ['PREPARING', 'CANCELLED'],
  PREPARING:      ['READY'],
  READY:          ['COMPLETED'],
  COMPLETED:      [],
  CANCELLED:      [],
};
export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!TRANSITIONS[from].includes(to))
    throw new ConflictException({ code: 'INVALID_TRANSITION', message: `Không thể chuyển ${from} → ${to}` });
}
```

## 6. Chi tiết từng endpoint

Ký hiệu xác thực: 🔓 công khai, 🔒 cần JWT, 🔒B cần JWT role BARISTA.

### 6.0. Tổng quan

| \#  | Method | Endpoint                 | Auth | Task  | Mô tả                       |
|-----|--------|--------------------------|------|-------|-----------------------------|
| 1   | GET    | /products                | 🔓   | 2     | Danh sách menu              |
| 2   | GET    | /products/:id            | 🔓   | 2, 4  | Chi tiết sản phẩm           |
| 3   | GET    | /toppings (+)            | 🔓   | 4     | Danh sách topping           |
| 4   | POST   | /auth/register           | 🔓   | 7     | Đăng ký                     |
| 5   | POST   | /auth/login              | 🔓   | 7     | Đăng nhập, trả JWT          |
| 6   | GET    | /auth/me (+)             | 🔒   | 7     | Thông tin tài khoản và điểm |
| 7   | POST   | /promotions/validate (+) | 🔒   | 10    | Kiểm tra mã giảm giá        |
| 8   | POST   | /orders                  | 🔒   | 6, 10 | Tạo đơn PENDING             |
| 9   | GET    | /orders/me               | 🔒   | 9     | Lịch sử đơn                 |
| 10  | GET    | /orders/:id (+)          | 🔒   | 9     | Chi tiết một đơn            |
| 11  | POST   | /orders/:id/cancel (+)   | 🔒   | 10    | Hủy đơn                     |
| 12  | POST   | /payments                | 🔒   | 8, 10 | Thanh toán idempotent       |
| 13  | PATCH  | /orders/:id/status (+)   | 🔒B  | 10    | Barista đổi trạng thái      |
| 14  | GET    | /health (+)              | 🔓   | 1, 9  | Kiểm tra server sống        |
| 15  | GET    | /orders (B)              | 🔒B  | mở rộng | Hàng đợi đơn của cửa hàng |
| 16  | POST   | /products/:id/stock (B)  | 🔒B  | mở rộng | Nhập thêm kho             |
| 17  | GET    | /products/:id/stock-movements (B) | 🔒B | mở rộng | Lịch sử nhập, trừ, hoàn kho (tùy chọn) |

Các dòng (+) không có trong bảng 12.1 của đề nhưng cần thiết để hoàn thành luồng và demo Task 10.

### 6.1. GET /products 🔓 (Task 2)

**Query:**

| Tham số     | Kiểu   | Mặc định | Ghi chú                                                                |
|-------------|--------|----------|------------------------------------------------------------------------|
| search      | string |          | Tìm theo tên, không phân biệt hoa thường (contains, mode: insensitive) |
| category    | string |          | Lọc theo danh mục                                                      |
| page, limit | int    | 1, 20    | limit tối đa 50                                                        |

**Response 200:**

```
{
  "data": [
    { "id": 1, "name": "Cà phê sữa", "price": 35000, "imageUrl": "/img/ca-phe-sua.jpg",
      "category": "Cà phê", "stock": 40, "inStock": true }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

- Chỉ trả sản phẩm isActive = true. Không trả version.

- Danh sách rỗng vẫn trả **200** với data: \[\] (frontend hiển thị empty state).

- **Lỗi:** 400 nếu page hoặc limit không phải số nguyên dương.

- Yêu cầu phi chức năng: phản hồi dưới 500ms với dữ liệu mẫu.

### 6.2. GET /products/:id 🔓 (Task 2, 4)

**Response 200:** thêm mô tả và các tùy chọn để frontend dựng trang chi tiết mà không cần hardcode.

```
{
  "id": 3, "name": "Cappuccino", "description": "Espresso, sữa nóng và lớp bọt sữa",
  "price": 45000, "imageUrl": "/img/cappuccino.jpg", "category": "Cà phê",
  "stock": 25, "inStock": true,
  "sizes": [ { "size": "S", "surcharge": 0 }, { "size": "M", "surcharge": 5000 }, { "size": "L", "surcharge": 10000 } ],
  "toppings": [ { "id": 1, "name": "Trân châu", "price": 5000 }, { "id": 2, "name": "Kem cheese", "price": 7000 } ]
}
```

**Lỗi:** 400 nếu id không phải số (dùng ParseIntPipe); 404 PRODUCT_NOT_FOUND.

### 6.3. GET /toppings 🔓 (+) (Task 4)

Trả mảng \[{ id, name, price }\] các topping isActive. Có thể bỏ endpoint này nếu đã nhúng toppings trong 6.2.

### 6.4. POST /auth/register 🔓 (Task 7)

**Body:**

```
{ "email": "an@example.com", "password": "Passw0rd!", "fullName": "Nguyễn Văn An" }
```

| Field    | Rule                                                             |
|----------|------------------------------------------------------------------|
| email    | @IsEmail(), tối đa 150 ký tự, chuyển về chữ thường trước khi lưu |
| password | 8 đến 64 ký tự, có ít nhất 1 chữ và 1 số                         |
| fullName | 2 đến 100 ký tự, trim                                            |

**Xử lý:** kiểm tra email trùng → bcrypt.hash(password, 10) → tạo User (role = CUSTOMER, loyaltyPoints = 0).

**Response 201** (không có passwordHash):

```
{ "id": 12, "email": "an@example.com", "fullName": "Nguyễn Văn An", "role": "CUSTOMER", "loyaltyPoints": 0 }
```

**Lỗi:** 400 sai định dạng; 409 EMAIL_ALREADY_EXISTS.

### 6.5. POST /auth/login 🔓 (Task 7)

**Body:** { "email": "an@example.com", "password": "Passw0rd!" }

**Xử lý:** tìm user theo email → bcrypt.compare → ký JWT payload { sub: userId, email, role }, hạn 1d, khóa bí mật lấy từ JWT_SECRET trong .env.

**Response 200:**

```
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": { "id": 12, "email": "an@example.com", "fullName": "Nguyễn Văn An", "role": "CUSTOMER", "loyaltyPoints": 0 }
}
```

**Lỗi:** 400 thiếu field; 401 INVALID_CREDENTIALS. Dù sai email hay sai mật khẩu đều trả **cùng một thông báo** để không lộ email nào tồn tại.

### 6.6. GET /auth/me 🔒 (+)

Trả thông tin user hiện tại như user ở 6.5, có loyaltyPoints cập nhật mới nhất. Frontend gọi khi mở lại app để xác thực token còn hạn. **Lỗi:** 401 UNAUTHORIZED.

### 6.7. POST /promotions/validate 🔒 (+) (Task 10)

Cho frontend xem trước số tiền giảm ở trang giỏ hàng, không ghi dữ liệu và không đổi tồn kho. Client chỉ gửi giỏ hàng; **server tự tính subtotal** bằng hàm PricingService.calculate() dùng chung với POST /orders, không nhận subtotal từ client.

**Body:**

```
{
  "code": "BREW10",
  "items": [
    { "productId": 3, "size": "M", "toppingIds": [1], "quantity": 1 },
    { "productId": 4, "size": "L", "toppingIds": [], "quantity": 2 }
  ]
}
```

items có cùng quy tắc validate như POST /orders.

**Response 200:**

```
{ "code": "BREW10", "type": "PERCENT", "value": 10, "subtotal": 123000, "discountAmount": 12300, "totalAfterDiscount": 110700 }
```

**Lỗi 422** với code cụ thể: PROMO_NOT_FOUND, PROMO_EXPIRED, PROMO_NOT_STARTED, PROMO_USAGE_EXCEEDED, PROMO_MIN_ORDER_NOT_MET.

### 6.8. POST /orders 🔒 (Task 6, 10)

Tạo đơn ở trạng thái PENDING từ giỏ hàng, đồng thời **giữ tồn kho**.

**Body:**

```
{
  "items": [
    { "productId": 3, "size": "M", "toppingIds": [1], "quantity": 1 },
    { "productId": 4, "size": "L", "toppingIds": [], "quantity": 2, "note": "ít đá" }
  ],
  "promoCode": "BREW10"
}
```

| Field                | Rule                                    |
|----------------------|-----------------------------------------|
| items                | Mảng, 1 đến 30 phần tử, @ValidateNested |
| items\[\].productId  | Int dương, phải tồn tại và isActive     |
| items\[\].size       | Một trong S, M, L                       |
| items\[\].toppingIds | Mảng int, tối đa 3 topping, không trùng |
| items\[\].quantity   | Int từ 1 đến 20                         |
| items\[\].note       | Chuỗi tối đa 200 ký tự, tùy chọn        |
| promoCode            | Chuỗi tùy chọn, chuyển in hoa           |

**Quy trình xử lý (một transaction):**

1.  Validate DTO. Gộp các dòng trùng (productId, size, toppingIds) nếu cần.

2.  Nạp Product và Topping từ CSDL, **tính lại giá** theo mục 4.1.

3.  Nếu có promoCode: kiểm tra theo 4.3, tính discountAmount.

4.  Trừ kho từng sản phẩm bằng optimistic locking (4.2). Hết hàng → rollback, 409.

5.  Tạo Order (status = PENDING) và các OrderItem (chụp lại tên, topping, giá).

6.  Tăng PromoCode.usedCount có điều kiện.

**Response 201:**

```
{
  "id": 1042, "code": "#1042", "status": "PENDING",
  "items": [
    { "productId": 3, "productName": "Cappuccino", "size": "M",
      "toppings": [{ "id": 1, "name": "Trân châu", "price": 5000 }],
      "unitPrice": 55000, "qty": 1, "lineTotal": 55000 }
  ],
  "subtotal": 123000, "discountAmount": 12300, "total": 110700,
  "promoCode": "BREW10", "createdAt": "2026-10-08T09:30:00.000Z"
}
```

**Lỗi:** 400 validation; 401 chưa đăng nhập; 404 PRODUCT_NOT_FOUND (kèm id); 409 OUT_OF_STOCK, STOCK_CONFLICT (hết số lần thử lại); 422 các lỗi PROMO\_\*.

### 6.9. GET /orders/me 🔒 (Task 9)

**Query:** page, limit (mặc định 10), status (tùy chọn, một giá trị của OrderStatus).

Chỉ trả đơn của req.user.id, sắp xếp createdAt giảm dần.

```
{
  "data": [
    { "id": 1042, "code": "#1042", "status": "PAID", "total": 110700, "itemCount": 3,
      "createdAt": "2026-10-08T09:30:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Lỗi:** 400 status không hợp lệ; 401.

> Trong NestJS, khai báo route GET /orders/me **trước** GET /orders/:id để me không bị hiểu thành :id.

### 6.10. GET /orders/:id 🔒 (+) (Task 9)

Dùng cho màn hình xác nhận và xem chi tiết. Response giống 6.8 kèm payments (mảng các lần thanh toán: method, status, amount, createdAt) và pointsEarned.

**Lỗi:** 404 ORDER_NOT_FOUND; 403 FORBIDDEN nếu đơn của người khác (barista được xem mọi đơn).

### 6.11. POST /orders/:id/cancel 🔒 (+) (Task 10)

Không có body. Chủ đơn (hoặc barista) hủy đơn.

**Xử lý (một transaction):**

1.  Khóa dòng đơn bằng SELECT ... FOR UPDATE. Nếu đơn đang có Payment ở PROCESSING thì dừng với 409 PAYMENT_IN_PROGRESS.

2.  assertTransition(order.status, 'CANCELLED').

3.  **Hoàn kho** cho từng sản phẩm (stock + qty, version + 1).

4.  Hoàn usedCount của mã giảm giá (nếu có).

5.  Nếu đơn đang PAID: trừ lại pointsEarned khỏi User.loyaltyPoints và ghi hoàn tiền mock.

6.  Đặt status = CANCELLED.

**Response 200:** đơn với status = CANCELLED. **Lỗi:** 404, 403, 409 INVALID_TRANSITION (ví dụ đơn đã PREPARING), 409 PAYMENT_IN_PROGRESS.

### 6.12. POST /payments 🔒 (Task 8, 10)

**Header bắt buộc:** Idempotency-Key: \<UUID v4 do frontend sinh\>. Frontend sinh **một key cho mỗi lần bấm "Xác nhận trả"** và dùng lại đúng key đó nếu phải gửi lại do mất mạng.

**Body:**

```
{ "orderId": 1042, "method": "WALLET" }
```

| Field      | Rule                                                                                                       |
|------------|------------------------------------------------------------------------------------------------------------|
| orderId    | Int dương                                                                                                  |
| method     | WALLET hoặc CARD                                                                                           |
| mockResult | Tùy chọn SUCCESS hoặc FAILED, **chỉ hoạt động khi NODE_ENV != production**, để demo và test thanh toán lỗi |

**Quy trình xử lý:**

1.  Thiếu hoặc sai định dạng Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED.

2.  Tính requestHash = sha256(JSON.stringify({ orderId, method, mockResult: mockResult ?? null })). Băm **toàn bộ body** theo thứ tự field cố định (không nối chuỗi orderId + method), để hai body khác nhau không bao giờ trùng hash.

3.  Tra Payment theo idempotencyKey. **Nếu đã có:**

    - Payment thuộc đơn của người khác, hoặc requestHash khác → 422 IDEMPOTENCY_KEY_REUSED (không trả dữ liệu nào của lần trước).

    - status là SUCCESS hoặc FAILED → trả lại responseSnapshot với **đúng HTTP status của lần đầu** (201 hoặc 402), thêm header Idempotent-Replayed: true. Không gọi gateway, không đổi trạng thái.

    - status = PROCESSING → một request khác cùng key đang xử lý: chờ tối đa 3 giây (kiểm tra mỗi 200 ms) rồi trả như dòng trên; hết hạn thì 409 PAYMENT_IN_PROGRESS.

4.  **Chưa có → chiếm key** trong một transaction ngắn, **commit trước khi gọi gateway**:

    - Khóa dòng đơn bằng SELECT ... FROM "Order" WHERE id = \$1 FOR UPDATE (qua \$queryRaw).

    - Kiểm tra đơn thuộc về user (403) và status là PENDING hoặc PAYMENT_FAILED (409 INVALID_TRANSITION).

    - Kiểm tra đơn chưa có Payment PROCESSING nào khác (409 PAYMENT_IN_PROGRESS). Bước này chặn hai key khác nhau cùng trả một đơn.

    - INSERT Payment(idempotencyKey, requestHash, amount, method, status = PROCESSING). Nếu vi phạm unique (P2002) nghĩa là request khác vừa chiếm key: quay lại bước 3.

5.  **Chỉ request chiếm được key** mới gọi MockPaymentService.charge({ amount: order.total, method }). Gateway ném lỗi bất ngờ (timeout) thì coi như thất bại.

6.  Transaction thứ hai: cập nhật Payment (status, providerRef, failureReason, responseSnapshot) và

    - thành công: assertTransition(→ PAID), cập nhật đơn, cộng floor(total / 1000) điểm, ghi LoyaltyTransaction;

    - thất bại: assertTransition(→ PAYMENT_FAILED), cập nhật đơn.

**Response 201 (thanh toán thành công):**

```
{
  "payment": { "id": 77, "orderId": 1042, "amount": 110700, "method": "WALLET",
               "status": "SUCCESS", "providerRef": "MOCK-8F2A91" },
  "order": { "id": 1042, "code": "#1042", "status": "PAID", "total": 110700, "pointsEarned": 110 }
}
```

**Response khi thanh toán thất bại:** HTTP **402** PAYMENT_FAILED kèm order.status = PAYMENT_FAILED; **Payment vẫn được lưu** với status = FAILED, nên gửi lại cùng key sẽ nhận lại đúng 402 này. Frontend giữ nguyên giỏ hàng và cho phép thử lại với **key mới**.

| Tình huống                                                       | HTTP                             | code                     |
|------------------------------------------------------------------|----------------------------------|--------------------------|
| Thành công lần đầu                                               | 201                              |                          |
| Gửi lại cùng key và body, lần đầu thành công                     | 201 + header Idempotent-Replayed | (replay)                 |
| Gửi lại cùng key và body, lần đầu thất bại                       | 402 + header Idempotent-Replayed | PAYMENT_FAILED (replay)  |
| Cùng key, body khác (kể cả khác mockResult)                      | 422                              | IDEMPOTENCY_KEY_REUSED   |
| Key đã được người khác dùng                                      | 422                              | IDEMPOTENCY_KEY_REUSED   |
| Thiếu header                                                     | 400                              | IDEMPOTENCY_KEY_REQUIRED |
| Đơn không phải của mình                                          | 403                              | FORBIDDEN                |
| Đơn không tồn tại                                                | 404                              | ORDER_NOT_FOUND          |
| Đơn đã PAID, đã hủy...                                           | 409                              | INVALID_TRANSITION       |
| Đơn đang có thanh toán khác xử lý, hoặc cùng key chạy quá 3 giây | 409                              | PAYMENT_IN_PROGRESS      |
| Gateway từ chối                                                  | 402                              | PAYMENT_FAILED           |

### 6.13. PATCH /orders/:id/status 🔒B (+) (Task 10, dùng cho trang Barista)

Barista đưa đơn đi tiếp trên đường PAID → PREPARING → READY → COMPLETED. Dùng cho trang Barista, và cũng dùng để demo state machine bằng Swagger.

**Body:** `{ "status": "PREPARING" }`. Chỉ nhận PREPARING, READY, COMPLETED (hủy dùng 6.11, thanh toán dùng 6.12).

**Xử lý:** khóa dòng đơn, `assertTransition(order.status, body.status)`, cập nhật `status`. Hai barista bấm cùng lúc một đơn thì người đến sau nhận 409 INVALID_TRANSITION (đơn đã sang bước khác).

**Response 200:** đơn đã cập nhật. **Lỗi:** 401; 403 nếu không phải BARISTA; 404 ORDER_NOT_FOUND; 409 INVALID_TRANSITION.

Seed sẵn tài khoản barista (barista@brewlite.com / Barista@123).

### 6.14. GET /health 🔓 (+)

Trả { "status": "ok", "db": "up" } sau khi chạy thử SELECT 1. Dùng cho Docker healthcheck ở Task 9.

### 6.15. GET /orders 🔒B (B)

Hàng đợi đơn cho barista. Khác `GET /orders/me` (chỉ đơn của mình), endpoint này trả đơn của **mọi khách**.

**Query:**

| Tham số     | Kiểu   | Mặc định | Ghi chú |
|-------------|--------|----------|---------|
| status      | string | PAID,PREPARING,READY | Một hoặc nhiều OrderStatus, cách nhau bằng dấu phẩy. Đơn PENDING chưa trả tiền nên không hiện mặc định |
| page, limit | int    | 1, 20    | limit tối đa 50 |

Sắp xếp `createdAt` **tăng dần** (đơn cũ nhất lên đầu, đúng thứ tự phục vụ).

```json
{
  "data": [
    {
      "id": 1042, "code": "#1042", "status": "PAID", "total": 110700,
      "customerName": "Nguyễn Văn A", "createdAt": "2026-10-08T09:30:00.000Z",
      "items": [
        { "productName": "Cappuccino", "size": "M", "qty": 2,
          "toppings": [{ "name": "Trân châu" }], "note": "ít đá" }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Lỗi:** 400 status không hợp lệ; 401; 403 nếu không phải BARISTA.

### 6.16. POST /products/:id/stock 🔒B (B)

Barista nhập thêm hàng. **Cộng dồn**, không ghi đè, để hai người nhập cùng lúc không đè số của nhau.

**Body:** `{ "quantity": 20, "note": "Nhập hàng buổi sáng" }`. `quantity` là số nguyên từ 1 đến 1000, `note` tùy chọn.

**Xử lý (một transaction):**

1. Tìm sản phẩm (không có thì 404 PRODUCT_NOT_FOUND).
2. Cập nhật nguyên tử: `stock + quantity`, `version + 1`. Tăng `version` để đơn đang đặt song song đọc lại tồn kho mới.
3. Nếu có bảng `StockMovement` (mục 3.2): ghi một dòng `type = RESTOCK`, `quantity = +20`, `userId` của barista.

**Response 200:** `{ "id": 3, "name": "Cà phê muối", "stock": 25, "inStock": true }`

**Lỗi:** 400 VALIDATION_ERROR (quantity không phải số nguyên 1–1000); 401; 403; 404 PRODUCT_NOT_FOUND.

### 6.17. GET /products/:id/stock-movements 🔒B (B, tùy chọn)

Lịch sử biến động kho của một sản phẩm, mới nhất trước, có phân trang `{data, meta}`. Mỗi dòng: `type` (ORDER_RESERVE, ORDER_RELEASE, RESTOCK), `quantity` (âm là trừ, dương là cộng), `orderId?`, `userId?`, `createdAt`. Chỉ làm nếu có bảng `StockMovement`.

## 7. Bảng mã lỗi nghiệp vụ

| code                                                                                             | HTTP | Ý nghĩa                                                          |
|--------------------------------------------------------------------------------------------------|------|------------------------------------------------------------------|
| VALIDATION_ERROR                                                                                 | 400  | Sai định dạng dữ liệu (details liệt kê từng field)               |
| IDEMPOTENCY_KEY_REQUIRED                                                                         | 400  | Thiếu hoặc sai Idempotency-Key                                   |
| UNAUTHORIZED                                                                                     | 401  | Thiếu, sai hoặc hết hạn JWT                                      |
| INVALID_CREDENTIALS                                                                              | 401  | Sai email hoặc mật khẩu                                          |
| PAYMENT_FAILED                                                                                   | 402  | Cổng thanh toán từ chối (kể cả khi replay)                       |
| FORBIDDEN                                                                                        | 403  | Không có quyền với tài nguyên                                    |
| PRODUCT_NOT_FOUND                                                                                | 404  |                                                                  |
| ORDER_NOT_FOUND                                                                                  | 404  |                                                                  |
| EMAIL_ALREADY_EXISTS                                                                             | 409  |                                                                  |
| OUT_OF_STOCK                                                                                     | 409  | Không đủ hàng                                                    |
| STOCK_CONFLICT                                                                                   | 409  | Hết số lần thử lại do tranh chấp phiên bản                       |
| INVALID_TRANSITION                                                                               | 409  | Chuyển trạng thái đơn không hợp lệ                               |
| PAYMENT_IN_PROGRESS                                                                              | 409  | Đơn đang có thanh toán khác xử lý, hoặc cùng key chạy quá 3 giây |
| IDEMPOTENCY_KEY_REUSED                                                                           | 422  | Cùng key nhưng nội dung khác, hoặc key của người khác            |
| PROMO_NOT_FOUND, PROMO_EXPIRED, PROMO_NOT_STARTED, PROMO_USAGE_EXCEEDED, PROMO_MIN_ORDER_NOT_MET | 422  | Mã giảm giá không dùng được                                      |

## 8. Ánh xạ Task, endpoint và Sprint

| Sprint | Task | Endpoint và công việc                                                                        |
|--------|------|----------------------------------------------------------------------------------------------|
| 1      | 1    | /health, khung dự án, Prisma schema, seed                                                    |
| 1      | 2    | GET /products, GET /products/:id                                                             |
| 1      | 3    | Frontend gọi GET /products                                                                   |
| 1      | 4    | GET /toppings (hoặc nhúng trong 6.2), tính giá trên frontend và backend dùng chung công thức |
| 2      | 5    | Giỏ hàng (không có API)                                                                      |
| 2      | 6    | POST /orders (phiên bản cơ bản: chưa khuyến mãi, chưa khóa tồn kho)                          |
| 2      | 7    | POST /auth/register, POST /auth/login, GET /auth/me, JwtAuthGuard                            |
| 3      | 8    | POST /payments bản cơ bản + MockPaymentService                                               |
| 3      | 9    | GET /orders/me, GET /orders/:id, Docker Compose, README                                      |
| 3      | 10   | State machine, idempotency, optimistic locking, PromoCode, loyalty, cancel, PATCH status     |

| Mở rộng | B | GET /orders, POST /products/:id/stock, (tùy chọn) stock-movements; Frontend trang /barista |

**Gợi ý:** viết Task 6 và Task 8 sao cho dễ nâng cấp, ví dụ tách PricingService.calculate(), reserveStock(), applyPromo() thành hàm riêng ngay từ đầu để Task 10 chỉ cần thay ruột.

## 9. Cấu trúc module NestJS gợi ý

```
backend/src/
├── main.ts                  # ValidationPipe, CORS, Swagger, prefix 'api'
├── prisma/                  # PrismaModule, PrismaService
├── common/
│   ├── filters/all-exceptions.filter.ts
│   ├── decorators/current-user.decorator.ts
│   ├── guards/roles.guard.ts   # @Roles('BARISTA') cho các endpoint (B)
│   └── pricing/  (pricing.service.ts, pricing.module.ts, pricing.constants.ts)
├── products/   (controller, service, dto/)
├── toppings/
├── auth/       (controller, service, jwt.strategy, jwt-auth.guard, dto/)
├── promotions/
├── orders/     (controller, service, dto/, order-state.ts)
├── payments/   (controller, service, mock-payment.service.ts, dto/)
└── health/
```

Mỗi module có \*.controller.ts, \*.service.ts và thư mục dto/. Gắn @ApiTags, @ApiBearerAuth, @ApiResponse để Swagger tự sinh tài liệu cho frontend.

## 10. Checklist test cho Task 10

Đề yêu cầu có test chứng minh ba điều. Gợi ý cụ thể:

**(a) Chặn chuyển trạng thái sai** (unit test, không cần DB)

- PENDING → READY ném INVALID_TRANSITION.

- COMPLETED → PAID và CANCELLED → PENDING đều bị chặn.

- Đường đi hợp lệ PENDING → PAID → PREPARING → READY → COMPLETED đều qua.

- PAYMENT_FAILED → PAID (thử lại) qua được.

**(b) Idempotency** (integration test, cần DB test)

- Gửi POST /payments 2 lần cùng Idempotency-Key và cùng body → chỉ có **1 bản ghi Payment**, lần 2 trả đúng response và status của lần 1 kèm header Idempotent-Replayed: true, điểm thưởng chỉ cộng **một lần**.

- Gửi song song 5 request cùng key bằng Promise.all → vẫn chỉ 1 Payment **và MockPaymentService.charge chỉ được gọi 1 lần** (dùng vi.spyOn của Vitest rồi kiểm tra toHaveBeenCalledTimes(1)).

- Cùng key nhưng khác method hoặc khác mockResult → 422.

- Dùng key của người khác → 422, không lộ response cũ.

- Hai key khác nhau cùng thanh toán một đơn song song → chỉ một request gọi gateway, request còn lại nhận 409 (PAYMENT_IN_PROGRESS hoặc INVALID_TRANSITION).

**(c) Đặt đồng thời không vượt tồn kho** (integration test)

- Product có stock = 5. Cho 10 user gọi POST /orders mua 1 phần cùng lúc bằng Promise.all → đúng **5 đơn thành công, 5 đơn 409 OUT_OF_STOCK**, stock cuối bằng 0 và không âm.

- Không request nào được nhận STOCK_CONFLICT khi kho vẫn còn hàng: số lần thử lại phải đủ lớn (xem mục 4.2).

- Một giỏ có 2 sản phẩm, sản phẩm thứ hai hết hàng → **không** có đơn nào được tạo, stock sản phẩm thứ nhất không đổi (rollback).

**(d) Khuyến mãi và điểm**

- Mã PERCENT có trần maxDiscount hoạt động đúng; mã hết hạn bị từ chối.

- Thanh toán đơn 110.700đ cộng 110 điểm; hủy đơn PAID trừ lại 110 điểm và hoàn kho.

Dùng một CSDL Postgres riêng cho test (database brewlite_test trong cùng container), reset bằng prisma migrate reset trước khi chạy.

## 11. Điểm cần chốt với giảng viên và giả định đang dùng

| Câu hỏi                                            | Giả định hiện tại                                                                                                                                                                                                               |
|----------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tồn kho tính theo sản phẩm hay nguyên liệu?        | Theo **sản phẩm** (Product.stock) cho đơn giản                                                                                                                                                                                  |
| Giá có đổi theo size không?                        | Có: S +0, M +5.000, L +10.000 (wireframe cho thấy không đổi, cần xác nhận)                                                                                                                                                      |
| Mock payment làm đến mức nào?                      | Hàm giả lập trong NestJS, có mockResult để ép thành công hoặc thất bại                                                                                                                                                          |
| Hủy đơn đã PAID có hoàn tiền không?                | Có, ghi nhận mock, không có bảng Refund                                                                                                                                                                                         |
| Chức năng barista | Có trang Barista (mở rộng, làm sau phần bắt buộc): xem hàng đợi, đổi trạng thái, nhập kho |
| Giữ hàng từ lúc nào?                               | Từ lúc POST /orders, hoàn khi CANCELLED                                                                                                                                                                                         |
| Mã giảm giá dùng được mấy lần mỗi người?           | Không giới hạn theo user, chỉ giới hạn tổng usageLimit                                                                                                                                                                          |
| Đơn PENDING và PAYMENT_FAILED có tự hết hạn không? | Không (giới hạn MVP): kho chỉ hoàn khi hủy chủ động. Nếu còn thời gian, thêm expiresAt và cron tự hủy sau 15 phút                                                                                                               |
| Test (b) "chỉ tạo 1 đơn" hiểu thế nào?             | Hiểu là một lần thanh toán chỉ tạo 1 Payment và đơn chỉ chuyển PAID một lần. Nếu giảng viên muốn cả POST /orders chống tạo trùng, thêm Idempotency-Key tùy chọn cho POST /orders (lưu Order.idempotencyKey, unique theo userId) |
| Payment kẹt ở PROCESSING khi server sập giữa chừng | Giới hạn MVP, xử lý tay. Hướng cải thiện: PROCESSING quá 2 phút thì coi như FAILED                                                                                                                                              |

Những mục nào giảng viên không phản đối thì ghi vào biên bản Sprint Planning làm quyết định chính thức của nhóm.

## 12. Đối chiếu với đề bài: cái nào đúng đề, cái nào mình thêm

Cả 7 endpoint và 5 thực thể trong mục 12 của đề đều có trong tài liệu; phần còn lại mình thêm để luồng chạy được và để làm Task 10. Ký hiệu: **Đúng đề** là đề ghi rõ; **Thêm** là đề không ghi, mình bổ sung; **Giả định** là đề không nói rõ, mình tự chọn và cần chốt với giảng viên.

### 12.1. Endpoint (đối chiếu mục 12.1 của đề)

| Endpoint                  | Có trong đề | Đánh giá | Phần mình thêm hoặc ghi chú                                                          |
|---------------------------|-------------|----------|--------------------------------------------------------------------------------------|
| GET /products             | Có          | Đúng đề  | Thêm search, category, phân trang, trường stock, category; response bọc {data, meta} |
| GET /products/:id         | Có          | Đúng đề  | Thêm mảng sizes và toppings trong response                                           |
| POST /auth/register       | Có          | Đúng đề  | Thêm fullName, quy tắc mật khẩu                                                      |
| POST /auth/login          | Có          | Đúng đề  | Thêm role trong JWT, expiresIn                                                       |
| POST /orders              | Có          | Đúng đề  | Thêm promoCode, note, server tính lại giá, giữ tồn kho                               |
| POST /payments            | Có          | Đúng đề  | Thêm mockResult, mã 402 khi thất bại, replay trả lại đúng status của lần đầu         |
| GET /orders/me            | Có          | Đúng đề  | Thêm phân trang, lọc status                                                          |
| GET /toppings             | Không       | Thêm     | Phục vụ Task 4; bỏ được vì topping đã nhúng trong GET /products/:id                  |
| GET /auth/me              | Không       | Thêm     | Kiểm tra token còn hạn, lấy điểm mới nhất                                            |
| POST /promotions/validate | Không       | Thêm     | Xem trước số tiền giảm ở trang giỏ hàng (Task 10)                                    |
| GET /orders/:id           | Không       | Thêm     | Màn hình xác nhận và chi tiết đơn (Task 9)                                           |
| POST /orders/:id/cancel   | Không       | Thêm     | Cần để có chuyển tiếp sang CANCELLED (Task 10)                                       |
| PATCH /orders/:id/status  | Không       | Thêm     | Barista đổi trạng thái; cũng dùng để demo state machine (Task 10)                   |
| GET /health               | Không       | Thêm     | Healthcheck cho Docker (Task 1, 9)                                                   |

### 12.2. Thực thể (đối chiếu mục 12.2 của đề)

| Thực thể           | Cột đề yêu cầu (đúng đề)                     | Cột hoặc bảng mình thêm                                                      |
|--------------------|----------------------------------------------|------------------------------------------------------------------------------|
| Product            | id, name, price, imageUrl, stock             | description, category, version, isActive                                     |
| User               | id, email, passwordHash, loyaltyPoints       | fullName, role, createdAt                                                    |
| Order              | id, userId, status, total, createdAt         | subtotal, discountAmount, promoCode, pointsEarned, updatedAt                 |
| OrderItem          | id, orderId, productId, size, qty, lineTotal | productName, toppings, unitPrice, note                                       |
| Payment            | id, orderId, idempotencyKey, amount, method  | requestHash, status, providerRef, failureReason, responseSnapshot, createdAt |
| Topping            | Không có trong đề                            | Bảng mới                                                                     |
| PromoCode          | Không có trong đề                            | Bảng mới                                                                     |
| LoyaltyTransaction | Không có trong đề                            | Bảng mới, tùy chọn                                                           |

### 12.3. Đối chiếu từng Task

| Task                            | Đề yêu cầu                                                                                               | Tài liệu đáp ứng (đúng đề)                                    | Mình thêm hoặc giả định                                                                                                                                                |
|---------------------------------|----------------------------------------------------------------------------------------------------------|---------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Khởi tạo dự án              | Monorepo, chạy được "Hello", README, Git, .env.example                                                   | Cấu trúc frontend/ và backend/, README, .env.example          | Thêm Prisma schema, seed, GET /health                                                                                                                                  |
| 2\. API danh sách sản phẩm      | GET /products trả id, tên, giá, ảnh                                                                      | Đủ 4 trường id, name, price, imageUrl                         | Thêm lọc, phân trang, stock. Response bọc {data, meta} thay vì mảng trần                                                                                               |
| 3\. Trang Menu                  | Frontend gọi /products, có loading và empty state                                                        | Không có API riêng; danh sách rỗng trả 200 với data: \[\]     | Không thêm gì phía API                                                                                                                                                 |
| 4\. Chi tiết và tùy chọn        | Chọn size S/M/L và topping, tính giá                                                                     | GET /products/:id, công thức giá ở mục 4.1                    | Thêm bảng Topping, GET /toppings. **Giả định:** phụ thu size +0/+5.000/+10.000 và giá topping (đề không có số)                                                         |
| 5\. Giỏ hàng                    | Thêm, sửa, xóa, tự tính tổng, badge                                                                      | Giỏ nằm ở frontend, không có API                              | Không thêm gì                                                                                                                                                          |
| 6\. API tạo đơn                 | POST /orders nhận giỏ, validate, lưu PENDING, trả mã đơn                                                 | Đủ các ý trên                                                 | Thêm server tính lại giá, chụp lại tên và giá, mã dạng \#id. Bản Task 6 cơ bản chưa có khuyến mãi và khóa kho                                                          |
| 7\. Đăng ký, đăng nhập          | /auth/register, /auth/login, bcrypt, JWT, guard                                                          | Đủ các ý trên; JWT bảo vệ các route đặt đơn                   | Thêm GET /auth/me, role, fullName, quy tắc mật khẩu, JWT hạn 1 ngày                                                                                                    |
| 8\. Thanh toán không tiền mặt   | Mock payment, chọn Ví hoặc Thẻ, PAID hoặc PAYMENT_FAILED                                                 | method là WALLET hoặc CARD, đơn chuyển đúng hai trạng thái    | Thêm mockResult, providerRef. **Giả định:** thất bại trả HTTP 402                                                                                                      |
| 9\. Xác nhận, lịch sử, bàn giao | Màn xác nhận (mã đơn, trạng thái), GET /orders/me, docker-compose, README, demo                          | GET /orders/me; dữ liệu mã đơn và trạng thái cho màn xác nhận | Thêm GET /orders/:id, phân trang. Docker, README, demo không thuộc phần API                                                                                            |
| 10\. Nghiệp vụ backend          | State machine, thanh toán idempotent, tồn kho đồng thời, khuyến mãi và điểm thưởng; 3 test (a), (b), (c) | Đủ 4 nghiệp vụ và 3 test mà đề yêu cầu                        | Thêm cancel, PATCH status, promotions/validate, PromoCode, LoyaltyTransaction, test (d). **Giả định:** 1 điểm cho mỗi 1.000đ; hủy đơn đã PAID thì hoàn kho và trừ điểm |

### 12.4. Điểm khác đề cần nhớ khi báo cáo

- Response danh sách bọc {data, meta}: frontend đọc .data, không phải mảng trần như đề mô tả.

- Mã 402 cho thanh toán thất bại là lựa chọn của nhóm, đề không quy định; gửi lại cùng key thì nhận lại đúng status của lần đầu.

- Phụ thu size và giá topping là số giả định. Wireframe của đề cho thấy giá không đổi theo size.

- Sơ đồ trạng thái của đề có ba mũi tên hủy nhưng không ghi rõ xuất phát từ đâu; mình suy ra là PENDING, PAYMENT_FAILED và PAID.

- Nếu thiếu thời gian, có thể cắt mà không mất yêu cầu nào của đề: GET /toppings, GET /auth/me, POST /promotions/validate, LoyaltyTransaction, GET /health. Nên giữ PATCH /orders/:id/status và cancel để demo được state machine.

Đề ghi chức năng nhân viên quầy là phần mở rộng ngoài MVP, nên các mục (B) không tính điểm 10 task. Chỉ làm sau khi xong các mục bắt buộc.

### 12.6. Quản lý kho theo công thức nguyên liệu (v1.3)

Chi tiết đặc tả đầy đủ xem tại `apicongthuc.md`:
- Chuyển toàn bộ kho từ số ly `Product.stock` sang nguyên liệu `Ingredient.stock` và công thức `ProductRecipe`, `ToppingRecipe`.
- Bổ sung nhóm API nguyên liệu 🔒B: `GET /ingredients`, `POST /ingredients`, `PATCH /ingredients/:id`, `POST /ingredients/:id/stock`, `POST /ingredients/:id/adjust`, `GET /ingredients/:id/movements`.
- Bổ sung nhóm API công thức 🔒B: `GET/PUT /products/:id/recipe`, `GET/PUT /toppings/:id/recipe`.
- Nâng cấp `POST /orders` và `POST /orders/:id/cancel` trừ kho và hoàn kho theo snapshot nguyên liệu `OrderItem.consumption`.
- Xóa bỏ các cột cũ `Product.stock` và `Product.version`.