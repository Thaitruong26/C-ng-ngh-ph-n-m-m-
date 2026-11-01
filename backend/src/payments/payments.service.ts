import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import {
  CreatePaymentDto,
  MockPaymentResult,
} from './dto/create-payment.dto.js';
import { assertTransition } from '../orders/order-state.js';
import {
  OrdersService,
  ORDER_PAYMENT_TIMEOUT_MS,
} from '../orders/orders.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
    @Optional() private readonly ordersService?: OrdersService,
  ) {}

  async createPayment(
    dto: CreatePaymentDto,
    idempotencyKey: string,
    user?: { id: number; role?: string },
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key is required');
    }

    const normalized = {
      orderId: dto.orderId,
      method: dto.method,
      mockResult: dto.mockResult ?? null,
    };

    const requestHash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key was used with a different request',
        );
      }

     if (existing.status === 'FAILED') {
  const snapshot = existing.responseSnapshot;

  throw new HttpException(
    snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? snapshot
      : { message: 'Payment failed' },
    402,
  );
}

      return existing.responseSnapshot ?? existing;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user && order.userId !== user.id && user.role !== 'BARISTA') {
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        'Order is not available for payment',
      );
    }

    if (order.createdAt) {
      const isExpired = Date.now() - new Date(order.createdAt).getTime() > ORDER_PAYMENT_TIMEOUT_MS;
      if (isExpired) {
        if (this.ordersService) {
          await this.ordersService.cancelOrderInternal(order.id);
        }
        throw new BadRequestException({
          code: 'ORDER_EXPIRED',
          message: 'Đơn hàng đã hết hạn thanh toán (quá 15 phút)',
        });
      }
    }

    const activePayment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: { in: ['PROCESSING', 'SUCCESS'] },
      },
    });

    if (activePayment) {
      if (activePayment.status === 'SUCCESS') {
        throw new ConflictException('Đơn hàng này đã được thanh toán thành công');
      }
      throw new ConflictException('Đơn hàng đang có một giao dịch thanh toán khác đang xử lý');
    }

    let payment;
    try {
      payment = await this.prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.total,
          method: dto.method,
          status: 'PROCESSING',
          idempotencyKey,
          requestHash,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Đơn hàng đang có một giao dịch thanh toán khác');
      }
      throw err;
    }

    const success = dto.mockResult !== MockPaymentResult.FAILED;

    const response = {
      paymentId: payment.id,
      orderId: order.id,
      amount: order.total,
      method: dto.method,
      status: success ? 'SUCCESS' : 'FAILED',
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          responseSnapshot: response,
          failureReason: success ? null : 'Mock payment failure',
        },
      });

      assertTransition(order.status as any, success ? 'PAID' : 'PAYMENT_FAILED');

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: success ? 'PAID' : 'PAYMENT_FAILED',
        },
      });

      if (success) {
        await this.loyaltyService.award(tx, order);
      }

      return updatedPayment.responseSnapshot ?? response;
    });

    if (!success) {
      throw new HttpException(response, 402);
    }

    return result;
  }
}
