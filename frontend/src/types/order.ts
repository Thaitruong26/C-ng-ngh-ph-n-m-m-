export type Size = "S" | "M" | "L";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "PAYMENT_FAILED"
  | "CANCELLED";

export type PaymentMethod = "WALLET" | "CARD";

export type PaymentStatus = "PROCESSING" | "SUCCESS" | "FAILED";

export type MockPaymentResult = "SUCCESS" | "FAILED";

export interface ToppingSnapshot {
  id: number;
  name: string;
  price: number;
}

export interface CartItem {
  id?: string;
  productId: number;
  productName: string;
  imageUrl?: string;
  basePrice: number;
  size: Size;
  sizeSurcharge: number;
  toppings: ToppingSnapshot[];
  quantity: number;
  note?: string;
}

export interface CreateOrderItemDto {
  productId: number;
  size: Size;
  toppingIds: number[];
  quantity: number;
  note?: string;
}

export interface CreateOrderDto {
  items: CreateOrderItemDto[];
  promoCode?: string;
}

export interface OrderItemResponse {
  id?: number;
  productId: number;
  productName: string;
  size: Size;
  toppings: ToppingSnapshot[];
  unitPrice: number;
  qty: number;
  lineTotal: number;
  note?: string | null;
}

export interface OrderPaymentSnapshot {
  id?: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  providerRef?: string | null;
  failureReason?: string | null;
  createdAt?: string;
}

export interface OrderResponse {
  id: number;
  code: string;
  status: OrderStatus;
  items: OrderItemResponse[];
  subtotal: number;
  discountAmount: number;
  total: number;
  promoCode?: string | null;
  pointsEarned?: number;
  payments?: OrderPaymentSnapshot[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePaymentDto {
  orderId: number;
  method: PaymentMethod;
  mockResult?: MockPaymentResult;
}

export interface PaymentResponse {
  payment: {
    id: number;
    orderId: number;
    amount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    providerRef?: string | null;
    failureReason?: string | null;
  };
  order: {
    id: number;
    code: string;
    status: OrderStatus;
    total: number;
    pointsEarned: number;
  };
}

export interface ApiErrorDetail {
  productId?: number;
  available?: number;
  requested?: number;
  field?: string;
  message?: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  path?: string;
  timestamp?: string;
}

