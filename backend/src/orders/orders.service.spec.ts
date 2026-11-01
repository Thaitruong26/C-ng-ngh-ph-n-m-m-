import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrderStatus, Role, Size } from '../generated/prisma/client.js';
import { RecipeService } from '../common/recipe/recipe.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaMock: any;
  let pricingServiceMock: any;
  let recipeService: RecipeService;

  beforeEach(() => {
    recipeService = new RecipeService();

    prismaMock = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      topping: {
        findMany: vi.fn(),
      },
      ingredient: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      promoCode: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      order: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      loyaltyTransaction: {
        updateMany: vi.fn(),
      },
      payment: {
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    pricingServiceMock = {
      calculate: vi.fn().mockResolvedValue({
        lines: [
          {
            productId: 1,
            productName: 'Cà phê sữa',
            size: Size.M,
            toppings: [{ id: 1, name: 'Trân châu', price: 5000 }],
            unitPrice: 45000,
            qty: 2,
            lineTotal: 90000,
            note: 'ít đá',
          },
        ],
        subtotal: 90000,
      }),
      pointsFor: vi.fn().mockReturnValue(90),
    };

    service = new OrdersService(prismaMock, pricingServiceMock, recipeService);
  });

  describe('createOrder (Kho theo nguyên liệu & optimistic locking)', () => {
    it('tạo đơn thành công khi còn tồn nguyên liệu, ghi StockMovement ORDER_RESERVE và lưu consumption', async () => {
      // Mock sản phẩm có công thức
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê sữa',
          isActive: true,
          productRecipes: [
            { ingredientId: 10, quantity: 50 }, // Cà phê: 50ml/ly
            { ingredientId: 20, quantity: 30 }, // Sữa đặc: 30g/ly
          ],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      // Mock tồn kho nguyên liệu dồi dào
      prismaMock.ingredient.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 10) return { id: 10, name: 'Cà phê', stock: 1000, version: 0 };
        if (where.id === 20) return { id: 20, name: 'Sữa đặc', stock: 500, version: 0 };
        return null;
      });
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });

      // Mock Order.create
      prismaMock.order.create.mockImplementation(async ({ data }: any) => ({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        items: data.items.create,
      }));

      const res = await service.createOrder(1, {
        items: [{ productId: 1, size: Size.M, quantity: 2 }],
      });

      expect(pricingServiceMock.calculate).toHaveBeenCalled();
      // Kiểm tra trừ kho nguyên liệu: 2 ly size M -> Cà phê 100ml, Sữa đặc 60g
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 10, version: 0, stock: { gte: 100 } },
        data: { stock: { decrement: 100 }, version: { increment: 1 } },
      });
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 20, version: 0, stock: { gte: 60 } },
        data: { stock: { decrement: 60 }, version: { increment: 1 } },
      });

      // Kiểm tra ghi StockMovement ORDER_RESERVE
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 10,
          type: 'ORDER_RESERVE',
          quantity: -100,
          orderId: 101,
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 20,
          type: 'ORDER_RESERVE',
          quantity: -60,
          orderId: 101,
        },
      });

      expect(res.id).toBe(101);
      expect(res.status).toBe(OrderStatus.PENDING);
    });

    it('báo lỗi 409 RECIPE_MISSING khi sản phẩm chưa có công thức', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 99,
          name: 'Món mới',
          isActive: true,
          productRecipes: [], // Chưa có công thức
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder(1, {
          items: [{ productId: 99, size: Size.M, quantity: 1 }],
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.createOrder(1, {
          items: [{ productId: 99, size: Size.M, quantity: 1 }],
        });
      } catch (err: any) {
        expect(err.getResponse().code).toBe('RECIPE_MISSING');
        expect(err.getResponse().details[0].productId).toBe(99);
      }
    });

    it('báo lỗi 409 OUT_OF_STOCK với details chi tiết khi tồn kho nguyên liệu không đủ', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê muối',
          isActive: true,
          productRecipes: [{ ingredientId: 2, quantity: 1 }], // Cần 1g muối/ly
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      // Tồn muối chỉ còn 1g nhưng khách đặt 2 ly
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 2,
        name: 'Muối',
        stock: 1,
        version: 0,
      });

      try {
        await service.createOrder(1, {
          items: [{ productId: 1, size: Size.M, quantity: 2 }],
        });
        expect.unreachable('Cần ném OUT_OF_STOCK');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const resp = err.getResponse();
        expect(resp.code).toBe('OUT_OF_STOCK');
        expect(resp.details[0]).toEqual({
          ingredientId: 2,
          ingredient: 'Muối',
          available: 1,
          required: 2,
          products: ['Cà phê muối'],
        });
      }
    });

    it('tiêu chí (c): đặt đồng thời 10 đơn khi nguyên liệu chỉ đủ 5 ly -> đúng 5 đơn thành công, 5 thất bại, tồn cuối = 0', async () => {
      // Giả lập nguyên liệu Muối (id: 2) chỉ còn 5g, mỗi ly size M tốn 1g -> đúng 5 ly
      let currentStock = 5;
      let currentVersion = 0;
      const movements: any[] = [];

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê muối',
          isActive: true,
          productRecipes: [{ ingredientId: 2, quantity: 1 }],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      prismaMock.ingredient.findUnique.mockImplementation(async () => ({
        id: 2,
        name: 'Muối',
        stock: currentStock,
        version: currentVersion,
      }));

      prismaMock.ingredient.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.version === currentVersion && currentStock >= where.stock.gte) {
          currentStock -= data.stock.decrement;
          currentVersion += data.version.increment;
          return { count: 1 };
        }
        return { count: 0 };
      });

      prismaMock.stockMovement.create.mockImplementation(async ({ data }: any) => {
        movements.push(data);
        return { id: movements.length, ...data };
      });

      prismaMock.order.create.mockImplementation(async ({ data }: any) => ({
        id: Math.floor(Math.random() * 1000) + 1,
        ...data,
        createdAt: new Date(),
        items: [{ qty: 1 }],
      }));

      // Bắn 10 request đồng thời qua Promise.allSettled
      const results = await Promise.allSettled(
        Array.from({ length: 10 }).map((_, i) =>
          service.createOrder(i + 1, {
            items: [{ productId: 1, size: Size.M, quantity: 1 }],
          }),
        ),
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Đúng 5 đơn thành công
      expect(successful).toHaveLength(5);
      // 5 đơn thất bại OUT_OF_STOCK
      expect(failed).toHaveLength(5);
      // Tồn kho cuối cùng đúng bằng 0
      expect(currentStock).toBe(0);
      expect(currentVersion).toBe(5);

      // Bất biến: tồn kho ban đầu (5) + tổng các StockMovement (-1 * 5) = tồn kho cuối (0)
      const totalMoved = movements.reduce((sum, m) => sum + m.quantity, 0);
      expect(5 + totalMoved).toBe(currentStock);
    });

    it('gộp theo nguyên liệu: hai món cùng dùng sữa, tổng nhu cầu vượt tồn kho thì từ chối cả đơn', async () => {
      // Món A cần 100ml sữa, Món B cần 120ml sữa -> tổng 220ml
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Trà Sữa A',
          isActive: true,
          productRecipes: [{ ingredientId: 5, quantity: 100 }],
        },
        {
          id: 2,
          name: 'Trà Sữa B',
          isActive: true,
          productRecipes: [{ ingredientId: 5, quantity: 120 }],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      // Sữa chỉ còn 200ml (đủ cho từng món riêng lẻ nhưng không đủ cho cả đơn 220ml)
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 5,
        name: 'Sữa tươi',
        stock: 200,
        version: 0,
      });

      await expect(
        service.createOrder(1, {
          items: [
            { productId: 1, size: Size.M, quantity: 1 },
            { productId: 2, size: Size.M, quantity: 1 },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rollback: món cần hai nguyên liệu, một cái hết thì nguyên liệu còn lại không bị trừ', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê muối',
          isActive: true,
          productRecipes: [
            { ingredientId: 10, quantity: 50 }, // Cà phê: còn nhiều
            { ingredientId: 20, quantity: 1 }, // Muối: đã hết
          ],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      prismaMock.ingredient.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 10) return { id: 10, name: 'Cà phê', stock: 1000, version: 0 };
        if (where.id === 20) return { id: 20, name: 'Muối', stock: 0, version: 0 };
        return null;
      });
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createOrder(1, {
          items: [{ productId: 1, size: Size.M, quantity: 1 }],
        }),
      ).rejects.toThrow(ConflictException);

      // Vì giao dịch thất bại trước khi trừ hoặc trong transaction bị rollback, không tạo order
      expect(prismaMock.order.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder (Hoàn kho theo snapshot OrderItem.consumption)', () => {
    it('hoàn kho đúng theo snapshot consumption, không phụ thuộc vào công thức hiện tại', async () => {
      // Đơn hàng có snapshot lúc đặt tiêu thụ 120ml sữa (id: 5) và 40g trân châu (id: 12)
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        items: [
          {
            productId: 1,
            qty: 1,
            consumption: [
              { ingredientId: 5, quantity: 120 },
              { ingredientId: 12, quantity: 40 },
            ],
          },
        ],
        payments: [],
      });

      prismaMock.order.update.mockResolvedValue({
        id: 101,
        status: OrderStatus.CANCELLED,
      });

      const res = await service.cancelOrder(101, { id: 1, role: Role.CUSTOMER });

      // Hoàn lại nguyên liệu theo consumption
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { stock: { increment: 120 }, version: { increment: 1 } },
      });
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: { stock: { increment: 40 }, version: { increment: 1 } },
      });

      // Ghi StockMovement ORDER_RELEASE (+)
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 5,
          type: 'ORDER_RELEASE',
          quantity: 120,
          orderId: 101,
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 12,
          type: 'ORDER_RELEASE',
          quantity: 40,
          orderId: 101,
        },
      });

      expect(res.status).toBe(OrderStatus.CANCELLED);
    });

    it('chặn hủy đơn khi đơn đã sang PREPARING', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PREPARING,
        items: [],
        payments: [],
      });

      await expect(
        service.cancelOrder(101, { id: 1, role: Role.CUSTOMER }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getOrdersMe (Task 9)', () => {
    it('trả về danh sách đơn của user kèm itemCount và phân trang', async () => {
      prismaMock.order.count.mockResolvedValue(1);
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 101,
          status: OrderStatus.PAID,
          total: 90000,
          createdAt: new Date('2026-10-26T10:00:00.000Z'),
          items: [{ qty: 2 }, { qty: 1 }],
        },
      ]);

      const res = await service.getOrdersMe(1, { page: 1, limit: 10 });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
          skip: 0,
          take: 10,
        }),
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0].code).toBe('#101');
      expect(res.data[0].itemCount).toBe(3); // 2 + 1 = 3 ly
      expect(res.meta.total).toBe(1);
    });
  });

  describe('getOrderById (Task 9)', () => {
    it('trả về chi tiết đơn hàng cho chính chủ', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PAID,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        pointsEarned: 90,
        items: [],
        payments: [],
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        updatedAt: new Date('2026-10-26T10:05:00.000Z'),
      });

      const res = await service.getOrderById(101, { id: 1, role: Role.CUSTOMER });
      expect(res.id).toBe(101);
      expect(res.code).toBe('#101');
    });

    it('Barista có quyền xem đơn hàng của bất kỳ ai', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 2,
        status: OrderStatus.PAID,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        pointsEarned: 90,
        items: [],
        payments: [],
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        updatedAt: new Date('2026-10-26T10:05:00.000Z'),
      });

      const res = await service.getOrderById(101, { id: 1, role: Role.BARISTA });
      expect(res.id).toBe(101);
    });

    it('ném 404 khi không tìm thấy đơn hàng', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById(999, { id: 1, role: Role.CUSTOMER }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrderStatus (Task 10 / Barista)', () => {
    it('Barista chuyển bước thành công PAID → PREPARING', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        status: OrderStatus.PAID,
      });
      prismaMock.order.update.mockResolvedValue({
        id: 101,
        status: OrderStatus.PREPARING,
      });

      const res = await service.updateOrderStatus(101, OrderStatus.PREPARING, {
        id: 2,
        role: Role.BARISTA,
      });

      expect(res.status).toBe(OrderStatus.PREPARING);
    });

    it('từ chối nếu user không phải Barista', async () => {
      await expect(
        service.updateOrderStatus(101, OrderStatus.PREPARING, {
          id: 1,
          role: Role.CUSTOMER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancelExpiredOrders (Hạn thanh toán 15 phút)', () => {
    it('quét các đơn PENDING quá 15 phút, hoàn kho nguyên liệu và đổi sang CANCELLED', async () => {
      const pastDate = new Date(Date.now() - 20 * 60 * 1000); // 20 phút trước
      const expiredOrder = {
        id: 201,
        userId: 1,
        status: OrderStatus.PENDING,
        promoCode: 'GIAM10',
        items: [
          {
            id: 1,
            productId: 1,
            consumption: [{ ingredientId: 10, quantity: 50 }],
          },
        ],
        payments: [],
        createdAt: pastDate,
      };

      prismaMock.order.findMany.mockResolvedValue([expiredOrder]);
      prismaMock.order.findUnique.mockResolvedValue(expiredOrder);
      prismaMock.ingredient.update.mockResolvedValue({});
      prismaMock.stockMovement.create.mockResolvedValue({});
      prismaMock.promoCode.update.mockResolvedValue({});
      prismaMock.order.update.mockResolvedValue({ ...expiredOrder, status: OrderStatus.CANCELLED });

      const count = await service.cancelExpiredOrders();

      expect(count).toBe(1);
      expect(prismaMock.order.findMany).toHaveBeenCalled();
      // Hoàn kho
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { stock: { increment: 50 }, version: { increment: 1 } },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 10,
          type: 'ORDER_RELEASE',
          quantity: 50,
          orderId: 201,
        },
      });
      // Hoàn promoCode
      expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
        where: { code: 'GIAM10' },
        data: { usedCount: { decrement: 1 } },
      });
      // Đổi status
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    it('không hủy nếu đơn có giao dịch đang PROCESSING', async () => {
      const pastDate = new Date(Date.now() - 20 * 60 * 1000);
      const processingOrder = {
        id: 202,
        status: OrderStatus.PENDING,
        items: [],
        payments: [{ id: 1, status: 'PROCESSING' }],
        createdAt: pastDate,
      };

      prismaMock.order.findMany.mockResolvedValue([processingOrder]);
      prismaMock.order.findUnique.mockResolvedValue(processingOrder);

      const count = await service.cancelExpiredOrders();

      expect(count).toBe(0);
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });
  });
});
