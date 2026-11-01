
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { getOrder, type OrderResponse } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/client";

const formatVnd = (amount: number) =>
  `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;

function OrderConfirmationContent() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      if (!Number.isInteger(orderId) || orderId <= 0) {
        setError("Mã đơn hàng không hợp lệ.");
        setLoading(false);
        return;
      }

      try {
        const result = await getOrder(orderId);
        if (active) setOrder(result);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "Không tìm thấy đơn hàng."
              : "Không thể tải thông tin đơn hàng. Vui lòng thử lại.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOrder();

    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <RequireAuth>
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
        <section className="rounded-2xl border border-gray-200 p-6 sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">
              ✓
            </div>
            <h1 className="mt-4 text-2xl font-bold text-[#183d2c]">
              Thông tin đơn hàng
            </h1>
            <p className="mt-2 text-gray-600">
              Cảm ơn bạn đã đặt hàng tại BrewLite.
            </p>
          </div>

          {loading ? (
            <p className="mt-8 text-center text-gray-500">
              Đang tải thông tin đơn hàng...
            </p>
          ) : error ? (
            <p role="alert" className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">
              {error}
            </p>
          ) : order ? (
            <div className="mt-8">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Mã đơn hàng</p>
                <p className="mt-1 text-lg font-bold text-[#183d2c]">
                  {order.code || `#${order.id}`}
                </p>
                <p className="mt-3 text-sm text-gray-500">Trạng thái</p>
                <p className="mt-1 font-medium">{order.status}</p>
              </div>

              <h2 className="mt-6 font-semibold">Chi tiết đơn hàng</h2>
              <ul className="mt-3 divide-y divide-gray-100">
                {order.items.map((item, index) => (
                  <li
                    key={`${item.productId}-${item.size}-${index}`}
                    className="flex justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-500">
                        Cỡ {item.size} · Số lượng {item.qty}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium">
                      {formatVnd(item.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 text-lg font-bold">
                <span>Tổng thanh toán</span>
                <span>{formatVnd(order.total)}</span>
              </div>

              {typeof order.pointsEarned === "number" && (
                <p className="mt-3 text-sm text-green-700">
                  Bạn nhận được {order.pointsEarned} điểm thưởng.
                </p>
              )}

              <p className="mt-6 rounded-xl bg-amber-50 p-4 text-center font-medium text-amber-900">
                Mời tới quầy lấy nước!
              </p>
            </div>
          ) : null}

          <Link
            href="/menu"
            className="mt-6 block rounded-xl bg-[#183d2c] px-5 py-3 text-center font-semibold text-white hover:bg-[#24563e]"
          >
            Quay lại thực đơn
          </Link>
        </section>
      </main>
    </RequireAuth>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 text-center text-gray-500">
          Đang tải thông tin đơn hàng...
        </main>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}
