"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  api,
  formatVND,
  getCachedUser,
  getToken,
  type User,
} from "@/lib/api";
import { MOCK_ENABLED, mockApi } from "@/lib/mock";
import {
  type CartItem,
  MAX_QTY_PER_ITEM,
  itemLineTotal,
  itemUnitPrice,
  selectSubtotal,
  useCartHydrated,
  useCartStore,
} from "@/store/cart";

/** Response của POST /promotions/validate (api.md mục 6.7). */
type PromoResult = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  subtotal: number;
  discountAmount: number;
  totalAfterDiscount: number;
};

/** Ánh xạ mã lỗi 422 của POST /promotions/validate sang thông báo tiếng Việt rõ ràng (api.md mục 6.7 & 7). */
function describePromoError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error
      ? err.message
      : "Không kiểm tra được mã giảm giá.";
  }
  // Nếu message từ backend đã chi tiết thì ưu tiên hiển thị trực tiếp
  if (err.message && err.message !== "Dữ liệu không hợp lệ" && err.message !== "Validation failed") {
    return err.message;
  }
  const detail = Array.isArray(err.details)
    ? (err.details[0] as Record<string, unknown> | undefined)
    : (err.details as Record<string, unknown> | undefined);
  switch (err.code) {
    case "PROMO_NOT_FOUND":
      return "Mã giảm giá không tồn tại hoặc không còn hoạt động.";
    case "PROMO_EXPIRED": {
      const exp =
        typeof detail?.expiresAt === "string"
          ? ` (hết hạn ngày ${new Date(detail.expiresAt).toLocaleDateString("vi-VN")})`
          : "";
      return `Mã giảm giá đã hết hạn${exp}.`;
    }
    case "PROMO_NOT_STARTED": {
      const start =
        typeof detail?.startsAt === "string"
          ? ` (bắt đầu từ ${new Date(detail.startsAt).toLocaleDateString("vi-VN")})`
          : "";
      return `Mã giảm giá chưa đến thời gian áp dụng${start}.`;
    }
    case "PROMO_USAGE_EXCEEDED":
      return "Mã giảm giá đã hết lượt sử dụng.";
    case "PROMO_MIN_ORDER_NOT_MET": {
      const min =
        typeof detail?.minOrderValue === "number"
          ? formatVND(detail.minOrderValue)
          : null;
      return min
        ? `Đơn hàng chưa đạt giá trị tối thiểu ${min} để dùng mã này.`
        : err.message || "Đơn hàng chưa đạt giá trị tối thiểu.";
    }
    case "UNAUTHORIZED":
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    default:
      return err.message || "Không thể áp dụng mã giảm giá lúc này.";
  }
}

export default function CartPage() {
  const hydrated = useCartHydrated();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const setStorePromoCode = useCartStore((s) => s.setPromoCode);

  const signedIn = hydrated && Boolean(getToken());

  // Lấy điểm thưởng từ GET /auth/me; nếu backend chỉ trả JWT payload thì đọc từ user đã lưu lúc đăng nhập.
  const { data: me } = useQuery({
    queryKey: ["me"],
    enabled: signedIn,
    queryFn: async () => {
      try {
        const user = await api<User>("/auth/me");
        if (typeof user.loyaltyPoints === "number") return user;
        return { ...getCachedUser(), ...user };
      } catch {
        return getCachedUser();
      }
    },
  });
  const loyaltyPoints =
    typeof me?.loyaltyPoints === "number" ? me.loyaltyPoints : null;

  // Khuyến mãi: gắn với chữ ký giỏ hàng để khi đổi món/số lượng thì kết quả kiểm tra cũ tự hết hiệu lực.
  const cartSignature = items.map((i) => `${i.key || i.id}:${i.quantity ?? i.qty}`).join("|");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [applied, setApplied] = useState<{
    sig: string;
    data: PromoResult;
    fromMock: boolean;
  } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const promo = applied && applied.sig === cartSignature ? applied.data : null;
  const promoStale = Boolean(applied && applied.sig !== cartSignature);
  const discount = promo ? promo.discountAmount : 0;
  const total = promo ? promo.totalAfterDiscount : subtotal;
  // Quy tắc điểm thưởng (api.md mục 4.4): 1 điểm cho mỗi 1.000đ của total, làm tròn xuống.
  const estimatedPoints = Math.floor(total / 1000);

  async function validatePromo(e: React.FormEvent) {
    e.preventDefault();
    setPromoError("");
    setApplied(null);
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      setPromoError("Vui lòng nhập mã giảm giá.");
      return;
    }
    if (!getToken()) {
      setPromoError("Vui lòng đăng nhập trước khi kiểm tra mã giảm giá.");
      return;
    }
    if (!items.length) {
      setPromoError("Hãy thêm món vào giỏ trước.");
      return;
    }

    const body = JSON.stringify({
      code,
      items: items.map((item) => ({
        productId: item.productId,
        size: item.size,
        toppingIds: (item.toppings || []).map((t) => t.id),
        quantity: item.quantity ?? item.qty ?? 1,
      })),
    });
    setPromoLoading(true);
    try {
      const result = await api<PromoResult>("/promotions/validate", {
        method: "POST",
        body,
      });
      setApplied({ sig: cartSignature, data: result, fromMock: false });
      setStorePromoCode(result.code, result.discountAmount);
    } catch (err) {
      // Backend đang trong quá trình phát triển (chưa có POST /promotions/validate):
      // Tự chuyển sang mockApi để trang giỏ vẫn thử được các mã BREW10, GIAM15K, HETHAN.
      if (err instanceof ApiError && err.isMissingRoute && !MOCK_ENABLED) {
        try {
          const fallback = await mockApi<PromoResult>(
            "/promotions/validate",
            { method: "POST", body },
          );
          setApplied({ sig: cartSignature, data: fallback, fromMock: true });
          setStorePromoCode(fallback.code, fallback.discountAmount);
          return;
        } catch (mockErr) {
          setPromoError(describePromoError(mockErr));
          return;
        }
      }
      setPromoError(describePromoError(err));
    } finally {
      setPromoLoading(false);
    }
  }

  const handleCheckoutClick = () => {
    if (promo) {
      setStorePromoCode(promo.code, promo.discountAmount);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-[#183d2c]">Giỏ hàng</h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-semibold text-stone-500 hover:text-red-700 hover:underline"
          >
            Xóa hết ({items.length} món)
          </button>
        )}
      </div>

      {!hydrated ? (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Đang tải giỏ hàng...
        </div>
      ) : items.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-12 text-center shadow-sm">
          <p className="text-5xl">☕</p>
          <h2 className="mt-4 text-xl font-bold text-stone-900">
            Giỏ hàng đang trống
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Hãy chọn một ly cà phê đậm vị hoặc tách trà thanh mát để bắt đầu ngày
            mới.
          </p>
          <Link
            href="/menu"
            className="mt-6 inline-block rounded-xl bg-amber-800 px-6 py-3 font-semibold text-white hover:bg-amber-900"
          >
            Khám phá thực đơn
          </Link>
        </section>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <section
            aria-label="Danh sách món trong giỏ"
            className="space-y-4 lg:col-span-2"
          >
            {items.map((item) => (
              <CartRow
                key={item.key || item.id}
                item={item}
                setQuantity={setQuantity}
                removeItem={removeItem}
              />
            ))}
          </section>

          <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-[#183d2c]">
              Tóm tắt đơn hàng
            </h2>

            {signedIn && loyaltyPoints !== null && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
                <p>
                  Điểm tích lũy hiện có:{" "}
                  <strong>{loyaltyPoints.toLocaleString("vi-VN")} điểm</strong>
                </p>
                <p className="mt-0.5 text-amber-900/80">
                  Đơn này sẽ tích lũy thêm khoảng +
                  {estimatedPoints.toLocaleString("vi-VN")} điểm sau khi hoàn tất.
                </p>
              </div>
            )}

            <form onSubmit={validatePromo} className="mt-5">
              <label
                htmlFor="promo-input"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600"
              >
                Mã giảm giá
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="promo-input"
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  placeholder="Nhập mã (ví dụ: BREW10)"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-amber-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={promoLoading}
                  className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                >
                  {promoLoading ? "Đang kiểm tra..." : "Áp dụng"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-stone-500">
                Mã mẫu trong seed: <code className="font-mono">BREW10</code>,{" "}
                <code className="font-mono">GIAM15K</code>.
              </p>
            </form>

            {promoStale && (
              <p
                role="status"
                className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                Giỏ hàng vừa thay đổi — bấm Áp dụng để kiểm tra lại mã giảm giá.
              </p>
            )}
            {promoError && (
              <p
                role="alert"
                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {promoError}
              </p>
            )}
            {promo && (
              <div
                role="status"
                className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                Đã áp mã <strong>{promo.code}</strong> (
                {promo.type === "PERCENT"
                  ? `giảm ${promo.value}%`
                  : `giảm ${formatVND(promo.value)}`}
                ) — tiết kiệm {formatVND(promo.discountAmount)}.
              </div>
            )}

            <dl className="mt-6 space-y-3 border-t border-stone-200 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-600">Tạm tính</dt>
                <dd>{formatVND(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600">
                  Giảm giá{promo ? ` (${promo.code})` : ""}
                </dt>
                <dd
                  className={
                    discount ? "font-semibold text-emerald-700" : ""
                  }
                >
                  −{formatVND(discount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-4 text-base font-bold">
                <dt>Tổng cộng dự kiến</dt>
                <dd className="text-amber-900">{formatVND(total)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-5 text-stone-500">
              Tổng tiền cuối cùng do máy chủ tính lại khi đặt đơn.
            </p>

            <Link
              href={
                promo
                  ? `/checkout?promo=${encodeURIComponent(promo.code)}`
                  : "/checkout"
              }
              onClick={handleCheckoutClick}
              className="mt-5 block rounded-xl bg-amber-800 px-4 py-3 text-center font-semibold text-white hover:bg-amber-900 transition-colors"
            >
              Tiến hành thanh toán
            </Link>

            <Link
              href="/menu"
              className="mt-3 block text-center text-sm font-semibold text-amber-900 hover:underline"
            >
              Tiếp tục chọn món
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

function CartRow({
  item,
  setQuantity,
  removeItem,
}: {
  item: CartItem;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
}) {
  const unit = itemUnitPrice(item);
  const itemKey = item.key || item.id || "";
  const currentQty = item.quantity ?? item.qty ?? 1;

  return (
    <article className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl || "/img/ca-phe-sua.jpg"}
        alt={item.name || item.productName}
        className="h-24 w-24 rounded-xl object-cover"
        onError={(e) => {
          e.currentTarget.src = "/img/ca-phe-sua.jpg";
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={`/products/${item.productId}`}
              className="font-bold hover:text-amber-900 hover:underline"
            >
              {item.name || item.productName}
            </Link>
            <p className="mt-1 text-sm text-stone-600">
              Size {item.size}
              {item.toppings && item.toppings.length
                ? ` · ${item.toppings.map((t) => t.name).join(", ")}`
                : " · Không topping"}
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              Đơn giá: {formatVND(unit)} / ly
            </p>
          </div>
          <strong className="whitespace-nowrap text-amber-900">
            {formatVND(itemLineTotal(item))}
          </strong>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={`Giảm số lượng ${item.name}`}
              onClick={() => setQuantity(itemKey, currentQty - 1)}
              className="h-8 w-8 rounded-lg border border-stone-300 hover:bg-stone-50 cursor-pointer"
            >
              −
            </button>
            <span
              className="min-w-5 text-center text-sm font-semibold"
              aria-live="polite"
            >
              {currentQty}
            </span>
            <button
              type="button"
              aria-label={`Tăng số lượng ${item.name}`}
              onClick={() => setQuantity(itemKey, currentQty + 1)}
              disabled={currentQty >= MAX_QTY_PER_ITEM}
              className="h-8 w-8 rounded-lg border border-stone-300 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeItem(itemKey)}
            className="text-sm font-semibold text-red-700 hover:underline cursor-pointer"
          >
            Xóa món
          </button>
        </div>
      </div>
    </article>
  );
}
