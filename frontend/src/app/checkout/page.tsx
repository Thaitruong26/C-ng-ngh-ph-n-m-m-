"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createOrderApi,
  createPaymentApi,
  formatVND,
  getAccessToken,
} from "@/lib/api";
import {
  createMockOrderFromCart,
  processMockPayment,
} from "@/lib/mock-checkout";
import { calculateItemUnitPrice, useCartStore } from "@/store/cart-store";
import {
  CreateOrderDto,
  CreatePaymentDto,
  MockPaymentResult,
  OrderResponse,
  PaymentMethod,
} from "@/types/order";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    promoCode,
    discountAmount: storeDiscountAmount,
    clearCart,
    loadSampleCart,
    getSubtotal,
    getTotal,
  } = useCartStore();

  const [mounted, setMounted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("WALLET");
  const [mockResult, setMockResult] = useState<MockPaymentResult>("SUCCESS");
  const [useMockMode, setUseMockMode] = useState<boolean>(false);

  // Đơn hàng đã tạo từ POST /orders (giữ lại khi lỗi 402 để thử thanh toán lại không tạo trùng đơn)
  const [currentOrder, setCurrentOrder] = useState<OrderResponse | null>(null);

  // Idempotency-Key: sinh 1 lần bằng crypto.randomUUID() cho mỗi lượt xác nhận, giữ nguyên nếu bấm lại
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [lastUsedKey, setLastUsedKey] = useState<string>("");

  // Trạng thái xử lý & lỗi
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stepStatus, setStepStatus] = useState<
    "IDLE" | "CREATING_ORDER" | "PROCESSING_PAYMENT"
  >("IDLE");
  const [errorState, setErrorState] = useState<{
    statusCode: number;
    code: string;
    message: string;
    replayed?: boolean;
  } | null>(null);
  const [replayNotice, setReplayNotice] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      setIdempotencyKey(generateUUID());
      setHasToken(Boolean(getAccessToken()));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Khi đổi phương thức thanh toán hoặc đổi mockResult sang body khác, cần key mới để tránh lỗi 422 IDEMPOTENCY_KEY_REUSED
  const handleSelectMethod = (method: PaymentMethod) => {
    if (method !== paymentMethod) {
      setPaymentMethod(method);
      setIdempotencyKey(generateUUID());
      setErrorState(null);
      setReplayNotice(null);
    }
  };

  const handleSelectMockResult = (result: MockPaymentResult) => {
    if (result !== mockResult) {
      setMockResult(result);
      setIdempotencyKey(generateUUID());
      setErrorState(null);
      setReplayNotice(null);
    }
  };

  // Số tiền hiển thị: ưu tiên tuyệt đối số chính thức từ server trả về (SOP: Giá do server tính)
  const clientSubtotal = mounted ? getSubtotal() : 0;
  const clientTotal = mounted ? getTotal() : 0;
  const clientDiscount = Math.max(0, clientSubtotal - clientTotal);

  const displaySubtotal = currentOrder ? currentOrder.subtotal : clientSubtotal;
  const displayDiscount = currentOrder
    ? currentOrder.discountAmount
    : clientDiscount || storeDiscountAmount;
  const displayTotal = currentOrder ? currentOrder.total : clientTotal;
  const displayPromoCode = currentOrder
    ? currentOrder.promoCode
    : promoCode || null;

  /**
   * Xử lý đặt đơn (POST /orders) và thanh toán (POST /payments)
   * @param forceNewKey Nếu true, sinh Idempotency-Key mới trước khi gửi (dùng khi bấm "Thử lại với Key mới" sau lỗi 402)
   * @param customKey Nếu truyền vào, dùng chính xác key đó (để demo gửi lại cùng Idempotency-Key)
   */
  const handleConfirmPayment = async (options?: {
    forceNewKey?: boolean;
    customKey?: string;
  }) => {
    if (items.length === 0 && !currentOrder) return;

    setIsSubmitting(true);
    setErrorState(null);
    setReplayNotice(null);

    // Xác định Idempotency-Key cho lần gọi này:
    // - Sinh một lần bằng crypto.randomUUID(), giữ nguyên nếu bấm lại
    // - Nếu người dùng chủ động chọn thử lại với key mới sau lỗi 402 thì sinh key mới
    const activeKey =
      options?.customKey ||
      (options?.forceNewKey ? generateUUID() : idempotencyKey || generateUUID());

    if (activeKey !== idempotencyKey) {
      setIdempotencyKey(activeKey);
    }

    try {
      let orderToPay = currentOrder;

      // Bước 1: Gọi POST /orders nếu chưa có đơn PENDING / PAYMENT_FAILED
      if (!orderToPay) {
        setStepStatus("CREATING_ORDER");
        const orderDto: CreateOrderDto = {
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            toppingIds: item.toppings.map((t) => t.id),
            quantity: item.quantity,
            ...(item.note ? { note: item.note } : {}),
          })),
          ...(promoCode ? { promoCode: promoCode.trim().toUpperCase() } : {}),
        };

        if (useMockMode) {
          await new Promise((r) => setTimeout(r, 350));
          orderToPay = createMockOrderFromCart(
            orderDto,
            items,
            clientDiscount
          );
        } else {
          orderToPay = await createOrderApi(orderDto);
        }
        setCurrentOrder(orderToPay);
      }

      // Bước 2: Gọi POST /payments kèm header Idempotency-Key
      setStepStatus("PROCESSING_PAYMENT");
      setLastUsedKey(activeKey);

      const paymentDto: CreatePaymentDto = {
        orderId: orderToPay.id,
        method: paymentMethod,
        ...(mockResult ? { mockResult } : {}),
      };

      if (useMockMode) {
        await new Promise((r) => setTimeout(r, 450));
        const mockRes = processMockPayment(paymentDto, activeKey);

        if (mockRes.statusCode !== 201 || mockRes.error) {
          throw new ApiError(
            {
              statusCode: mockRes.error?.statusCode || mockRes.statusCode,
              code: mockRes.error?.code || "PAYMENT_FAILED",
              message:
                mockRes.error?.message || "Thanh toán không thành công.",
            },
            { replayed: mockRes.replayed }
          );
        }

        if (mockRes.replayed) {
          setReplayNotice(
            `Phản hồi Idempotent Replay (Idempotent-Replayed: true) cho key ${activeKey}. Không tạo thanh toán mới!`
          );
        }

        // Thành công (201) -> Xóa giỏ hàng và chuyển sang trang xác nhận đơn
        clearCart();
        router.push(`/orders/${orderToPay.id}`);
        return;
      }

      // Gọi API thật POST /payments
      const { data: paymentRes, replayed } = await createPaymentApi(
        paymentDto,
        activeKey
      );

      if (replayed) {
        setReplayNotice(
          `Phản hồi Idempotent Replay (Idempotent-Replayed: true) cho key ${activeKey}.`
        );
      }

      // Thành công -> xóa giỏ hàng và sang trang xác nhận đơn
      clearCart();
      router.push(`/orders/${paymentRes.order.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorState({
          statusCode: err.statusCode,
          code: err.code,
          message: err.message,
          replayed: err.replayed,
        });

        // Nếu lỗi 402 PAYMENT_FAILED: cập nhật trạng thái đơn tại chỗ sang PAYMENT_FAILED,
        // GIỮ NGUYÊN GIỎ HÀNG, và sinh sẵn key mới để người dùng có thể bấm thử lại ngay
        if (err.statusCode === 402) {
          setCurrentOrder((prev) =>
            prev ? { ...prev, status: "PAYMENT_FAILED" } : prev
          );
          // Chuẩn bị sẵn key mới cho nút "Thử lại với Key mới", vẫn lưu lastUsedKey để có thể test replay
          setIdempotencyKey(generateUUID());
        }
      } else {
        setErrorState({
          statusCode: 500,
          code: "UNEXPECTED_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Đã xảy ra lỗi không xác định.",
        });
      }
    } finally {
      setIsSubmitting(false);
      setStepStatus("IDLE");
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-stone-600">
            Đang tải trang thanh toán...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xl tracking-tight text-amber-900"
            >
              <span className="text-2xl">☕</span>
              <span>BrewLite</span>
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-sm font-semibold text-stone-700">
              Thanh toán đơn hàng
            </span>
          </div>

          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/menu"
              className="text-stone-600 hover:text-amber-800 transition-colors"
            >
              Thực đơn
            </Link>
            <Link
              href="/cart"
              className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
            >
              Giỏ hàng ({items.reduce((sum, i) => sum + i.quantity, 0)})
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Thanh công cụ chế độ chạy & kiểm thử cho nhóm / giảng viên */}
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Bảng điều khiển Thanh toán (FE3)
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Mặc định gọi API thật (<code className="font-mono">POST /orders</code> &{" "}
              <code className="font-mono">POST /payments</code>). Bật{" "}
              <strong>Chế độ Dữ liệu giả</strong> nếu chưa chạy Backend.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUseMockMode((prev) => !prev);
                setErrorState(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                useMockMode
                  ? "bg-amber-800 text-white border-amber-900 shadow-sm"
                  : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
              }`}
            >
              {useMockMode
                ? "🟢 Đang bật: Dữ liệu giả (Mock API)"
                : "🌐 Đang bật: API thật (Backend)"}
            </button>

            {!hasToken && !useMockMode && (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors"
              >
                ⚠️ Chưa có JWT Token (Đăng nhập)
              </Link>
            )}
          </div>
        </div>

        {/* Nếu giỏ hàng trống và chưa có đơn */}
        {items.length === 0 && !currentOrder ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center max-w-lg mx-auto shadow-sm">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-xl font-bold text-stone-900">
              Giỏ hàng của bạn đang trống
            </h2>
            <p className="text-sm text-stone-600 mt-2">
              Vui lòng chọn đồ uống từ thực đơn hoặc nạp giỏ hàng mẫu theo tài liệu{" "}
              <code className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">
                docs/api.md
              </code>{" "}
              để thử nghiệm thanh toán.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/menu"
                className="px-5 py-2.5 rounded-xl bg-amber-800 text-white text-sm font-semibold hover:bg-amber-900 transition-colors"
              >
                Quay lại Thực đơn
              </Link>
              <button
                type="button"
                onClick={() => {
                  loadSampleCart();
                  setCurrentOrder(null);
                  setErrorState(null);
                  setIdempotencyKey(generateUUID());
                }}
                className="px-5 py-2.5 rounded-xl border border-amber-800 text-amber-900 bg-amber-50 hover:bg-amber-100 text-sm font-semibold transition-colors cursor-pointer"
              >
                Nạp giỏ hàng mẫu (docs/api.md)
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Cột trái: Danh sách món & Thông tin đơn */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
                  <div>
                    <h1 className="text-xl font-bold text-stone-900">
                      Chi tiết đơn hàng
                    </h1>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Kiểm tra lại đồ uống, size và topping trước khi thanh toán
                    </p>
                  </div>

                  {currentOrder ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        currentOrder.status === "PAYMENT_FAILED"
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-amber-100 text-amber-900 border border-amber-200"
                      }`}
                    >
                      Đơn {currentOrder.code || `#${currentOrder.id}`} •{" "}
                      {currentOrder.status}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                      {items.reduce((sum, i) => sum + i.quantity, 0)} phần
                    </span>
                  )}
                </div>

                {/* Danh sách món */}
                <div className="divide-y divide-stone-100">
                  {currentOrder
                    ? currentOrder.items.map((item, idx) => (
                        <div
                          key={`${item.productId}-${item.size}-${idx}`}
                          className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-lg font-bold text-amber-900 shrink-0">
                              {item.qty}x
                            </div>
                            <div>
                              <h3 className="font-semibold text-stone-900">
                                {item.productName}
                              </h3>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs font-medium">
                                  Size {item.size}
                                </span>
                                {item.toppings && item.toppings.length > 0 ? (
                                  item.toppings.map((t) => (
                                    <span
                                      key={t.id}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/60 text-xs"
                                    >
                                      + {t.name} ({formatVND(t.price)})
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-stone-400">
                                    Không topping
                                  </span>
                                )}
                              </div>
                              {item.note && (
                                <p className="text-xs text-stone-500 italic mt-1">
                                  Ghi chú: &ldquo;{item.note}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-stone-900">
                              {formatVND(item.lineTotal)}
                            </p>
                            <p className="text-xs text-stone-500">
                              {formatVND(item.unitPrice)} / ly
                            </p>
                          </div>
                        </div>
                      ))
                    : items.map((item, idx) => {
                        const unitPrice = calculateItemUnitPrice(item);
                        const lineTotal = unitPrice * item.quantity;
                        return (
                          <div
                            key={item.id || `${item.productId}-${item.size}-${idx}`}
                            className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                          >
                            <div className="flex items-start gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.imageUrl || "/img/cappuccino.jpg"}
                                alt={item.productName}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    "/file.svg";
                                }}
                                className="w-14 h-14 rounded-xl object-cover border border-stone-200 bg-stone-100 shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-stone-900">
                                    {item.productName}
                                  </h3>
                                  <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                                    x{item.quantity}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs font-medium">
                                    Size {item.size}
                                    {item.sizeSurcharge > 0
                                      ? ` (+${formatVND(item.sizeSurcharge)})`
                                      : ""}
                                  </span>
                                  {item.toppings.map((t) => (
                                    <span
                                      key={t.id}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/60 text-xs"
                                    >
                                      + {t.name} ({formatVND(t.price)})
                                    </span>
                                  ))}
                                </div>
                                {item.note && (
                                  <p className="text-xs text-stone-500 italic mt-1">
                                    Ghi chú: &ldquo;{item.note}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="font-semibold text-stone-900">
                                {formatVND(lineTotal)}
                              </p>
                              <p className="text-xs text-stone-500">
                                {formatVND(unitPrice)} / ly
                              </p>
                            </div>
                          </div>
                        );
                      })}
                </div>

                {/* Khôi phục / đặt lại giỏ mẫu để dễ test */}
                <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span>
                    Giỏ hàng được lưu trong{" "}
                    <code className="font-mono">localStorage</code> (giữ nguyên
                    nếu thanh toán lỗi 402).
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      loadSampleCart();
                      setCurrentOrder(null);
                      setErrorState(null);
                      setIdempotencyKey(generateUUID());
                    }}
                    className="text-amber-800 hover:underline font-medium cursor-pointer"
                  >
                    Đặt lại dữ liệu mẫu
                  </button>
                </div>
              </section>

              {/* Khu vực kỹ thuật: Idempotency-Key & Giả lập lỗi 402 (Mock Payment Result) */}
              <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-3">
                  Cấu hình Idempotency & Giả lập Cổng thanh toán (Task 8 & 10)
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1.5">
                      Kết quả giả lập cổng thanh toán (<code className="font-mono">mockResult</code> gửi kèm{" "}
                      <code className="font-mono">POST /payments</code>):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectMockResult("SUCCESS")}
                        className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                          mockResult === "SUCCESS"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600"
                            : "border-stone-200 hover:bg-stone-50 text-stone-700"
                        }`}
                      >
                        <div className="font-bold">✅ SUCCESS (Mặc định)</div>
                        <div className="text-stone-500 mt-0.5">
                          Thanh toán thành công (201), đơn chuyển sang PAID, xóa giỏ
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectMockResult("FAILED")}
                        className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                          mockResult === "FAILED"
                            ? "border-red-600 bg-red-50 text-red-950 ring-1 ring-red-600"
                            : "border-stone-200 hover:bg-stone-50 text-stone-700"
                        }`}
                      >
                        <div className="font-bold">❌ FAILED (Demo lỗi 402)</div>
                        <div className="text-stone-500 mt-0.5">
                          Trả về mã 402 PAYMENT_FAILED, giữ nguyên giỏ hàng
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-700">
                        Header <code className="font-mono">Idempotency-Key</code> hiện tại:
                      </span>
                      <button
                        type="button"
                        onClick={() => setIdempotencyKey(generateUUID())}
                        className="text-xs font-semibold text-amber-800 hover:text-amber-900 cursor-pointer"
                      >
                        🔄 Sinh UUID mới
                      </button>
                    </div>
                    <p className="font-mono text-xs text-stone-800 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 mt-1.5 break-all">
                      {idempotencyKey}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1.5">
                      Sinh bằng <code className="font-mono">crypto.randomUUID()</code> một lần cho mỗi lần bấm xác nhận, giữ nguyên nếu bấm lại.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Cột phải: Chọn phương thức Ví / Thẻ & Tổng tiền & Nút Xác nhận trả */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-stone-900">
                    Phương thức thanh toán
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                    💳 Không dùng tiền mặt
                  </span>
                </div>

                {/* Chọn Ví điện tử (WALLET) hoặc Thẻ ngân hàng (CARD) */}
                <div className="space-y-3" role="radiogroup" aria-label="Phương thức thanh toán">
                  <label
                    onClick={() => handleSelectMethod("WALLET")}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      paymentMethod === "WALLET"
                        ? "border-amber-800 bg-amber-50/60"
                        : "border-stone-200 hover:border-stone-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="WALLET"
                      checked={paymentMethod === "WALLET"}
                      onChange={() => handleSelectMethod("WALLET")}
                      className="mt-1 accent-amber-800"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">
                          Ví điện tử (WALLET)
                        </span>
                        <span className="text-xl">📱</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Thanh toán tức thì qua Ví MoMo, ZaloPay hoặc VNPay QR.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => handleSelectMethod("CARD")}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      paymentMethod === "CARD"
                        ? "border-amber-800 bg-amber-50/60"
                        : "border-stone-200 hover:border-stone-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CARD"
                      checked={paymentMethod === "CARD"}
                      onChange={() => handleSelectMethod("CARD")}
                      className="mt-1 accent-amber-800"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">
                          Thẻ ngân hàng (CARD)
                        </span>
                        <span className="text-xl">💳</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Thẻ ATM nội địa (Napas) hoặc thẻ quốc tế Visa / Mastercard.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Bảng tính tổng tiền */}
                <div className="mt-6 pt-5 border-t border-stone-200 space-y-2.5 text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>Tạm tính ({items.reduce((s, i) => s + i.quantity, 0)} món)</span>
                    <span className="font-medium text-stone-900">
                      {formatVND(displaySubtotal)}
                    </span>
                  </div>

                  {displayDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>
                        Giảm giá{" "}
                        {displayPromoCode ? (
                          <code className="font-mono text-xs bg-emerald-100 px-1.5 py-0.5 rounded">
                            {displayPromoCode}
                          </code>
                        ) : null}
                      </span>
                      <span className="font-semibold">
                        -{formatVND(displayDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-3 border-t border-stone-200">
                    <div>
                      <span className="text-base font-bold text-stone-900">
                        Tổng thanh toán
                      </span>
                      <p className="text-[11px] text-stone-500">
                        {currentOrder
                          ? "Số tiền chính thức do Server tính (POST /orders)"
                          : "Sẽ được Server xác nhận khi tạo đơn"}
                      </p>
                    </div>
                    <span className="text-2xl font-extrabold text-amber-900">
                      {formatVND(displayTotal)}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200/70">
                    <span>🎁 Điểm thưởng dự kiến (+1 điểm / 1.000đ):</span>
                    <span className="font-bold">
                      +{Math.floor(displayTotal / 1000)} điểm
                    </span>
                  </div>
                </div>

                {/* Thông báo Replay nếu có */}
                {replayNotice && (
                  <div className="mt-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                    <strong>🔁 Idempotent Replay:</strong> {replayNotice}
                  </div>
                )}

                {/* Hiển thị lỗi (Đặc biệt là lỗi 402 PAYMENT_FAILED) */}
                {errorState && (
                  <div
                    role="alert"
                    className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>
                          {errorState.statusCode === 402
                            ? "Thanh toán thất bại (HTTP 402)"
                            : `Lỗi (${errorState.code})`}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold">
                        {errorState.code}
                      </span>
                    </div>

                    <p className="text-xs text-red-800 leading-relaxed">
                      {errorState.message}
                    </p>

                    {errorState.replayed && (
                      <p className="text-[11px] font-medium text-red-700 bg-red-100/80 px-2.5 py-1 rounded">
                        🔁 Kết quả này được trả lại từ snapshot cũ (<code className="font-mono">Idempotent-Replayed: true</code>) do gửi trùng Idempotency-Key!
                      </p>
                    )}

                    {errorState.statusCode === 402 && (
                      <div className="pt-2 border-t border-red-200/80 space-y-2">
                        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                          ✓ Giỏ hàng của bạn vẫn được giữ nguyên. Đơn{" "}
                          <strong>{currentOrder?.code || `#${currentOrder?.id}`}</strong>{" "}
                          đang ở trạng thái <code className="font-mono">PAYMENT_FAILED</code>.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              // Đổi mockResult về SUCCESS nếu người dùng muốn thử lại thành công ngay
                              handleConfirmPayment({ forceNewKey: true });
                            }}
                            className="flex-1 px-3 py-2 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-colors cursor-pointer"
                          >
                            🔄 Thử lại với Key mới
                          </button>

                          {lastUsedKey && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() =>
                                handleConfirmPayment({ customKey: lastUsedKey })
                              }
                              className="px-3 py-2 rounded-lg border border-red-300 bg-white text-red-800 text-xs font-semibold hover:bg-red-100 transition-colors cursor-pointer"
                            >
                              🔁 Gửi lại cùng Key cũ (Test Replay)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {errorState.statusCode === 401 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        <Link
                          href="/login"
                          className="px-3 py-1.5 rounded-lg bg-red-800 text-white text-xs font-semibold hover:bg-red-900"
                        >
                          Đi tới trang Đăng nhập
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setUseMockMode(true);
                            setErrorState(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-900 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                        >
                          Chuyển sang Chế độ Dữ liệu giả
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Nút Xác nhận trả */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleConfirmPayment()}
                  className="mt-6 w-full py-3.5 px-6 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:bg-stone-400 text-white font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>
                        {stepStatus === "CREATING_ORDER"
                          ? "Đang tạo đơn hàng (POST /orders)..."
                          : "Đang xử lý thanh toán (POST /payments)..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Xác nhận trả</span>
                      <span>•</span>
                      <span>{formatVND(displayTotal)}</span>
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-xs text-stone-500">
                  Bằng việc bấm &ldquo;Xác nhận trả&rdquo;, hệ thống sẽ giữ tồn kho và thanh
                  toán an toàn chống trừ tiền 2 lần (<code className="font-mono">Idempotency-Key</code>).
                </p>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

