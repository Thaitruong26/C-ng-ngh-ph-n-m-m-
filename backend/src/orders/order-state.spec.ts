import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '../generated/prisma/client.js';
import { assertTransition } from './order-state.js';

describe('Order State Machine - assertTransition', () => {
  it('cho phép toàn bộ các bước chuyển tiếp hợp lệ trong luồng chính (happy path)', () => {
    // PENDING → PAID → PREPARING → READY → COMPLETED
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAID)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.PREPARING)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PREPARING, OrderStatus.READY)).not.toThrow();
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.COMPLETED)).not.toThrow();
  });

  it('cho phép các bước chuyển tiếp ngoại lệ hợp lệ (thanh toán lỗi, thử lại, hủy đơn)', () => {
    // PENDING → PAYMENT_FAILED
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED)).not.toThrow();
    // PAYMENT_FAILED → PAID (thử lại thành công)
    expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID)).not.toThrow();
    // PENDING → CANCELLED
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).not.toThrow();
    // PAYMENT_FAILED → CANCELLED
    expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED)).not.toThrow();
    // PAID → CANCELLED (hủy trước khi pha)
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).not.toThrow();
  });

  it('chặn các bước nhảy trạng thái sai và ném 409 INVALID_TRANSITION', () => {
    // PENDING nhảy thẳng COMPLETED
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toThrow(ConflictException);
    // PENDING nhảy thẳng READY
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.READY)).toThrow(ConflictException);
    // PENDING nhảy thẳng PREPARING (chưa trả tiền)
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PREPARING)).toThrow(ConflictException);

    // COMPLETED là trạng thái kết thúc, không được chuyển đi đâu
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.PAID)).toThrow(ConflictException);
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toThrow(ConflictException);
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.PENDING)).toThrow(ConflictException);

    // CANCELLED là trạng thái kết thúc, không được chuyển đi đâu
    expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toThrow(ConflictException);
    expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toThrow(ConflictException);

    // PREPARING hoặc READY không được hủy trực tiếp
    expect(() => assertTransition(OrderStatus.PREPARING, OrderStatus.CANCELLED)).toThrow(ConflictException);
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.CANCELLED)).toThrow(ConflictException);
  });

  it('thông điệp lỗi trả về đúng chuẩn với mã code INVALID_TRANSITION', () => {
    try {
      assertTransition(OrderStatus.PENDING, OrderStatus.COMPLETED);
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      const res = err.getResponse();
      expect(res.code).toBe('INVALID_TRANSITION');
      expect(res.message).toContain('PENDING → COMPLETED');
    }
  });
});
