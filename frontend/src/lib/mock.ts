/**
 * Dữ liệu giả cho frontend, bám đúng hình dạng response trong api.md.
 *
 * Dùng khi:
 *  - Đặt NEXT_PUBLIC_USE_MOCK=true trong .env.local: chạy toàn bộ trang mà không cần backend.
 *  - Backend chưa khai báo route (404 "Cannot GET ..."): các trang gọi trực tiếp mockApi()
 *    để vẫn dựng được giao diện và hiện nhãn "Dữ liệu mẫu".
 *
 * Khi backend đã có API thật thì không cần sửa gì: frontend tự dùng dữ liệu thật.
 */
import { ApiError } from "./api-error";
import type { Paginated, User } from "./api";

type Size = "S" | "M" | "L";

const MOCK_PRODUCTS = [
  { id: 1, name: "Cà phê sữa", price: 35000, category: "Cà phê", stock: 50, imageUrl: "/img/ca-phe-sua.jpg", description: "Cà phê phin pha sữa đặc" },
  { id: 2, name: "Americano", price: 40000, category: "Cà phê", stock: 50, imageUrl: "/img/americano.jpg", description: "Espresso pha loãng với nước nóng" },
  { id: 3, name: "Cappuccino", price: 45000, category: "Cà phê", stock: 40, imageUrl: "/img/cappuccino.jpg", description: "Espresso, sữa nóng và lớp bọt sữa" },
  { id: 4, name: "Trà đào", price: 39000, category: "Trà", stock: 40, imageUrl: "/img/tra-dao.jpg", description: "Trà đen, đào ngâm và sả" },
  { id: 5, name: "Latte", price: 48000, category: "Cà phê", stock: 30, imageUrl: "/img/latte.jpg", description: "Espresso với nhiều sữa tươi" },
  { id: 6, name: "Bạc xỉu", price: 38000, category: "Cà phê", stock: 40, imageUrl: "/img/bac-xiu.jpg", description: "Nhiều sữa, ít cà phê" },
  { id: 7, name: "Trà vải", price: 42000, category: "Trà", stock: 35, imageUrl: "/img/tra-vai.jpg", description: "Trà hoa nhài với vải" },
  { id: 8, name: "Trà sữa trân châu", price: 45000, category: "Trà", stock: 35, imageUrl: "https://i.pinimg.com/736x/1f/ad/3e/1fad3ecea5d5ab66b814a8e01d79eedd.jpg", description: "Trà sữa truyền thống" },
  { id: 9, name: "Matcha đá xay", price: 52000, category: "Đá xay", stock: 25, imageUrl: "https://i.pinimg.com/736x/52/6d/87/526d8790f1ef5d72d9ff8b015b8c4367.jpg", description: "Matcha xay cùng đá và sữa" },
  { id: 10, name: "Cà phê muối", price: 42000, category: "Cà phê", stock: 0, imageUrl: "https://i.pinimg.com/736x/cc/9d/41/cc9d41202afe34f486473c407c3ba05f.jpg", description: "Đang hết hàng (để test trạng thái hết hàng)" },
];

const MOCK_TOPPINGS = [
  { id: 1, name: "Trân châu đen", price: 5000 },
  { id: 2, name: "Kem cheese", price: 7000 },
  { id: 3, name: "Thạch dừa", price: 4000 },
  { id: 4, name: "Trân châu trắng", price: 5000 },
  { id: 5, name: "Pudding trứng", price: 6000 },
  { id: 6, name: "Kem macchiato", price: 8000 },
  { id: 7, name: "Đào miếng", price: 6000 },
];

const MOCK_SIZES: { size: Size; surcharge: number }[] = [
  { size: "S", surcharge: 0 },
  { size: "M", surcharge: 5000 },
  { size: "L", surcharge: 10000 },
];

const MOCK_PROMOS = [
  { code: "BREW10", type: "PERCENT" as const, value: 10, minOrderValue: 50000, maxDiscount: 30000 as number | null, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2027-12-31T23:59:59Z", usageLimit: null as number | null, usedCount: 0 },
  { code: "GIAM15K", type: "FIXED" as const, value: 15000, minOrderValue: 80000, maxDiscount: null, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2027-12-31T23:59:59Z", usageLimit: 100, usedCount: 3 },
  { code: "HETHAN", type: "PERCENT" as const, value: 20, minOrderValue: 0, maxDiscount: null, startsAt: "2025-01-01T00:00:00Z", expiresAt: "2025-12-31T23:59:59Z", usageLimit: null, usedCount: 0 },
  { code: "SAPTOI", type: "FIXED" as const, value: 10000, minOrderValue: 0, maxDiscount: null, startsAt: "2030-01-01T00:00:00Z", expiresAt: "2030-12-31T23:59:59Z", usageLimit: null, usedCount: 0 },
  { code: "HETLUOT", type: "FIXED" as const, value: 10000, minOrderValue: 0, maxDiscount: null, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2027-12-31T23:59:59Z", usageLimit: 50, usedCount: 50 },
];

const MOCK_USER: User = { id: 1, email: "demo@brewlite.com", fullName: "Khách Demo", role: "CUSTOMER", loyaltyPoints: 245 };

const STATUSES = ["COMPLETED", "PAID", "PREPARING", "READY", "PENDING", "PAYMENT_FAILED", "CANCELLED"] as const;
const MOCK_ORDERS = Array.from({ length: 13 }, (_, i) => {
  const id = 1042 - i;
  const total = 35000 + ((i * 17000) % 120000);
  return {
    id,
    code: `#${id}`,
    status: STATUSES[i % STATUSES.length],
    total,
    itemCount: (i % 4) + 1,
    createdAt: new Date(Date.UTC(2026, 9, 26 - i, 2 + (i % 8), 30)).toISOString(),
  };
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bật chế độ dữ liệu giả cho toàn bộ app (chỉ dùng khi chạy thử không có backend). */
export const MOCK_ENABLED = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const MOCK_ROUTES = [/^\/products(\?|$)/, /^\/products\/[^/?]+$/, /^\/auth\/login$/, /^\/auth\/me$/, /^\/orders\/me(\?|$)/, /^\/promotions\/validate$/];

export function shouldUseMock(path: string) {
  return MOCK_ENABLED && MOCK_ROUTES.some((route) => route.test(path));
}

function requireAuth() {
  if (typeof window === "undefined") throw new ApiError("Thiếu hoặc sai JWT", 401, "UNAUTHORIZED");
  const token = localStorage.getItem("brewlite_access_token") ?? (() => {
    try { return (JSON.parse(localStorage.getItem("brewlite.auth") ?? "null") as { accessToken?: string } | null)?.accessToken ?? null; }
    catch { return null; }
  })();
  if (!token) throw new ApiError("Thiếu hoặc sai JWT", 401, "UNAUTHORIZED");
}

type ValidateBody = { code: string; items: { productId: number; size: Size; toppingIds: number[]; quantity: number }[] };

/** Mô phỏng PricingService.calculate() + quy tắc khuyến mãi (api.md mục 4.1 và 4.3). */
function validatePromo(body: ValidateBody) {
  const subtotal = body.items.reduce((sum, item) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === item.productId);
    if (!product) throw new ApiError(`Không tìm thấy sản phẩm #${item.productId}`, 404, "PRODUCT_NOT_FOUND", [{ productId: item.productId }]);
    const surcharge = MOCK_SIZES.find((s) => s.size === item.size)?.surcharge ?? 0;
    const toppingTotal = item.toppingIds.reduce((t, id) => t + (MOCK_TOPPINGS.find((x) => x.id === id)?.price ?? 0), 0);
    return sum + (product.price + surcharge + toppingTotal) * item.quantity;
  }, 0);

  const code = body.code.trim().toUpperCase();
  const promo = MOCK_PROMOS.find((p) => p.code === code);
  const now = Date.now();
  if (!promo) throw new ApiError(`Mã ${code} không tồn tại`, 422, "PROMO_NOT_FOUND");
  if (now < Date.parse(promo.startsAt)) throw new ApiError(`Mã ${code} chưa đến thời gian áp dụng`, 422, "PROMO_NOT_STARTED", [{ startsAt: promo.startsAt }]);
  if (now > Date.parse(promo.expiresAt)) throw new ApiError(`Mã ${code} đã hết hạn`, 422, "PROMO_EXPIRED", [{ expiresAt: promo.expiresAt }]);
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) throw new ApiError(`Mã ${code} đã hết lượt sử dụng`, 422, "PROMO_USAGE_EXCEEDED");
  if (subtotal < promo.minOrderValue) throw new ApiError(`Đơn tối thiểu ${promo.minOrderValue}đ để dùng mã ${code}`, 422, "PROMO_MIN_ORDER_NOT_MET", [{ minOrderValue: promo.minOrderValue, subtotal }]);

  const discountAmount = promo.type === "PERCENT"
    ? Math.min(Math.floor((subtotal * promo.value) / 100), promo.maxDiscount ?? Infinity)
    : Math.min(promo.value, subtotal);
  return { code, type: promo.type, value: promo.value, subtotal, discountAmount, totalAfterDiscount: subtotal - discountAmount };
}

export async function mockApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  await delay(300);
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : undefined;

  if (method === "GET" && pathname === "/products") {
    const data = MOCK_PRODUCTS.map((p) => ({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, category: p.category, stock: p.stock, inStock: p.stock > 0 }));
    return { data, meta: { page: 1, limit: 50, total: data.length, totalPages: 1 } } as T;
  }

  const productMatch = pathname.match(/^\/products\/([^/]+)$/);
  if (method === "GET" && productMatch) {
    const id = Number(productMatch[1]);
    if (!Number.isInteger(id)) throw new ApiError("Validation failed (numeric string is expected)", 400, "VALIDATION_ERROR");
    const product = MOCK_PRODUCTS.find((p) => p.id === id);
    if (!product) throw new ApiError(`Không tìm thấy sản phẩm #${id}`, 404, "PRODUCT_NOT_FOUND", [{ productId: id }]);
    return { ...product, inStock: product.stock > 0, sizes: MOCK_SIZES, toppings: MOCK_TOPPINGS } as T;
  }

  if (method === "POST" && pathname === "/auth/login") {
    if (body?.email?.toLowerCase() !== MOCK_USER.email || body?.password !== "Demo@1234") {
      throw new ApiError("Email hoặc mật khẩu không đúng", 401, "INVALID_CREDENTIALS");
    }
    return { accessToken: "mock-token", tokenType: "Bearer", expiresIn: 86400, user: MOCK_USER } as T;
  }

  if (method === "GET" && pathname === "/auth/me") {
    requireAuth();
    return MOCK_USER as T;
  }

  if (method === "GET" && pathname === "/orders/me") {
    requireAuth();
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 10)));
    const status = params.get("status");
    const all = status ? MOCK_ORDERS.filter((o) => o.status === status) : MOCK_ORDERS;
    const result: Paginated<(typeof MOCK_ORDERS)[number]> = {
      data: all.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) },
    };
    return result as T;
  }

  if (method === "POST" && pathname === "/promotions/validate") {
    requireAuth();
    return validatePromo(body as ValidateBody) as T;
  }

  throw new ApiError(`Cannot ${method} /api${pathname}`, 404, "NOT_FOUND");
}
