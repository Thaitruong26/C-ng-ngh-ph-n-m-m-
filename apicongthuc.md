# BrewLite: API kho theo công thức nguyên liệu (v1.3, đề xuất)

Bổ sung cho `docs/api.md` (v1.2). Thay cách quản lý kho **theo số ly (`Product.stock`)** bằng **theo nguyên liệu** (`Ingredient.stock`). Mua 1 ly thì server trừ các nguyên liệu theo công thức.

Ký hiệu xác thực: 🔓 công khai, 🔒 cần JWT, 🔒B cần JWT role BARISTA.

## 1. Nguyên tắc

1. Kho chỉ lưu **nguyên liệu**. Số ly còn bán được là số **tính ra**, không lưu.
2. Công thức tách khỏi giá. `PricingService` tính tiền, `RecipeService` tính nguyên liệu.
3. Mọi biến động kho ghi một dòng `StockMovement` **trong cùng transaction** với lúc đổi `Ingredient.stock`.
4. Số tồn là **số nguyên theo đơn vị nhỏ nhất** (gam, ml, cái). Không dùng số thực.
5. Hủy đơn hoàn **đúng lượng đã trừ** (snapshot `OrderItem.consumption`), không tính lại từ công thức hiện tại.

## 2. Mô hình dữ liệu

### 2.1. Enum

| Enum | Giá trị |
|---|---|
| IngredientUnit | G, ML, PCS |
| StockMovementType | ORDER_RESERVE, ORDER_RELEASE, RESTOCK, ADJUST |

### 2.2. Bảng

**Ingredient**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | Int | PK |
| name | String | unique |
| unit | IngredientUnit | |
| stock | Int | `CHECK (stock >= 0)` |
| version | Int | default 0, optimistic locking |
| lowThreshold | Int | default 0, `stock <= lowThreshold` thì cảnh báo |
| createdAt | DateTime | |

**ProductRecipe**: `productId`, `ingredientId`, `quantity` (Int > 0, **ở size M**). `UNIQUE (productId, ingredientId)`.

**ToppingRecipe**: `toppingId`, `ingredientId`, `quantity` (Int > 0, cho 1 phần topping). `UNIQUE (toppingId, ingredientId)`.

**StockMovement**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | Int | PK |
| ingredientId | Int | FK |
| type | StockMovementType | |
| quantity | Int | Âm là trừ, dương là cộng, khác 0 |
| orderId | Int? | Có với ORDER_RESERVE, ORDER_RELEASE |
| userId | Int? | Có với RESTOCK, ADJUST |
| reason | String? | Lý do (bắt buộc với ADJUST) |
| createdAt | DateTime | |

**OrderItem** thêm cột `consumption` (Json, default `[]`), ví dụ `[{ "ingredientId": 2, "quantity": 240 }]`.

**Bỏ dần:** `Product.stock` và `Product.version` (sau khi mọi chỗ dùng đã chuyển sang nguyên liệu).

## 3. Công thức tính

```
SizeFactor: S = 0.8, M = 1.0, L = 1.3   (đặt trong common/recipe/recipe.constants.ts)

nhuCauSanPham(ing)  = ceil( ProductRecipe[ing] × SizeFactor[size] )
nhuCauTopping(ing)  = Σ ToppingRecipe[topping][ing]            (mỗi topping 1 phần)
nhuCauMotLy(ing)    = nhuCauSanPham(ing) + nhuCauTopping(ing)
nhuCauDong(ing)     = nhuCauMotLy(ing) × qty
nhuCauDon(ing)      = Σ nhuCauDong(ing) trên mọi dòng của đơn     ← GỘP theo nguyên liệu

soLyToiDa(sp, size) = min over ing ( floor( Ingredient.stock / nhuCauMotLy(ing) ) )
```

Quy tắc: làm tròn **lên** ở bước nhân size, **trước** khi nhân `qty`. Sản phẩm **không có công thức** thì coi là hết hàng (`inStock = false`), không được coi là "không tốn gì".

## 4. Endpoint mới

### 4.1. GET /ingredients 🔒B

**Query:** `search`, `low` (`true` chỉ lấy nguyên liệu sắp hết), `page` (1), `limit` (20, tối đa 50).

```json
{
  "data": [
    { "id": 2, "name": "Sữa tươi", "unit": "ML", "stock": 1800,
      "lowThreshold": 2000, "low": true }
  ],
  "meta": { "page": 1, "limit": 20, "total": 9, "totalPages": 1 }
}
```

Không trả `version`. **Lỗi:** 400, 401, 403.

### 4.2. POST /ingredients 🔒B

**Body:** `{ "name": "Đường", "unit": "G", "stock": 5000, "lowThreshold": 500 }`. `stock` ≥ 0 (nếu > 0 thì ghi `RESTOCK` ban đầu).

**Response 201:** nguyên liệu vừa tạo. **Lỗi:** 400 VALIDATION_ERROR, 409 `INGREDIENT_ALREADY_EXISTS`.

### 4.3. PATCH /ingredients/:id 🔒B

**Body (tùy chọn từng trường):** `{ "name": "...", "lowThreshold": 800 }`. Không sửa `stock`, `unit` ở đây (đổi `stock` phải qua 4.4 hoặc 4.5 để có nhật ký).

**Response 200:** nguyên liệu. **Lỗi:** 400, 404 `INGREDIENT_NOT_FOUND`.

### 4.4. POST /ingredients/:id/stock 🔒B

Nhập thêm hàng, **cộng dồn**.

**Body:** `{ "quantity": 5000, "note": "Nhập hàng sáng" }`. `quantity` nguyên 1–1.000.000.

**Xử lý (một transaction):** cập nhật nguyên tử `stock + quantity`, `version + 1`; ghi `StockMovement(RESTOCK, +quantity, userId)`.

**Response 200:** `{ "id": 2, "name": "Sữa tươi", "unit": "ML", "stock": 6800, "low": false }`

**Lỗi:** 400, 401, 403, 404 `INGREDIENT_NOT_FOUND`.

### 4.5. POST /ingredients/:id/adjust 🔒B

Kiểm kê hoặc ghi hao hụt. Barista nhập **số tồn thực tế đếm được**, hệ thống tính chênh lệch.

**Body:** `{ "actualStock": 1750, "reason": "Đổ vỡ 50ml khi pha" }`. `actualStock` ≥ 0, `reason` bắt buộc (3–200 ký tự).

**Xử lý (một transaction):** `diff = actualStock - stock hiện tại`. Nếu `diff = 0` trả 200 không ghi gì. Ngược lại cập nhật `stock`, `version + 1`, ghi `StockMovement(ADJUST, diff, userId, reason)`.

**Response 200:** `{ "id": 2, "stock": 1750, "diff": -50 }`

**Lỗi:** 400 (thiếu `reason`), 401, 403, 404.

### 4.6. GET /ingredients/:id/movements 🔒B

Nhật ký của một nguyên liệu, mới nhất trước, có phân trang `{data, meta}`.

```json
{
  "data": [
    { "id": 91, "type": "ORDER_RESERVE", "quantity": -240, "orderId": 1042,
      "userId": null, "reason": null, "createdAt": "2026-10-29T03:10:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Lỗi:** 401, 403, 404.

### 4.7. GET /products/:id/recipe 🔒B và PUT /products/:id/recipe 🔒B

Công thức của sản phẩm, **ở size M**.

**GET 200:**
```json
{ "productId": 3, "items": [
  { "ingredientId": 1, "name": "Cà phê", "unit": "G", "quantity": 18 },
  { "ingredientId": 2, "name": "Sữa tươi", "unit": "ML", "quantity": 120 }
] }
```

**PUT body:** `{ "items": [{ "ingredientId": 1, "quantity": 18 }, { "ingredientId": 2, "quantity": 120 }] }`. **Thay toàn bộ** công thức (không trùng `ingredientId`, `quantity` nguyên > 0, tối đa 20 dòng). Gửi `items: []` nghĩa là xóa công thức (sản phẩm thành hết hàng).

**Lỗi:** 400 (trùng nguyên liệu, số không hợp lệ), 404 `PRODUCT_NOT_FOUND` hoặc `INGREDIENT_NOT_FOUND`. Đổi công thức **chỉ ảnh hưởng đơn tạo sau đó**.

### 4.8. GET /toppings/:id/recipe 🔒B và PUT /toppings/:id/recipe 🔒B

Giống 4.7 nhưng cho 1 phần topping. Lỗi 404 dùng `TOPPING_NOT_FOUND`.

## 5. Endpoint hiện có thay đổi

### 5.1. GET /products và GET /products/:id 🔓

**Response giữ nguyên hình dạng** để Frontend không phải sửa. Khác biệt:

- `stock` là **số ly tối đa tính ra ở size S** (mục 3), `inStock = stock > 0`.
- Sản phẩm không có công thức: `stock = 0`, `inStock = false`.
- `GET /products/:id` thêm vào mỗi phần tử của `sizes`: `maxCups` (số ly tối đa của size đó), và mỗi topping có `available` (đủ nguyên liệu cho ít nhất 1 phần).
- Thêm `limitedBy` (tên nguyên liệu là nút thắt, hoặc `null` nếu còn nhiều), ví dụ `"limitedBy": "Sữa tươi"`.

```json
{ "id": 3, "name": "Cà phê muối", "price": 39000, "stock": 5, "inStock": true,
  "limitedBy": "Muối",
  "sizes": [ { "code": "S", "surcharge": 0, "maxCups": 6 },
             { "code": "M", "surcharge": 5000, "maxCups": 5 },
             { "code": "L", "surcharge": 10000, "maxCups": 4 } ],
  "toppings": [ { "id": 1, "name": "Trân châu", "price": 5000, "available": true } ] }
```

Số này chỉ để **hiển thị**. Quyết định thật là bước trừ kho trong `POST /orders`.

### 5.2. POST /orders 🔒

Request không đổi. Server tính nhu cầu theo mục 3, **gộp theo nguyên liệu**, trừ trong một transaction (sắp theo `ingredientId` tăng dần, optimistic locking như mục 4.2 của `api.md`), ghi `StockMovement(ORDER_RESERVE)` và lưu `OrderItem.consumption`.

**Lỗi 409 `OUT_OF_STOCK`**, `details` nêu rõ nguyên liệu và món bị ảnh hưởng:
```json
{ "statusCode": 409, "code": "OUT_OF_STOCK",
  "message": "Không đủ Sữa tươi để pha 3 ly",
  "details": [ { "ingredientId": 2, "ingredient": "Sữa tươi", "available": 250, "required": 360,
                 "products": ["Cà phê muối", "Cappuccino"] } ],
  "path": "/api/orders", "timestamp": "..." }
```
Thêm: 409 `RECIPE_MISSING` nếu một sản phẩm trong giỏ chưa có công thức (`details` liệt kê `productId`). 409 `STOCK_CONFLICT` giữ nguyên ý nghĩa (hết lượt thử lại).

### 5.3. POST /orders/:id/cancel 🔒

Hoàn kho theo `OrderItem.consumption`: cộng lại từng nguyên liệu, `version + 1`, ghi `StockMovement(ORDER_RELEASE, +)`. Các bước còn lại và điều kiện (không hủy đơn đã PREPARING) giữ như `api.md` mục 6.11.

### 5.4. Endpoint bị thay thế

`POST /products/:id/stock` và `GET /products/:id/stock-movements` (v1.2) được **thay** bằng 4.4 và 4.6.

## 6. Mã lỗi mới

| code | HTTP | Ý nghĩa |
|---|---|---|
| INGREDIENT_NOT_FOUND | 404 | Không có nguyên liệu |
| TOPPING_NOT_FOUND | 404 | Không có topping |
| INGREDIENT_ALREADY_EXISTS | 409 | Trùng tên nguyên liệu |
| RECIPE_MISSING | 409 | Sản phẩm trong giỏ chưa có công thức |

`OUT_OF_STOCK` giữ nguyên mã, đổi nội dung `details` như 5.2.

## 7. Checklist test

- **Tính nhu cầu:** món + size + 2 topping ra đúng số; làm tròn lên đúng chỗ (size S của 18g cà phê là `ceil(14.4) = 15`).
- **Gộp theo nguyên liệu:** giỏ 3 ly cùng dùng sữa, tồn thiếu 1 phần thì đơn bị từ chối dù từng dòng riêng lẻ qua được.
- **Đồng thời (thay test c):** nguyên liệu đủ cho 5 ly, 10 đơn song song bằng `Promise.all` → đúng 5 thành công, 5 `OUT_OF_STOCK`, tồn cuối bằng 0, không âm.
- **Rollback:** món cần hai nguyên liệu, một cái hết thì nguyên liệu còn lại không bị trừ và không có đơn.
- **Hủy sau khi đổi công thức:** hoàn đúng theo snapshot.
- **Bất biến:** với mỗi nguyên liệu, `stock` = tồn ban đầu + tổng `StockMovement.quantity`.
- **Phân quyền:** token khách gọi endpoint 🔒B → 403; không token → 401.
- **Số ly tối đa:** đúng với min theo nguyên liệu; sản phẩm không công thức thì `inStock = false`.
- Test (a) state machine và (b) idempotent **không được hỏng**.

## 8. Thứ tự triển khai

1. Thêm bảng và seed nguyên liệu, công thức cho 10 sản phẩm và 3 topping (chưa bỏ `Product.stock`).
2. `RecipeService` (tính nhu cầu, gộp, số ly tối đa) kèm unit test thuần, không cần DB.
3. Đổi `reserveStock` và hoàn kho sang nguyên liệu, chạy lại test (c).
4. Endpoint 4.x và đổi `GET /products`.
5. Cuối cùng mới bỏ `Product.stock`, `Product.version`.

Làm trên nhánh riêng, chỉ merge khi toàn bộ test xanh.