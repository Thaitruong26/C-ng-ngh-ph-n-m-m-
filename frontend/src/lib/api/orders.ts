import { apiRequest } from "./client";

export interface CreateOrderItem {
  productId: number;
  size: "S" | "M" | "L";
  toppingIds: number[];
  quantity: number;
  note?: string;
}

export interface CreateOrderRequest {
  items: CreateOrderItem[];
  promoCode?: string;
}

export interface OrderItemResponse {
  productId: number;
  productName: string;
  size: "S" | "M" | "L";
  toppings: {
    id: number;
    name: string;
    price: number;
  }[];
  unitPrice: number;
  qty: number;
  lineTotal: number;
  note?: string;
}

export interface OrderResponse {
  id: number;
  code: string;
  status: string;
  items: OrderItemResponse[];
  subtotal: number;
  discountAmount: number;
  total: number;
  pointsEarned?: number;
  createdAt?: string;
}

export function createOrder(payload: CreateOrderRequest) {
  return apiRequest<OrderResponse>("/orders", {
    method: "POST",
    authenticated: true,
    body: payload,
  });
}

export function getOrder(orderId: number) {
  return apiRequest<OrderResponse>(`/orders/${orderId}`, {
    authenticated: true,
  });
}
