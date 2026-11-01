import { apiRequest } from "./client";

export type PaymentMethod = "WALLET" | "CARD";

export interface CreatePaymentRequest {
  orderId: number;
  method: PaymentMethod;
  mockResult?: "SUCCESS" | "FAILED";
}

export interface PaymentResponse {
  id?: number;
  orderId?: number;
  amount?: number;
  method?: PaymentMethod;
  status: string;
  message?: string;
}

export function createPayment(
  payload: CreatePaymentRequest,
  idempotencyKey: string
) {
  return apiRequest<PaymentResponse>("/payments", {
    method: "POST",
    authenticated: true,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: payload,
  });
}
