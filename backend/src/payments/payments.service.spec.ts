import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import {
  MockPaymentResult,
  PaymentMethodInput,
} from './dto/create-payment.dto.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let loyaltyService: any;

  beforeEach(async () => {
    prisma = {
      payment: {
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    loyaltyService = {
      award: vi.fn().mockResolvedValue({ success: true, points: 50 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: loyaltyService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    const validDto = {
      orderId: 1,
      method: PaymentMethodInput.WALLET,
      mockResult: MockPaymentResult.SUCCESS,
    };
    const key = 'test-idempotency-key-123';
    const mockUser = { id: 10, role: 'CUSTOMER' };
    const mockOrder = {
      id: 1,
      userId: 10,
      total: 50000,
      status: 'PENDING',
    };

    it('should throw BadRequestException if idempotencyKey is missing', async () => {
      await expect(
        service.createPayment(validDto, '', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException ORDER_EXPIRED if order was created more than 15 minutes ago', async () => {
      const expiredOrder = {
        id: 1,
        userId: 10,
        total: 50000,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 phút trước
      };
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(expiredOrder);

      await expect(
        service.createPayment(validDto, key, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process payment successfully and award loyalty points', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.payment.create.mockResolvedValue({ id: 100, ...validDto, status: 'PROCESSING' });
      prisma.payment.update.mockResolvedValue({
        id: 100,
        status: 'SUCCESS',
        responseSnapshot: { paymentId: 100, status: 'SUCCESS', amount: 50000 },
      });

      const result = await service.createPayment(validDto, key, mockUser);

      expect(prisma.payment.findUnique).toHaveBeenCalledWith({ where: { idempotencyKey: key } });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'PAID' },
      });
      expect(loyaltyService.award).toHaveBeenCalledWith(expect.anything(), mockOrder);
      expect(result).toHaveProperty('status', 'SUCCESS');
    });

    it('should be idempotent: return cached response if key is reused with same request', async () => {
      const cachedResponse = {
        paymentId: 100,
        orderId: 1,
        amount: 50000,
        method: PaymentMethodInput.WALLET,
        status: 'SUCCESS',
      };

      // Giả lập key đã tồn tại trong DB với cùng requestHash
      prisma.payment.findUnique.mockImplementation(async ({ where }: any) => {
        // Lấy đúng requestHash
        const { createHash } = await import('node:crypto');
        const hash = createHash('sha256')
          .update(JSON.stringify({
            orderId: validDto.orderId,
            method: validDto.method,
            mockResult: validDto.mockResult ?? null,
          }))
          .digest('hex');

        return {
          id: 100,
          idempotencyKey: where.idempotencyKey,
          requestHash: hash,
          status: 'SUCCESS',
          responseSnapshot: cachedResponse,
        };
      });

      const result = await service.createPayment(validDto, key, mockUser);

      // Trả lại kết quả cũ, KHÔNG tạo payment mới và KHÔNG update order lại
      expect(result).toEqual(cachedResponse);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(loyaltyService.award).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if key is reused with a different request payload', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 100,
        idempotencyKey: key,
        requestHash: 'different-hash',
        status: 'SUCCESS',
      });

      await expect(
        service.createPayment(validDto, key, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle mock failure by returning 402 and updating order to PAYMENT_FAILED', async () => {
      const failedDto = {
        ...validDto,
        mockResult: MockPaymentResult.FAILED,
      };

      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.payment.create.mockResolvedValue({ id: 101, status: 'PROCESSING' });
      prisma.payment.update.mockResolvedValue({ id: 101, status: 'FAILED' });

      await expect(
        service.createPayment(failedDto, key, mockUser),
      ).rejects.toThrow(HttpException);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'PAYMENT_FAILED' },
      });
      // Không cộng điểm khi thất bại
      expect(loyaltyService.award).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(validDto, key, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order belongs to another user', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 999, // user khác
      });

      await expect(
        service.createPayment(validDto, key, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order status is not PENDING', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PAID', // đã thanh toán rồi
      });

      await expect(
        service.createPayment(validDto, key, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
