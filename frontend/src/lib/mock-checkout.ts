import {
  CartItem,
  CreateOrderDto,
  CreatePaymentDto,
  OrderResponse,
  PaymentResponse,
  Size,
} from "@/types/order";

export const SIZE_SURCHARGE: Record<Size, number> = {
  S: 0,
  M: 5000,
  L: 10000,
};

/**
 * Giỏ hàng mẫu bám sát tài liệu API (docs/api.md mục 6.8 & wireframe A1.md)
 * - Cappuccino (id: 3, giá gốc 45.000đ) + Size M (+5.000đ) + Trân châu (+5.000đ) = 55.000đ x 1
 * - Cà phê sữa (id: 1, giá gốc 35.000đ) + Size S (+0đ) + Không topping = 35.000đ x 1
 * - Americano (id: 2, giá gốc 40.000đ) + Size S (+0đ) + Không topping = 40.000đ x 1
 * (Hoặc bộ mẫu 2 món Cappuccino M + Trà đào L x2 từ docs/api.md)
 */
export const MOCK_CART_ITEMS: CartItem[] = [
  {
    id: "mock-item-1",
    productId: 3,
    productName: "Cappuccino",
    imageUrl: "/img/cappuccino.jpg",
    basePrice: 45000,
    size: "M",
    sizeSurcharge: 5000,
    toppings: [{ id: 1, name: "Trân châu", price: 5000 }],
    quantity: 1,
    note: "Ít bọt sữa",
  },
  {
    id: "mock-item-2",
    productId: 4,
    productName: "Trà đào",
    imageUrl: "/img/tra-dao.jpg",
    basePrice: 39000,
    size: "L",
    sizeSurcharge: 10000,
    toppings: [],
    quantity: 2,
    note: "Ít đá",
  },
];

export const MOCK_ORDER_1042: OrderResponse = {
  id: 1042,
  code: "#1042",
  status: "PAID",
  items: [
    {
      id: 1,
      productId: 3,
      productName: "Cappuccino",
      size: "M",
      toppings: [{ id: 1, name: "Trân châu", price: 5000 }],
      unitPrice: 55000,
      qty: 1,
      lineTotal: 55000,
      note: "Ít bọt sữa",
    },
    {
      id: 2,
      productId: 4,
      productName: "Trà đào",
      size: "L",
      toppings: [],
      unitPrice: 34000,
      qty: 2,
      lineTotal: 68000,
      note: "Ít đá",
    },
  ],
  subtotal: 123000,
  discountAmount: 12300,
  total: 110700,
  promoCode: "BREW10",
  pointsEarned: 110,
  payments: [
    {
      id: 77,
      method: "WALLET",
      status: "SUCCESS",
      amount: 110700,
      providerRef: "MOCK-8F2A91",
      createdAt: "2026-10-08T09:30:00.000Z",
    },
  ],
  createdAt: "2026-10-08T09:30:00.000Z",
};

const MOCK_ORDERS_STORAGE_KEY = "brewlite_mock_orders";
const MOCK_IDEMPOTENCY_STORAGE_KEY = "brewlite_mock_idempotency";

interface StoredIdempotencyRecord {
  requestHash: string;
  statusCode: number;
  response: PaymentResponse | { statusCode: number; code: string; message: string; order?: OrderResponse };
}

export function getSavedMockOrders(): Record<number, OrderResponse> {
  if (typeof window === "undefined") return { 1042: MOCK_ORDER_1042 };
  try {
    const raw = window.localStorage.getItem(MOCK_ORDERS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<number, OrderResponse>) : {};
    return { 1042: MOCK_ORDER_1042, ...parsed };
  } catch {
    return { 1042: MOCK_ORDER_1042 };
  }
}

export function saveMockOrder(order: OrderResponse): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSavedMockOrders();
    current[order.id] = order;
    window.localStorage.setItem(MOCK_ORDERS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

export function createMockOrderFromCart(
  dto: CreateOrderDto,
  cartItems: CartItem[],
  discountAmountFromStore = 0
): OrderResponse {
  const items = cartItems.map((item, idx) => {
    const toppingsTotal = item.toppings.reduce((sum, t) => sum + t.price, 0);
    const unitPrice = item.basePrice + item.sizeSurcharge + toppingsTotal;
    const lineTotal = unitPrice * item.quantity;
    return {
      id: idx + 1,
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      toppings: item.toppings,
      unitPrice,
      qty: item.quantity,
      lineTotal,
      note: item.note ?? null,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const normalizedPromo = dto.promoCode?.trim().toUpperCase() || null;

  let discountAmount = discountAmountFromStore;
  if (!discountAmount && normalizedPromo === "BREW10" && subtotal >= 50000) {
    discountAmount = Math.min(Math.floor((subtotal * 10) / 100), 30000);
  } else if (!discountAmount && normalizedPromo === "GIAM15K" && subtotal >= 80000) {
    discountAmount = Math.min(15000, subtotal);
  }

  const total = Math.max(0, subtotal - discountAmount);
  const id = 1042;

  const order: OrderResponse = {
    id,
    code: `#${id}`,
    status: "PENDING",
    items,
    subtotal,
    discountAmount,
    total,
    promoCode: normalizedPromo,
    pointsEarned: 0,
    payments: [],
    createdAt: new Date().toISOString(),
  };

  saveMockOrder(order);
  return order;
}

export function processMockPayment(
  dto: CreatePaymentDto,
  idempotencyKey: string
): {
  statusCode: number;
  replayed: boolean;
  data: PaymentResponse;
  error?: { statusCode: number; code: string; message: string };
} {
  const orders = getSavedMockOrders();
  const order = orders[dto.orderId] ?? MOCK_ORDER_1042;

  const requestHash = JSON.stringify({
    orderId: dto.orderId,
    method: dto.method,
    mockResult: dto.mockResult ?? "SUCCESS",
  });

  if (typeof window !== "undefined") {
    try {
      const rawMap = window.localStorage.getItem(MOCK_IDEMPOTENCY_STORAGE_KEY);
      const map: Record<string, StoredIdempotencyRecord> = rawMap ? JSON.parse(rawMap) : {};
      const existing = map[idempotencyKey];

      if (existing) {
        if (existing.requestHash !== requestHash) {
          return {
            statusCode: 422,
            replayed: false,
            data: null as unknown as PaymentResponse,
            error: {
              statusCode: 422,
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "Idempotency-Key đã được sử dụng với dữ liệu thanh toán khác.",
            },
          };
        }
        if (existing.statusCode === 402) {
          return {
            statusCode: 402,
            replayed: true,
            data: null as unknown as PaymentResponse,
            error: existing.response as { statusCode: number; code: string; message: string },
          };
        }
        return {
          statusCode: 201,
          replayed: true,
          data: existing.response as PaymentResponse,
        };
      }
    } catch {
      // ignore storage errors
    }
  }

  const isFailed = dto.mockResult === "FAILED";

  if (isFailed) {
    const updatedOrder: OrderResponse = {
      ...order,
      status: "PAYMENT_FAILED",
      payments: [
        ...(order.payments ?? []),
        {
          id: Math.floor(Math.random() * 900) + 100,
          method: dto.method,
          status: "FAILED",
          amount: order.total,
          providerRef: null,
          failureReason: "Cổng thanh toán từ chối giao dịch (mockResult = FAILED)",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    saveMockOrder(updatedOrder);

    const errPayload = {
      statusCode: 402,
      code: "PAYMENT_FAILED",
      message:
        dto.method === "WALLET"
          ? "Thanh toán Ví điện tử thất bại: Số dư không đủ hoặc giao dịch bị từ chối."
          : "Thanh toán Thẻ ngân hàng thất bại: Thẻ bị từ chối bởi ngân hàng phát hành.",
    };

    if (typeof window !== "undefined") {
      try {
        const rawMap = window.localStorage.getItem(MOCK_IDEMPOTENCY_STORAGE_KEY);
        const map: Record<string, StoredIdempotencyRecord> = rawMap ? JSON.parse(rawMap) : {};
        map[idempotencyKey] = {
          requestHash,
          statusCode: 402,
          response: errPayload,
        };
        window.localStorage.setItem(MOCK_IDEMPOTENCY_STORAGE_KEY, JSON.stringify(map));
      } catch {
        // ignore
      }
    }

    return {
      statusCode: 402,
      replayed: false,
      data: null as unknown as PaymentResponse,
      error: errPayload,
    };
  }

  const pointsEarned = Math.floor(order.total / 1000);
  const providerRef = `MOCK-${Math.random().toString(16).substring(2, 8).toUpperCase()}`;

  const updatedOrder: OrderResponse = {
    ...order,
    status: "PAID",
    pointsEarned,
    payments: [
      ...(order.payments ?? []),
      {
        id: 77,
        method: dto.method,
        status: "SUCCESS",
        amount: order.total,
        providerRef,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  saveMockOrder(updatedOrder);

  const response: PaymentResponse = {
    payment: {
      id: 77,
      orderId: updatedOrder.id,
      amount: updatedOrder.total,
      method: dto.method,
      status: "SUCCESS",
      providerRef,
    },
    order: {
      id: updatedOrder.id,
      code: updatedOrder.code || `#${updatedOrder.id}`,
      status: "PAID",
      total: updatedOrder.total,
      pointsEarned,
    },
  };

  if (typeof window !== "undefined") {
    try {
      const rawMap = window.localStorage.getItem(MOCK_IDEMPOTENCY_STORAGE_KEY);
      const map: Record<string, StoredIdempotencyRecord> = rawMap ? JSON.parse(rawMap) : {};
      map[idempotencyKey] = {
        requestHash,
        statusCode: 201,
        response,
      };
      window.localStorage.setItem(MOCK_IDEMPOTENCY_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  return {
    statusCode: 201,
    replayed: false,
    data: response,
  };
}

