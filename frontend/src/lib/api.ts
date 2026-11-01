import {
  ApiErrorDetail,
  ApiErrorResponse,
  CreateOrderDto,
  CreatePaymentDto,
  OrderResponse,
  PaymentResponse,
} from "@/types/order";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: ApiErrorDetail[];
  replayed?: boolean;

  constructor(
    payload: ApiErrorResponse,
    options?: { replayed?: boolean }
  ) {
    super(payload.message || "Đã xảy ra lỗi khi kết nối máy chủ.");
    this.name = "ApiError";
    this.statusCode = payload.statusCode || 500;
    this.code = payload.code || "UNKNOWN_ERROR";
    this.details = payload.details;
    this.replayed = options?.replayed;
  }
}

/**
 * Lấy JWT accessToken từ localStorage (tương thích với các key phổ biến của FE1)
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const directToken =
    window.localStorage.getItem("accessToken") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("brewlite_token");
  if (directToken) return directToken;

  // Kiểm tra trường hợp FE1 lưu trong Zustand persist (ví dụ auth-storage)
  try {
    const authStorage = window.localStorage.getItem("auth-storage");
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed?.state?.accessToken || parsed?.state?.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Định dạng tiền nguyên VND theo chuẩn của dự án (ví dụ: 123000 -> "123.000đ")
 */
export function formatVND(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${safeAmount.toLocaleString("vi-VN")}đ`;
}

/**
 * Hàm gọi API dùng chung theo chuẩn docs/api.md
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; headers: Headers; status: number }> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError({
      statusCode: 0,
      code: "NETWORK_ERROR",
      message:
        "Không thể kết nối tới máy chủ Backend (http://localhost:4000/api). Kiểm tra kết nối mạng hoặc bật chế độ Dữ liệu giả (Mock API) để demo.",
    });
  }

  const replayed = response.headers.get("Idempotent-Replayed") === "true";

  let body: unknown = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const errPayload = (body || {}) as Partial<ApiErrorResponse>;
    throw new ApiError(
      {
        statusCode: errPayload.statusCode ?? response.status,
        code: errPayload.code ?? `HTTP_${response.status}`,
        message:
          typeof errPayload.message === "string"
            ? errPayload.message
            : Array.isArray(errPayload.message)
              ? (errPayload.message as string[]).join(", ")
              : `Yêu cầu thất bại với mã HTTP ${response.status}`,
        details: errPayload.details,
      },
      { replayed }
    );
  }

  return {
    data: body as T,
    headers: response.headers,
    status: response.status,
  };
}

/**
 * Giai đoạn 2: POST /orders - Tạo đơn hàng ở trạng thái PENDING và giữ tồn kho
 */
export async function createOrderApi(
  payload: CreateOrderDto
): Promise<OrderResponse> {
  const { data } = await apiRequest<OrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
}

/**
 * Giai đoạn 3: POST /payments - Thanh toán không tiền mặt kèm Idempotency-Key
 */
export async function createPaymentApi(
  payload: CreatePaymentDto,
  idempotencyKey: string
): Promise<{ data: PaymentResponse; replayed: boolean }> {
  const { data, headers } = await apiRequest<PaymentResponse>("/payments", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  return {
    data,
    replayed: headers.get("Idempotent-Replayed") === "true",
  };
}

/**
 * Giai đoạn 3: GET /orders/:id - Lấy chi tiết đơn hàng cho Trang xác nhận đơn
 */
export async function getOrderByIdApi(orderId: number | string): Promise<OrderResponse> {
  const { data } = await apiRequest<OrderResponse>(`/orders/${orderId}`, {
    method: "GET",
  });
  return data;
}

