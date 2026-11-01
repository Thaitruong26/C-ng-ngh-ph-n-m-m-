"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  getBaristaOrders,
  updateOrderStatus,
  cancelBaristaOrder,
  addProductStock,
  type BaristaOrder,
} from "@/lib/api/barista";
import { getProducts } from "@/lib/api/products";
import type { Product } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

const formatVnd = (price: number) => new Intl.NumberFormat("vi-VN").format(price);

export default function BaristaPage() {
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [orders, setOrders] = useState<BaristaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Bộ lọc tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");

  // Tab: "queue" (Hàng đợi) | "stock" (Quản lý kho)
  const [activeTab, setActiveTab] = useState<"queue" | "stock">("queue");

  // State cho kho
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [restockModalProduct, setRestockModalProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState(20);
  const [restockNote, setRestockNote] = useState("");
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockMessage, setRestockMessage] = useState<string | null>(null);

  // Đồng hồ thời gian thực
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Cập nhật đồng hồ mỗi giây
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tải danh sách đơn hàng
  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const res = await getBaristaOrders("PAID,PREPARING,READY", 1, 50);
      setOrders(res.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Chỉ tài khoản có quyền Barista mới được xem hàng đợi này.");
      } else {
        setError("Không thể tải hàng đợi đơn hàng. Đang thử lại...");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải danh sách sản phẩm kho
  const fetchStock = useCallback(async () => {
    try {
      setStockLoading(true);
      const res = await getProducts({ limit: 50 });
      setProducts(res.data);
    } catch {
      // ignore
    } finally {
      setStockLoading(false);
    }
  }, []);

  // Polling tự động làm mới hàng đợi mỗi 8 giây
  useEffect(() => {
    if (user?.role === "BARISTA") {
      const timer = setTimeout(() => { fetchOrders(); }, 0);
      const interval = setInterval(fetchOrders, 8000);
      return () => { clearTimeout(timer); clearInterval(interval); };
    }
  }, [user, fetchOrders]);

  useEffect(() => {
    if (activeTab === "stock" && user?.role === "BARISTA") {
      const timer = setTimeout(() => { fetchStock(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, user, fetchStock]);

  // Chuyển bước đơn hàng: PAID → PREPARING → READY → COMPLETED
  async function handleAdvanceStatus(order: BaristaOrder) {
    let nextStatus: "PREPARING" | "READY" | "COMPLETED";
    if (order.status === "PAID") nextStatus = "PREPARING";
    else if (order.status === "PREPARING") nextStatus = "READY";
    else if (order.status === "READY") nextStatus = "COMPLETED";
    else return;

    setActionLoadingId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus);
      await fetchOrders();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Hủy đơn khi còn PAID
  async function handleCancelOrder(orderId: number) {
    if (!confirm(`Bạn có chắc chắn muốn hủy đơn #${orderId}? Tiền sẽ được hoàn lại cho khách và cộng lại tồn kho.`)) {
      return;
    }
    setActionLoadingId(orderId);
    try {
      await cancelBaristaOrder(orderId);
      await fetchOrders();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : "Không thể hủy đơn hàng.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Nhập kho
  async function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restockModalProduct || restockQty <= 0) return;
    setRestockSubmitting(true);
    try {
      await addProductStock(restockModalProduct.id, restockQty, restockNote);
      setRestockMessage(`Đã nhập thêm +${restockQty} ly cho món "${restockModalProduct.name}"!`);
      setTimeout(() => setRestockMessage(null), 3000);
      setRestockModalProduct(null);
      setRestockQty(20);
      setRestockNote("");
      fetchStock();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : "Nhập kho thất bại.");
    } finally {
      setRestockSubmitting(false);
    }
  }

  // Phân loại 3 cột
  const paidOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "PAID" &&
          (o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.customerName || "").toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [orders, searchQuery],
  );

  const preparingOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "PREPARING" &&
          (o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.customerName || "").toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [orders, searchQuery],
  );

  const readyOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "READY" &&
          (o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.customerName || "").toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [orders, searchQuery],
  );

  // Màn hình chặn nếu chưa đăng nhập hoặc không phải Barista
  if (!user || user.role !== "BARISTA") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-inner">
          🔒
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#183d2c]">
          Khu Vực Dành Riêng Cho Barista
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#66736a]">
          Bạn cần đăng nhập với tài khoản nhân viên quầy (Barista) để truy cập hệ thống nhận đơn và quản lý pha chế.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login?next=/barista"
            className="rounded-full bg-[#183d2c] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#25523c]"
          >
            Đăng nhập tài khoản Barista
          </Link>
          <Link
            href="/menu"
            className="rounded-full border border-[#d5ded7] bg-white px-6 py-3 text-sm font-semibold text-[#31553e] transition hover:bg-[#f2f5f0]"
          >
            Quay lại Thực đơn
          </Link>
        </div>
        <p className="mt-6 text-xs text-[#8c9c91]">
          Tài khoản mẫu: <code className="font-semibold text-amber-800">barista@brewlite.com</code> / Pass: <code className="font-semibold text-amber-800">Barista@123</code>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      {/* ── Top Bar Quầy Barista ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#e1e7de] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-2xl text-white shadow-md">
            👨‍🍳
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#183d2c]">
                Quầy Pha Chế BrewLite
              </h1>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                Live POS
              </span>
            </div>
            <p className="text-xs text-[#66736a]">
              Barista phụ trách: <span className="font-semibold text-[#183d2c]">{user.fullName}</span> · Giờ hệ thống:{" "}
              <span className="font-mono font-bold text-[#183d2c]">{currentTime}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-[#f0f4ee] p-1">
            <button
              onClick={() => setActiveTab("queue")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "queue"
                  ? "bg-white text-[#183d2c] shadow-sm"
                  : "text-[#66736a] hover:text-[#183d2c]"
              }`}
            >
              📋 Hàng Đợi ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("stock")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "stock"
                  ? "bg-white text-[#183d2c] shadow-sm"
                  : "text-[#66736a] hover:text-[#183d2c]"
              }`}
            >
              📦 Quản Lý Kho
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === "queue") fetchOrders();
              else fetchStock();
            }}
            title="Làm mới dữ liệu"
            className="flex items-center gap-1.5 rounded-xl border border-[#d9e0d7] bg-white px-3 py-2 text-xs font-bold text-[#31553e] transition hover:bg-[#f5f8f4]"
          >
            <svg
              className={`size-3.5 ${loading || stockLoading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Làm mới
          </button>
        </div>
      </div>

      {restockMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm">
          ✓ {restockMessage}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
          ⚠️ {error}
        </div>
      )}

      {/* ── TAB 1: HÀNG ĐỢI ĐƠN HÀNG (KANBAN 3 CỘT) ────────────────── */}
      {activeTab === "queue" && (
        <div className="mt-6">
          {/* Thanh tìm kiếm */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
              <input
                type="text"
                placeholder="Tìm mã đơn (#1042) hoặc tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[#d9e0d7] bg-white py-2.5 pl-9 pr-4 text-xs font-medium outline-none focus:border-[#3d6e52] focus:ring-2 focus:ring-[#d8e6dc]"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8c9c91]">
                🔍
              </span>
            </div>
            <div className="text-xs text-[#66736a]">
              Tự động cập nhật mỗi <span className="font-semibold text-[#183d2c]">8 giây</span> · Nhấn nút để chuyển trạng thái
            </div>
          </div>

          {/* 3 Cột Hàng Đợi */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* CỘT 1: ĐƠN MỚI (PAID) */}
            <div className="flex flex-col rounded-3xl border border-amber-200 bg-[#fffdfa] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                    1. Đơn Mới (Đã trả tiền)
                  </h2>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-900">
                  {paidOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {paidOrders.length === 0 ? (
                  <div className="flex min-h-36 flex-col items-center justify-center text-center text-xs text-amber-800/60">
                    <span>☕</span>
                    <p className="mt-1">Không có đơn mới nào</p>
                  </div>
                ) : (
                  paidOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      accentColor="amber"
                      actionLabel="Nhận Đơn → Pha"
                      actionIcon="⚡"
                      onAction={() => handleAdvanceStatus(order)}
                      onCancel={() => handleCancelOrder(order.id)}
                      isLoading={actionLoadingId === order.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* CỘT 2: ĐANG PHA CHẾ (PREPARING) */}
            <div className="flex flex-col rounded-3xl border border-blue-200 bg-[#f8fbff] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-blue-500 animate-ping" />
                  <h2 className="text-sm font-bold text-blue-950 uppercase tracking-wide">
                    2. Đang Pha Chế
                  </h2>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-900">
                  {preparingOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {preparingOrders.length === 0 ? (
                  <div className="flex min-h-36 flex-col items-center justify-center text-center text-xs text-blue-800/60">
                    <span>🥛</span>
                    <p className="mt-1">Chưa có ly nào đang pha</p>
                  </div>
                ) : (
                  preparingOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      accentColor="blue"
                      actionLabel="Pha Xong → Sẵn Sàng"
                      actionIcon="✓"
                      onAction={() => handleAdvanceStatus(order)}
                      isLoading={actionLoadingId === order.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* CỘT 3: SẴN SÀNG GIAO (READY) */}
            <div className="flex flex-col rounded-3xl border border-emerald-200 bg-[#f8fdf9] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                    3. Sẵn Sàng Giao Khách
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900">
                  {readyOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {readyOrders.length === 0 ? (
                  <div className="flex min-h-36 flex-col items-center justify-center text-center text-xs text-emerald-800/60">
                    <span>🔔</span>
                    <p className="mt-1">Không có đơn chờ lấy</p>
                  </div>
                ) : (
                  readyOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      accentColor="emerald"
                      actionLabel="Giao Khách → Hoàn Tất"
                      actionIcon="🎉"
                      onAction={() => handleAdvanceStatus(order)}
                      isLoading={actionLoadingId === order.id}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: QUẢN LÝ KHO SẢN PHẨM ────────────────────────────── */}
      {activeTab === "stock" && (
        <div className="mt-6 rounded-3xl border border-[#e1e7de] bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#183d2c]">
                Tồn Kho Sản Phẩm Thực Tế
              </h2>
              <p className="text-xs text-[#66736a]">
                Server tự động trừ kho khi khách đặt đơn. Barista nhập thêm hàng mới bằng nút &quot;Nhập Thêm&quot;.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#e5eae3] bg-[#f8faf7] text-[11px] font-bold uppercase text-[#4d6354]">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Giá bán</th>
                  <th className="px-4 py-3 text-center">Tồn kho hiện tại</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1eb]">
                {products.map((p) => {
                  const isLow = p.stock <= 5;
                  const isOutOfStock = p.stock === 0;

                  return (
                    <tr key={p.id} className="transition hover:bg-[#fafbf9]">
                      <td className="px-4 py-3.5 font-mono text-gray-500">#{p.id}</td>
                      <td className="px-4 py-3.5 font-bold text-[#183d2c]">
                        {p.name}
                      </td>
                      <td className="px-4 py-3.5 text-[#66736a]">{p.category}</td>
                      <td className="px-4 py-3.5 font-semibold text-[#183d2c]">
                        {formatVnd(p.price)} đ
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-1 font-mono text-xs font-bold ${
                            isOutOfStock
                              ? "bg-red-100 text-red-800"
                              : isLow
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {p.stock} phần
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isOutOfStock ? (
                          <span className="text-xs font-semibold text-red-600">Hết hàng</span>
                        ) : isLow ? (
                          <span className="text-xs font-semibold text-amber-600">Sắp hết hàng</span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600">Dồi dào</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setRestockModalProduct(p)}
                          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 shadow-sm"
                        >
                          + Nhập Thêm
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL NHẬP KHO SẢN PHẨM ─────────────────────────────────── */}
      {restockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#e1e7de] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-[#183d2c]">
                Nhập Thêm Tồn Kho
              </h3>
              <button
                onClick={() => setRestockModalProduct(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-[#66736a]">Sản phẩm:</p>
                <p className="text-sm font-bold text-[#183d2c]">
                  {restockModalProduct.name} (#{restockModalProduct.id})
                </p>
                <p className="mt-1 text-xs text-[#66736a]">
                  Tồn hiện tại: <span className="font-semibold text-amber-800">{restockModalProduct.stock}</span> phần
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#344b3c]">
                  Số lượng nhập thêm (phần):
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  required
                  className="w-full rounded-xl border border-[#d9e0d7] px-4 py-2.5 text-sm font-bold text-[#183d2c] outline-none focus:border-[#3d6e52] focus:ring-2 focus:ring-[#d8e6dc]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#344b3c]">
                  Ghi chú nhập hàng (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nhập hàng ca sáng 26/10"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  className="w-full rounded-xl border border-[#d9e0d7] px-4 py-2 text-xs outline-none focus:border-[#3d6e52]"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRestockModalProduct(null)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[#66736a] hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="rounded-full bg-[#183d2c] px-6 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[#25523c] disabled:opacity-50"
                >
                  {restockSubmitting ? "Đang lưu..." : `Xác Nhận (+${restockQty})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENT THẺ ĐƠN HÀNG TRONG HÀNG ĐỢI ─────────────────────────
function OrderCard({
  order,
  accentColor,
  actionLabel,
  actionIcon,
  onAction,
  onCancel,
  isLoading,
}: {
  order: BaristaOrder;
  accentColor: "amber" | "blue" | "emerald";
  actionLabel: string;
  actionIcon: string;
  onAction: () => void;
  onCancel?: () => void;
  isLoading: boolean;
}) {
  const timeFormatted = new Date(order.createdAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-[#e8ece5] bg-white p-4 shadow-sm transition hover:shadow-md">
      {/* Header card: Mã đơn, Khách, Giờ */}
      <div className="flex items-start justify-between border-b border-[#f0f3ee] pb-2.5">
        <div>
          <span className="font-mono text-base font-extrabold text-[#183d2c]">
            {order.code}
          </span>
          <p className="text-xs font-medium text-[#4d6354]">
            👤 {order.customerName}
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-700">
            {timeFormatted}
          </span>
          <p className="mt-1 font-mono text-xs font-bold text-[#183d2c]">
            {formatVnd(order.total)} đ
          </p>
        </div>
      </div>

      {/* Danh sách món đồ uống */}
      <div className="my-3 space-y-2">
        {order.items.map((item, idx) => (
          <div key={idx} className="rounded-xl bg-[#f8faf7] p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#183d2c]">
                {item.productName}{" "}
                <span className="rounded-md bg-[#e3ece5] px-1.5 py-0.5 font-mono text-[10px] text-[#254130]">
                  Size {item.size}
                </span>
              </span>
              <span className="rounded-full bg-[#183d2c] px-2 py-0.5 font-mono font-bold text-white text-[11px]">
                x{item.qty}
              </span>
            </div>

            {/* Toppings */}
            {item.toppings && item.toppings.length > 0 && (
              <p className="mt-1 text-[11px] text-[#55695b]">
                + {item.toppings.map((t) => t.name).join(", ")}
              </p>
            )}

            {/* Ghi chú đặc biệt (Tô màu nổi bật để Barista không pha nhầm) */}
            {item.note && (
              <div className="mt-1.5 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                📝 {item.note}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nút thao tác chuyển bước */}
      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#f0f3ee]">
        {onCancel && order.status === "PAID" && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            title="Hủy đơn khi chưa pha (hoàn tiền)"
          >
            Hủy
          </button>
        )}

        <button
          type="button"
          onClick={onAction}
          disabled={isLoading}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${
            accentColor === "amber"
              ? "bg-amber-600 hover:bg-amber-700"
              : accentColor === "blue"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-emerald-700 hover:bg-emerald-800"
          }`}
        >
          {isLoading ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span>{actionIcon}</span>
          )}
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}
