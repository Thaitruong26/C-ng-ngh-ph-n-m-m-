import { apiRequest } from "./client";
import type { PaginatedResponse } from "./types";

export interface BaristaOrderItem {
  productName: string;
  size: "S" | "M" | "L";
  qty: number;
  toppings: { name: string; price?: number }[];
  note?: string | null;
}

export interface BaristaOrder {
  id: number;
  code: string;
  customerName?: string | null;
  status: "PAID" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  total: number;
  items: BaristaOrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export function getBaristaOrders(status?: string, page = 1, limit = 50) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page) query.set("page", String(page));
  if (limit) query.set("limit", String(limit));
  return apiRequest<PaginatedResponse<BaristaOrder>>(
    `/orders?${query.toString()}`,
    {
      authenticated: true,
    },
  );
}

export function updateOrderStatus(
  orderId: number,
  status: "PREPARING" | "READY" | "COMPLETED",
) {
  return apiRequest<BaristaOrder>(`/orders/${orderId}/status`, {
    method: "PATCH",
    authenticated: true,
    body: { status },
  });
}

export function cancelBaristaOrder(orderId: number) {
  return apiRequest<BaristaOrder>(`/orders/${orderId}/cancel`, {
    method: "POST",
    authenticated: true,
  });
}

export interface ProductStockInfo {
  id: number;
  name: string;
  stock: number;
  inStock: boolean;
  price: number;
  category: string;
}

export function getProductsStock() {
  return apiRequest<PaginatedResponse<ProductStockInfo>>("/products?limit=100", {
    authenticated: true,
  });
}

export function addProductStock(
  productId: number,
  quantity: number,
  note?: string,
) {
  return apiRequest<{
    id: number;
    name: string;
    stock: number;
    inStock: boolean;
  }>(`/products/${productId}/stock`, {
    method: "POST",
    authenticated: true,
    body: { quantity, note },
  });
}

export interface BackendIngredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  lowThreshold: number;
  low: boolean;
}

export function getIngredientsStock(page = 1, limit = 50) {
  return apiRequest<PaginatedResponse<BackendIngredient>>(
    `/ingredients?page=${page}&limit=${limit}`,
    {
      authenticated: false,
    },
  );
}

export function addIngredientStock(
  ingredientId: number,
  quantity: number,
  note?: string,
) {
  return apiRequest<BackendIngredient>(`/ingredients/${ingredientId}/stock`, {
    method: "POST",
    authenticated: true,
    body: { quantity, note },
  });
}
