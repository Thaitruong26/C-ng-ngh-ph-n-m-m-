"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/auth/require-auth";
import { selectTotalAmount, selectTotalItems, useCartStore } from "@/store/cart-store";

const formatVnd = (amount: number) =>
  `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const total = useCartStore(selectTotalAmount);
  const totalItems = useCartStore(selectTotalItems);

  return (
    <RequireAuth>
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold text-[#183d2c]">
          Giỏ hàng
        </h1>

        {items.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600">Giỏ hàng của bạn đang trống.</p>
            <Link
              href="/menu"
              className="mt-4 inline-block rounded-xl bg-[#183d2c] px-5 py-3 font-semibold text-white hover:bg-[#24563e]"
            >
              Xem thực đơn
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-6 space-y-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-900">
                      {item.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Cỡ {item.size}
                    </p>
                    <p className="mt-1 font-medium text-[#183d2c]">
                      {formatVnd(item.lineTotal)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-lg border border-gray-300">
                      <button
                        type="button"
                        aria-label={`Giảm số lượng ${item.name}`}
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="px-3 py-2 hover:bg-gray-100"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center">{item.qty}</span>
                      <button
                        type="button"
                        aria-label={`Tăng số lượng ${item.name}`}
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="px-3 py-2 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <section className="mt-6 rounded-2xl bg-gray-50 p-5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tổng số lượng</span>
                <span>{totalItems} món</span>
              </div>
              <div className="mt-3 flex justify-between text-lg font-bold text-[#183d2c]">
                <span>Tổng tiền tạm tính</span>
                <span>{formatVnd(total)}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Giá cuối cùng sẽ được máy chủ tính lại khi đặt hàng.
              </p>

              <Link
                href="/checkout"
                className="mt-5 block rounded-xl bg-[#183d2c] px-5 py-4 text-center font-semibold text-white hover:bg-[#24563e]"
              >
                Tiến hành thanh toán
              </Link>

              <Link
                href="/menu"
                className="mt-3 block text-center text-sm text-amber-800 hover:underline"
              >
                Tiếp tục chọn món
              </Link>
            </section>
          </>
        )}
      </main>
    </RequireAuth>
  );
}
