# Prompt: chuyển kho BrewLite từ "số ly" sang "công thức nguyên liệu"

Copy toàn bộ phần trong khung dưới đây và đưa cho trợ lý lập trình (hoặc dùng làm đề bài cho thành viên). Cần đính kèm thư mục repo và file `docs/api-kho-cong-thuc.md`.

---

````text
Bạn là kỹ sư backend NestJS. Hãy chuyển cơ chế tồn kho của dự án BrewLite từ
"số ly của sản phẩm" (Product.stock) sang "nguyên liệu theo công thức".
Mua 1 ly thì server trừ các nguyên liệu tương ứng.

## Bối cảnh dự án
- backend/: NestJS (ESM, mọi import nội bộ phải có đuôi .js), Prisma 7 với
  @prisma/adapter-pg, PostgreSQL 16, Vitest (KHÔNG phải Jest), class-validator
  (ValidationPipe whitelist + forbidNonWhitelisted + transform), JWT/Passport,
  Swagger tại /api/docs, global prefix /api.
- Tiền là số nguyên VND. Giá do server tính (common/pricing/PricingService).
- Lỗi trả đúng dạng { statusCode, code, message, details?, path, timestamp }
  qua common/filters/all-exceptions.filter.ts.
- Hiện tại tồn kho dùng Product.stock + Product.version (optimistic locking,
  thử lại tối đa 10 lần, sắp xếp theo id), và có 3 nhóm test đang xanh:
  (a) state machine chặn chuyển trạng thái sai, (b) cùng Idempotency-Key chỉ
  tạo 1 Payment, (c) đặt đồng thời không vượt tồn kho.

## Việc đầu tiên: ĐỌC, chưa sửa
Đọc kỹ trước khi viết code, rồi tóm tắt cho tôi trong tối đa 15 dòng:
1. docs/api-kho-cong-thuc.md (đặc tả đầy đủ, là nguồn sự thật cho việc này).
2. backend/prisma/schema.prisma, các migration, prisma/seed.ts.
3. src/orders (service, controller, hàm giữ kho, hàm hủy đơn, test hiện có).
4. src/products, src/common/pricing, src/payments (chỉ để biết điểm nào đang
   dùng Product.stock hoặc Product.version).
Dùng grep tìm MỌI chỗ tham chiếu stock và version của Product.

## Nguyên tắc bắt buộc
1. Kho chỉ lưu nguyên liệu. Số ly còn bán được là số TÍNH RA, không lưu.
2. Công thức tách khỏi giá: RecipeService tính nguyên liệu, PricingService
   tính tiền. Hai service không gọi nhau.
3. Mọi thay đổi Ingredient.stock phải ghi 1 dòng StockMovement TRONG CÙNG
   transaction.
4. Tồn kho là số nguyên theo đơn vị nhỏ nhất (g, ml, cái). Không dùng số thực.
5. Nhu cầu của đơn phải GỘP theo ingredientId trên toàn đơn trước khi so với
   tồn kho (hai món cùng dùng sữa thì cộng lại).
6. Trừ kho: sắp xếp theo ingredientId tăng dần; updateMany có điều kiện
   version + stock >= cần; lệch version mà còn đủ hàng thì thử lại cả giao dịch
   (tối đa 10 lần, nghỉ ngẫu nhiên 10-50 ms); thiếu thật thì OUT_OF_STOCK;
   một nguyên liệu lỗi thì rollback cả đơn.
7. Lưu snapshot OrderItem.consumption lúc đặt; hủy đơn hoàn đúng theo snapshot,
   không tính lại từ công thức hiện tại.
8. Sản phẩm không có công thức = hết hàng (inStock=false), POST /orders trả
   409 RECIPE_MISSING. Không được coi là "không tốn nguyên liệu".
9. Giữ nguyên hình dạng response của GET /products và GET /products/:id để
   Frontend không phải sửa (chỉ thêm trường mới theo đặc tả).
10. Không phá test (a) và (b). Test (c) được viết lại theo nguyên liệu.

## Các bước thực hiện (làm lần lượt, xong bước nào báo cáo bước đó)
Làm trên nhánh mới feature/be-ingredient-recipes. Không động vào nhánh chính.

Bước 1. Schema và seed
- Thêm Ingredient, ProductRecipe, ToppingRecipe, StockMovement, enum
  IngredientUnit và StockMovementType, cột OrderItem.consumption (Json).
- Migration kèm CHECK (stock >= 0) cho Ingredient, UNIQUE (productId,
  ingredientId) và UNIQUE (toppingId, ingredientId).
- CHƯA xóa Product.stock và Product.version.
- Seed: khoảng 8-10 nguyên liệu (cà phê, sữa tươi, sữa đặc, đường, muối, trà,
  đào, ly, trân châu...) và công thức (size M) cho cả 10 sản phẩm và 3 topping.
  Giữ "Cà phê muối" là món giới hạn: tồn muối chỉ đủ cho đúng 5 ly size M, để
  test đồng thời tái sử dụng được.

Bước 2. RecipeService (thuần logic, test trước)
- common/recipe/recipe.constants.ts: SizeFactor S=0.8, M=1.0, L=1.3.
- calculateLine(product, size, toppings, qty) và calculateOrder(items) trả về
  Map<ingredientId, quantity> đã gộp. Làm tròn LÊN ở bước nhân size, trước khi
  nhân qty.
- maxCups(product, size, stockMap): min theo nguyên liệu của floor(tồn/cần).
- Unit test không cần DB: làm tròn (18g x 0.8 -> 15), gộp nhiều dòng cùng
  nguyên liệu, topping, sản phẩm không có công thức.

Bước 3. Đổi giữ kho và hoàn kho
- reserveStock(tx, items) và releaseStock(tx, order) chuyển sang nguyên liệu
  theo nguyên tắc 5-7.
- Ghi StockMovement ORDER_RESERVE / ORDER_RELEASE; lưu consumption.
- OUT_OF_STOCK có details theo mẫu trong docs (tên nguyên liệu, available,
  required, danh sách món bị ảnh hưởng).
- Viết lại test (c): nguyên liệu đủ cho 5 ly, 10 đơn song song bằng
  Promise.all -> đúng 5 thành công, 5 OUT_OF_STOCK, tồn cuối bằng 0. Thêm test
  gộp theo nguyên liệu, rollback khi một trong hai nguyên liệu hết, hoàn kho
  đúng snapshot sau khi đổi công thức, và bất biến (tồn = ban đầu + tổng
  StockMovement).

Bước 4. Endpoint
- Ingredients: GET, POST, PATCH, POST /:id/stock, POST /:id/adjust,
  GET /:id/movements. Recipes: GET/PUT /products/:id/recipe,
  GET/PUT /toppings/:id/recipe. Tất cả role BARISTA (dùng RolesGuard sẵn có).
- DTO có class-validator, Swagger đầy đủ (@ApiTags, @ApiBearerAuth,
  @ApiResponse), mã lỗi đúng bảng trong docs.
- GET /products và GET /products/:id: stock và inStock tính ra từ nguyên liệu,
  thêm limitedBy, maxCups theo size, available theo topping.
- Test phân quyền: không token -> 401, token khách -> 403.

Bước 5. Dọn dẹp (chỉ làm khi bước 1-4 đã xanh)
- Bỏ Product.stock, Product.version và mọi chỗ dùng chúng; migration xóa cột.
- Chạy lại toàn bộ test.

## Định nghĩa hoàn thành
- npm run lint, npm test, npm run build đều qua.
- Test (a), (b), (c mới) đều xanh; test (c) chạy ổn định, lặp 5 lần không chập chờn.
- Seed chạy được trên DB trống: docker compose up, prisma migrate deploy,
  prisma db seed, rồi gọi thử GET /api/products, POST /api/orders.
- docs/api.md được cập nhật theo thay đổi thực tế (nếu code khác đặc tả, sửa tài
  liệu trong cùng PR và nói rõ).
- Mô tả PR: đã đổi gì, migration nào, cách chạy lại seed, rủi ro còn lại.

## Cách làm việc
- Mỗi bước kết thúc bằng một báo cáo ngắn: đã làm gì, test nào chạy, điểm nào
  chưa chắc. Không đoán tên trường hay tên file: nếu không thấy trong repo thì
  hỏi tôi.
- Nếu một quy tắc trong prompt mâu thuẫn với code hiện có, dừng lại và nêu mâu
  thuẫn, đừng tự chọn.
- Không thêm tính năng ngoài danh sách trên.
````