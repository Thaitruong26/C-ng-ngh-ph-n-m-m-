"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, formatVND, getToken, type Paginated } from "@/lib/api";
import { MOCK_ENABLED, mockApi } from "@/lib/mock";
import { useCartHydrated } from "@/store/cart";
import { useAuthStore } from "@/store/auth-store";

type OrderItemDetail = {
  id?: number;
  productId?: number;
  productName: string;
  size: string;
  qty: number;
  unitPrice?: number;
  lineTotal: number;
  toppings?: Array<{ id: number; name: string; price: number }>;
  note?: string | null;
};

type PaymentDetail = {
  id?: number;
  method: string;
  status: string;
  amount: number;
  createdAt?: string;
};

/** Một dòng trong GET /orders/me (api.md mục 6.9). */
type OrderSummary = {
  id: number | string;
  code?: string;
  status: string;
  subtotal?: number;
  discountAmount?: number;
  total: number;
  promoCode?: string | null;
  pointsEarned?: number;
  itemCount?: number;
  items?: OrderItemDetail[];
  payments?: PaymentDetail[];
  createdAt?: string;
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDING: { label: "Chờ thanh toán", badge: "bg-amber-100 text-amber-900" },
  PAID: { label: "Đã thanh toán", badge: "bg-emerald-100 text-emerald-900" },
  PREPARING: { label: "Đang pha chế", badge: "bg-indigo-100 text-indigo-900" },
  READY: { label: "Đã sẵn sàng", badge: "bg-purple-100 text-purple-900" },
  COMPLETED: { label: "Hoàn tất", badge: "bg-stone-200 text-stone-800" },
  PAYMENT_FAILED: { label: "Thanh toán thất bại", badge: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Đã hủy", badge: "bg-stone-100 text-stone-500" },
};

const STATUS_FILTERS = ["", "PENDING", "PAID", "PREPARING", "READY", "COMPLETED", "PAYMENT_FAILED", "CANCELLED"] as const;

export default function OrdersPage() {
  const ready = useCartHydrated();
  const signedIn = ready && Boolean(getToken());
  const user = useAuthStore((s) => s.user);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleExpand = (orderId: string | number) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Mỗi tài khoản chỉ xem đúng lịch sử đơn do tài khoản đó đặt
  const queryPath = `/orders/me?page=${page}&limit=10${status ? `&status=${status}` : ""}`;

  const { data, isPending, isFetching, error, refetch } = useQuery({
    // Cache riêng biệt theo userId để không bao giờ bị ghi đè cache giữa các tài khoản
    queryKey: ["orders-me", user?.id ?? "anon", page, status],
    enabled: ready && signedIn,
    staleTime: 0,
    refetchInterval: 4000, // Tự động làm mới mỗi 4 giây để cập nhật tiến trình pha chế
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async (): Promise<{ page: Paginated<OrderSummary>; fromMock: boolean }> => {
      try {
        const res = await api<Paginated<OrderSummary> | OrderSummary[]>(queryPath);
        const normalized: Paginated<OrderSummary> = Array.isArray(res)
          ? { data: res, meta: { page: 1, limit: res.length || 10, total: res.length, totalPages: 1 } }
          : res;
        return { page: normalized, fromMock: MOCK_ENABLED };
      } catch (err) {
        if (err instanceof ApiError && err.isMissingRoute) {
          const mock = await mockApi<Paginated<OrderSummary>>(queryPath);
          return { page: mock, fromMock: true };
        }
        throw err;
      }
    },
  });

  const orders = data?.page.data ?? [];
  const meta = data?.page.meta;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Tiêu đề & thanh công cụ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-stone-900">Lịch sử đơn hàng</h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
              title="Dữ liệu tự động cập nhật mỗi 4 giây"
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Đồng bộ 4s
            </span>
          </div>
          <p className="mt-2 text-stone-600">
            Bấm vào từng đơn để xem chi tiết món đã chọn, mã giảm giá và thông tin thanh toán.
          </p>
        </div>

        {signedIn && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút Làm mới thủ công */}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 cursor-pointer disabled:opacity-50"
              title="Lấy dữ liệu mới nhất từ máy chủ ngay lập tức"
            >
              <span className={isFetching ? "animate-spin" : ""}>🔄</span>
              <span>{isFetching ? "Đang tải..." : "Làm mới"}</span>
            </button>

            {/* Bộ lọc trạng thái */}
            <label className="text-sm font-semibold text-stone-700">
              Trạng thái:{" "}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="ml-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-amber-800"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s || "ALL"} value={s}>
                    {s ? STATUS_META[s]?.label ?? s : "Tất cả"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {ready && !signedIn && (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-700">Bạn cần đăng nhập để xem lịch sử đơn hàng.</p>
          <Link
            href="/login?next=/orders"
            className="mt-4 inline-block rounded-xl bg-amber-800 px-5 py-3 font-semibold text-white hover:bg-amber-900"
          >
            Đăng nhập
          </Link>
        </div>
      )}

      {(!ready || (signedIn && isPending && orders.length === 0)) && (
        <div className="py-16 text-center space-y-3">
          <div className="inline-block size-8 animate-spin rounded-full border-4 border-amber-800 border-t-transparent" />
          <p className="text-stone-500 text-sm">Đang tải lịch sử đơn hàng...</p>
        </div>
      )}

      {signedIn && error && (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p>Không tải được lịch sử đơn: {error instanceof Error ? error.message : "Lỗi không xác định"}.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Trạng thái chưa có đơn */}
      {signedIn && !isPending && !error && orders.length === 0 && (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-stone-900">Chưa có đơn hàng</h2>
          <p className="mt-2 text-stone-600">
            {status ? "Không có đơn nào ở trạng thái này." : "Các đơn bạn đã đặt sẽ xuất hiện ở đây."}
          </p>
          <Link
            href="/menu"
            className="mt-5 inline-block rounded-xl bg-amber-800 px-5 py-3 font-semibold text-white hover:bg-amber-900 cursor-pointer"
          >
            Đặt món ngay
          </Link>
        </div>
      )}

      {/* Danh sách đơn hàng */}
      {orders.length > 0 && (
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            const badge = STATUS_META[order.status] ?? { label: order.status, badge: "bg-stone-100 text-stone-800" };
            const code = order.code ?? `#${order.id}`;
            const isExpanded = Boolean(expandedOrders[order.id]);
            const primaryPayment = order.payments?.[0];

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xs transition hover:border-amber-700/50"
              >
                {/* Header card bấm vào để mở rộng chi tiết */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="flex flex-wrap items-center justify-between gap-3 p-5 cursor-pointer hover:bg-stone-50/70 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-stone-500">Mã đơn</p>
                      <h2 className="mt-0.5 text-lg font-bold text-stone-900 flex items-center gap-2">
                        <span>{code}</span>
                        <span className="text-xs text-stone-400 font-normal">
                          {isExpanded ? "▲ Thu gọn" : "▼ Chi tiết"}
                        </span>
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.badge}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-5 py-3.5 text-sm bg-stone-50/50">
                  <div className="text-stone-500">
                    {typeof order.itemCount === "number" && <span>{order.itemCount} món · </span>}
                    {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Tổng tiền:</span>
                    <strong className="text-base text-amber-900">{formatVND(order.total)}</strong>
                  </div>
                </div>

                {/* Khu vực chi tiết mở rộng khi bấm vào */}
                {isExpanded && (
                  <div className="border-t border-stone-200 bg-stone-50/30 p-5 space-y-4">
                    {/* Danh sách món */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2.5">
                        Món đã đặt ({order.items?.length || order.itemCount || 0} dòng món)
                      </h3>

                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="rounded-xl border border-stone-200/80 bg-white p-3.5 flex items-start justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex size-6 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-900">
                                    {item.qty}×
                                  </span>
                                  <span className="font-semibold text-stone-900">{item.productName}</span>
                                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600 font-medium">
                                    Size {item.size}
                                  </span>
                                </div>

                                {item.toppings && item.toppings.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
                                    {item.toppings.map((t) => (
                                      <span
                                        key={t.id}
                                        className="rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-xs text-amber-900"
                                      >
                                        + {t.name} ({formatVND(t.price)})
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.note && (
                                  <p className="text-xs italic text-stone-500 pl-8">
                                    Ghi chú: {item.note}
                                  </p>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-bold text-stone-900">{formatVND(item.lineTotal)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500 italic">Đang tải danh sách món...</p>
                      )}
                    </div>

                    {/* Thông tin thanh toán & Khuyến mãi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-1.5 text-xs">
                        <p className="font-bold uppercase tracking-wider text-stone-500">Hình thức thanh toán</p>
                        <p className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                          {primaryPayment?.method === "CARD" ? (
                            <><span>💳</span> Thẻ ngân hàng (CARD)</>
                          ) : (
                            <><span>📱</span> Ví điện tử (WALLET)</>
                          )}
                        </p>
                        <p className="text-stone-500">
                          Trạng thái giao dịch:{" "}
                          <strong className={primaryPayment?.status === "SUCCESS" || order.status === "PAID" ? "text-emerald-700" : "text-stone-700"}>
                            {primaryPayment?.status === "SUCCESS" || order.status === "PAID" ? "✓ Đã thanh toán thành công" : order.status}
                          </strong>
                        </p>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-1.5 text-xs">
                        <p className="font-bold uppercase tracking-wider text-stone-500">Khuyến mãi & Điểm thưởng</p>
                        {order.promoCode ? (
                          <div className="flex items-center justify-between text-emerald-800">
                            <span>Mã giảm: <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold">{order.promoCode}</code></span>
                            <span className="font-bold">-{formatVND(order.discountAmount ?? 0)}</span>
                          </div>
                        ) : (
                          <p className="text-stone-500 italic">Không áp dụng mã giảm giá</p>
                        )}
                        {typeof order.pointsEarned === "number" && order.pointsEarned > 0 && (
                          <p className="text-amber-800 font-medium">🎁 Tích lũy: +{order.pointsEarned} điểm thưởng</p>
                        )}
                      </div>
                    </div>

                    {/* Nút xem trang xác nhận đầy đủ */}
                    <div className="pt-2 flex justify-end">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        <span>Xem biên nhận & màn hình xác nhận đơn</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Phân trang */}
      {meta && meta.totalPages > 1 && (
        <nav aria-label="Phân trang đơn hàng" className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold disabled:opacity-40 cursor-pointer"
          >
            ← Trang trước
          </button>
          <span className="text-stone-600">
            Trang <strong>{meta.page}</strong> / {meta.totalPages} ({meta.total} đơn)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold disabled:opacity-40 cursor-pointer"
          >
            Trang sau →
          </button>
        </nav>
      )}
    </main>
  );
}
