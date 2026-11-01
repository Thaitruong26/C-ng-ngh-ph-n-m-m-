 "use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, formatVND, getToken, type Paginated } from "@/lib/api";
import { MOCK_ENABLED, mockApi } from "@/lib/mock";
import { useCartHydrated } from "@/store/cart";

/** Một dòng trong GET /orders/me (api.md mục 6.9). */
type OrderSummary = {
  id: number | string;
  code?: string;
  status: string;
  total: number;
  itemCount?: number;
  createdAt?: string;
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDING: { label: "Chờ thanh toán", badge: "bg-amber-100 text-amber-900" },
  PAID: { label: "Đã thanh toán", badge: "bg-sky-100 text-sky-900" },
  PREPARING: { label: "Đang pha chế", badge: "bg-indigo-100 text-indigo-900" },
  READY: { label: "Đã sẵn sàng", badge: "bg-emerald-100 text-emerald-900" },
  COMPLETED: { label: "Hoàn tất", badge: "bg-stone-200 text-stone-800" },
  PAYMENT_FAILED: { label: "Thanh toán thất bại", badge: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Đã hủy", badge: "bg-stone-100 text-stone-500" },
};

const STATUS_FILTERS = ["", "PENDING", "PAID", "PREPARING", "READY", "COMPLETED", "PAYMENT_FAILED", "CANCELLED"] as const;

export default function OrdersPage() {
  const ready = useCartHydrated();
  const signedIn = ready && Boolean(getToken());
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");

  const queryPath = `/orders/me?page=${page}&limit=10${status ? `&status=${status}` : ""}`;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["orders-me", page, status],
    enabled: ready && signedIn,
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

  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold">Lịch sử đơn hàng</h1>
        <p className="mt-2 text-stone-600">Theo dõi mã đơn, trạng thái pha chế và tổng tiền các đơn đã đặt.</p>
      </div>
      {signedIn && <label className="text-sm font-semibold text-stone-700">
        Trạng thái:{" "}
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="ml-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-amber-800">
          {STATUS_FILTERS.map((s) => <option key={s || "ALL"} value={s}>{s ? STATUS_META[s]?.label ?? s : "Tất cả"}</option>)}
        </select>
      </label>}
    </div>

    {ready && !signedIn && (
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-stone-700">Bạn cần đăng nhập để xem lịch sử đơn hàng.</p>
        <Link href="/login?next=/orders" className="mt-4 inline-block rounded-xl bg-amber-800 px-5 py-3 font-semibold text-white hover:bg-amber-900">Đăng nhập</Link>
      </div>
    )}

    {(!ready || (signedIn && isPending)) && <p className="py-16 text-center text-stone-500">Đang tải lịch sử đơn hàng...</p>}

    {signedIn && error && (
      <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Không tải được lịch sử đơn: {error instanceof Error ? error.message : "Lỗi không xác định"}.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Thử lại</button>
      </div>
    )}

    {data?.fromMock && (
      <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Đang hiển thị dữ liệu mẫu theo <code className="font-mono">api.md</code> (mục 6.9) vì backend chưa triển khai <code className="font-mono">GET /orders/me</code>. Khi BE3 hoàn thành API, trang sẽ tự lấy đơn thật.
      </div>
    )}

    {signedIn && !isPending && !error && orders.length === 0 && (
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <h2 className="text-xl font-bold">Chưa có đơn hàng</h2>
        <p className="mt-2 text-stone-600">{status ? "Không có đơn nào ở trạng thái này." : "Các đơn đã đặt sẽ xuất hiện ở đây."}</p>
        <Link href="/menu" className="mt-5 inline-block rounded-xl bg-amber-800 px-5 py-3 font-semibold text-white hover:bg-amber-900">Đặt món ngay</Link>
      </div>
    )}

    {orders.length > 0 && <div className="mt-6 space-y-4">
      {orders.map((order) => {
        const badge = STATUS_META[order.status] ?? { label: order.status, badge: "bg-stone-100 text-stone-800" };
        const code = order.code ?? `#${order.id}`;
        return <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-stone-500">Mã đơn</p>
              <h2 className="mt-0.5 text-lg font-bold">{code}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.badge}`}>{badge.label}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4 text-sm">
            <div className="text-stone-500">
              {typeof order.itemCount === "number" && <span>{order.itemCount} món · </span>}
              {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : ""}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-stone-500">Tổng tiền:</span>
              <strong className="text-base text-amber-900">{formatVND(order.total)}</strong>
            </div>
          </div>
        </article>;
      })}
    </div>}

    {meta && meta.totalPages > 1 && (
      <nav aria-label="Phân trang đơn hàng" className="mt-6 flex items-center justify-between text-sm">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold disabled:opacity-40">← Trang trước</button>
        <span className="text-stone-600">Trang <strong>{meta.page}</strong> / {meta.totalPages} ({meta.total} đơn)</span>
        <button type="button" onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold disabled:opacity-40">Trang sau →</button>
      </nav>
    )}
  </main>;
}
