import {
  CreateOrderDto,
  CreatePaymentDto,
  OrderResponse,
  PaymentResponse,
} from "@/types/order";
import { ApiError } from "./api-error";
import { mockApi, shouldUseMock } from "./mock";

export { ApiError };

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const API_BASE = API_BASE_URL;

/**
 * Lấy JWT accessToken từ localStorage (tương thích với tất cả các key từ FE1, FE2, FE3)
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const directToken =
    window.localStorage.getItem("accessToken") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("brewlite_access_token") ||
    window.localStorage.getItem("brewlite_token");
  if (directToken) return directToken;

  // Kiểm tra trường hợp lưu trong Zustand persist (auth-storage hoặc brewlite.auth)
  try {
    const authStorage = window.localStorage.getItem("auth-storage");
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      const token = parsed?.state?.accessToken || parsed?.state?.token;
      if (token) return token;
    }
  } catch {
    // ignore
  }

  try {
    const brewliteAuth = window.localStorage.getItem("brewlite.auth");
    if (brewliteAuth) {
      const parsed = JSON.parse(brewliteAuth) as { accessToken?: string };
      if (parsed?.accessToken) return parsed.accessToken;
    }
  } catch {
    // ignore
  }

  return null;
}

export const getToken = getAccessToken;

export type User = {
  id: number;
  email: string;
  fullName?: string;
  role?: string;
  loyaltyPoints?: number;
};

export function saveSession(token: string, user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem("brewlite_access_token", token);
  localStorage.setItem("accessToken", token);
  localStorage.setItem("brewlite_user", JSON.stringify(user));
  localStorage.setItem(
    "brewlite.auth",
    JSON.stringify({ accessToken: token, user }),
  );
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("brewlite_access_token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("brewlite_user");
  localStorage.removeItem("brewlite.auth");
}

export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("brewlite_user");
  if (raw) {
    try {
      return JSON.parse(raw) as User;
    } catch {
      // ignore
    }
  }
  try {
    const auth = localStorage.getItem("brewlite.auth");
    if (auth) return (JSON.parse(auth) as { user?: User }).user ?? null;
  } catch {
    // ignore
  }
  return null;
}

/** Dạng phân trang chung (api.md mục 2.3). */
export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Định dạng tiền nguyên VND theo chuẩn của dự án (ví dụ: 123000 -> "123.000đ")
 */
export function formatVND(value: number): string {
  const safeAmount = Number.isFinite(value) ? Math.round(value) : 0;
  return `${safeAmount.toLocaleString("vi-VN")}đ`;
}

/**
 * Hàm gọi API (dùng cho FE2)
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (shouldUseMock(path)) return mockApi<T>(path, init);

  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(
      `Không kết nối được máy chủ. Kiểm tra backend tại ${API_BASE}`,
      0,
      "NETWORK_ERROR",
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message;
    throw new ApiError(
      Array.isArray(message)
        ? message.join(", ")
        : message || `Yêu cầu thất bại (${response.status})`,
      response.status,
      typeof payload?.code === "string" ? payload.code : "ERROR",
      payload?.details,
    );
  }
  return payload as T;
}

/**
 * Hàm gọi API dùng chung theo chuẩn docs/api.md (dùng cho FE3)
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
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
    const errPayload = (body || {}) as {
      statusCode?: number;
      code?: string;
      message?: string | string[];
      details?: unknown;
    };
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
        details: errPayload.details as any,
      },
      { replayed },
    );
  }

  return {
    data: body as T,
    headers: response.headers,
    status: response.status,
  };
}

/**
 * POST /orders - Tạo đơn hàng ở trạng thái PENDING và giữ tồn kho
 */
export async function createOrderApi(
  payload: CreateOrderDto,
): Promise<OrderResponse> {
  const { data } = await apiRequest<OrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
}

/**
 * POST /payments - Thanh toán không tiền mặt kèm Idempotency-Key
 */
export async function createPaymentApi(
  payload: CreatePaymentDto,
  idempotencyKey: string,
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
 * GET /orders/:id - Lấy chi tiết đơn hàng cho Trang xác nhận đơn
 */
export async function getOrderByIdApi(
  orderId: number | string,
): Promise<OrderResponse> {
  const { data } = await apiRequest<OrderResponse>(`/orders/${orderId}`, {
    method: "GET",
  });
  return data;
}
