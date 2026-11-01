import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '../generated/prisma/client.js';

/**
 * Bảng định nghĩa chuyển tiếp trạng thái hợp lệ của đơn hàng (Mục 5 & 9.1 tài liệu API):
 * PENDING        → PAID | PAYMENT_FAILED | CANCELLED
 * PAYMENT_FAILED → PAID | CANCELLED
 * PAID           → PREPARING | CANCELLED
 * PREPARING      → READY
 * READY          → COMPLETED
 * COMPLETED      → (trạng thái kết thúc)
 * CANCELLED      → (trạng thái kết thúc)
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
  PAYMENT_FAILED: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Kiểm tra tính hợp lệ của việc chuyển đổi trạng thái đơn hàng.
 * Ném lỗi 409 INVALID_TRANSITION nếu bước nhảy không hợp lệ.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new ConflictException({
      code: 'INVALID_TRANSITION',
      message: `Không thể chuyển trạng thái từ ${from} → ${to}`,
    });
  }
}
