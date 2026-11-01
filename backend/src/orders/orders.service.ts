import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../common/pricing/pricing.service.js';
import { RecipeService } from '../common/recipe/recipe.service.js';
import { assertTransition } from './order-state.js';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';

export const ORDER_PAYMENT_TIMEOUT_MINUTES = 15;
export const ORDER_PAYMENT_TIMEOUT_MS = ORDER_PAYMENT_TIMEOUT_MINUTES * 60 * 1000;

export interface UserContext {
  id: number;
  role?: string;
}

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly recipeService: RecipeService,
  ) {}

  onModuleInit() {
    // Quét và tự động dọn dẹp các đơn PENDING/PAYMENT_FAILED quá 15 phút định kỳ mỗi 60s
    this.cleanupInterval = setInterval(() => {
      this.cancelExpiredOrders().catch((err) => {
        console.error('Lỗi khi chạy định kỳ cancelExpiredOrders:', err);
      });
    }, 60 * 1000);

    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Task 6 & Task 10: POST /orders
   * Tạo đơn hàng ở trạng thái PENDING từ giỏ hàng.
   * Tính lại giá bằng PricingService (không tin giá client).
   * Kiểm soát tồn kho theo nguyên liệu bằng transaction và optimistic locking (Ingredient.version).
   */
  async createOrder(userId: number, dto: CreateOrderDto) {
    const MAX_RETRIES = 10;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 1. Giữ tồn kho nguyên liệu theo công thức bằng optimistic locking (Ingredient.version)
          const reservation = await this.reserveStock(tx, dto.items);

          // 2. Tính lại giá trên server (nguồn chân lý duy nhất)
          const pricing = await this.pricingService.calculate(dto.items, tx);
          const subtotal = pricing.subtotal;
          let discountAmount = 0;

          // 4. Áp dụng mã giảm giá (nếu có)
          if (dto.promoCode) {
            const promo = await tx.promoCode.findUnique({
              where: { code: dto.promoCode },
            });
            const now = new Date();

            if (!promo || !promo.isActive) {
              throw new UnprocessableEntityException({
                code: 'PROMO_NOT_FOUND',
                message: 'Mã khuyến mãi không tồn tại hoặc đã bị khóa',
              });
            }
            if (now < promo.startsAt) {
              throw new UnprocessableEntityException({
                code: 'PROMO_NOT_STARTED',
                message: 'Mã khuyến mãi chưa đến thời gian áp dụng',
              });
            }
            if (now > promo.expiresAt) {
              throw new UnprocessableEntityException({
                code: 'PROMO_EXPIRED',
                message: 'Mã khuyến mãi đã hết hạn sử dụng',
              });
            }
            if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
              throw new UnprocessableEntityException({
                code: 'PROMO_USAGE_EXCEEDED',
                message: 'Mã khuyến mãi đã hết lượt sử dụng',
              });
            }
            if (subtotal < promo.minOrderValue) {
              throw new UnprocessableEntityException({
                code: 'PROMO_MIN_ORDER_NOT_MET',
                message: `Đơn hàng chưa đạt giá trị tối thiểu ${promo.minOrderValue.toLocaleString('vi-VN')}đ`,
              });
            }

            // Tính số tiền giảm
            if (promo.type === 'PERCENT') {
              discountAmount = Math.floor((subtotal * promo.value) / 100);
              if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
                discountAmount = promo.maxDiscount;
              }
            } else {
              discountAmount = promo.value;
            }
            if (discountAmount > subtotal) discountAmount = subtotal;

            // Tăng usedCount nguyên tử trong cùng transaction
            const promoUpdate = await tx.promoCode.updateMany({
              where: {
                code: promo.code,
                isActive: true,
                ...(promo.usageLimit !== null ? { usedCount: { lt: promo.usageLimit } } : {}),
              },
              data: {
                usedCount: { increment: 1 },
              },
            });

            if (promoUpdate.count === 0) {
              throw new UnprocessableEntityException({
                code: 'PROMO_USAGE_EXCEEDED',
                message: 'Mã khuyến mãi đã hết lượt sử dụng',
              });
            }
          }

          const total = subtotal - discountAmount;

          // 5. Lưu Order và OrderItem (chụp snapshot tên, topping, giá)
          const newOrder = await tx.order.create({
            data: {
              userId,
              status: OrderStatus.PENDING,
              subtotal,
              discountAmount,
              total,
              promoCode: dto.promoCode || null,
              pointsEarned: 0,
              items: {
                create: pricing.lines.map((line, idx) => ({
                  productId: line.productId,
                  productName: line.productName,
                  size: line.size,
                  toppings: line.toppings,
                  consumption: reservation.lineConsumptions[idx] ?? [],
                  unitPrice: line.unitPrice,
                  qty: line.qty,
                  lineTotal: line.lineTotal,
                  note: line.note,
                })),
              },
            },
            include: {
              items: true,
            },
          });

          // 6. Ghi nhật ký biến động kho (StockMovement) cho từng nguyên liệu đã giữ
          for (const [ingredientId, qty] of reservation.orderNeedsMap.entries()) {
            await tx.stockMovement.create({
              data: {
                ingredientId,
                type: 'ORDER_RESERVE',
                quantity: -qty,
                orderId: newOrder.id,
              },
            });
          }

          return {
            id: newOrder.id,
            code: `#${newOrder.id}`,
            status: newOrder.status,
            items: newOrder.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              size: item.size,
              toppings: item.toppings,
              unitPrice: item.unitPrice,
              qty: item.qty,
              lineTotal: item.lineTotal,
            })),
            subtotal: newOrder.subtotal,
            discountAmount: newOrder.discountAmount,
            total: newOrder.total,
            promoCode: newOrder.promoCode,
            createdAt: newOrder.createdAt.toISOString(),
            expiresAt: new Date(newOrder.createdAt.getTime() + ORDER_PAYMENT_TIMEOUT_MS).toISOString(),
          };
        });
      } catch (err: any) {
        if (err?.message === 'STOCK_RETRY') {
          if (attempt === MAX_RETRIES) {
            throw new ConflictException({
              code: 'STOCK_CONFLICT',
              message: 'Hệ thống đang bận do nhiều người đặt cùng lúc, vui lòng thử lại',
            });
          }
          // Nghỉ ngẫu nhiên 10 đến 50 ms rồi thử lại cả transaction
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 41) + 10),
          );
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException({
      code: 'STOCK_CONFLICT',
      message: 'Hệ thống đang bận do nhiều người đặt cùng lúc, vui lòng thử lại',
    });
  }

  /**
   * Task 9: GET /orders/me
   * Lịch sử đơn hàng của người dùng hiện tại (chỉ lấy đơn của req.user.id), sắp xếp mới nhất trước.
   */
  async getOrdersMe(userId: number, query: GetOrdersQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.status) {
      where.status = query.status;
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: {
            select: { id: true, method: true, status: true, amount: true, createdAt: true },
          },
        },
      }),
    ]);

    const data = orders.map((order) => {
      const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
      return {
        id: order.id,
        code: `#${order.id}`,
        status: order.status,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        promoCode: order.promoCode,
        pointsEarned: order.pointsEarned,
        itemCount,
        items: order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          size: i.size,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          toppings: (i.toppings as any) || [],
          note: i.note,
        })),
        payments: order.payments,
        createdAt: order.createdAt.toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Task 9: GET /orders/:id
   * Chi tiết đơn hàng (kèm items, payments, pointsEarned).
   * Khách chỉ xem được đơn của mình, Barista được xem mọi đơn.
   */
  async getOrderById(id: number, user: UserContext) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: {
          select: {
            id: true,
            orderId: true,
            amount: true,
            method: true,
            status: true,
            providerRef: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Không tìm thấy đơn hàng #${id}`,
      });
    }

    if (order.userId !== user.id && user.role !== Role.BARISTA) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xem đơn hàng này',
      });
    }

    return {
      id: order.id,
      code: `#${order.id}`,
      status: order.status,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        size: item.size,
        toppings: item.toppings,
        unitPrice: item.unitPrice,
        qty: item.qty,
        lineTotal: item.lineTotal,
        note: item.note,
      })),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
      promoCode: order.promoCode,
      pointsEarned: order.pointsEarned,
      payments: order.payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        method: p.method,
        status: p.status,
        providerRef: p.providerRef,
        createdAt: p.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      expiresAt:
        order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_FAILED
          ? new Date(order.createdAt.getTime() + ORDER_PAYMENT_TIMEOUT_MS).toISOString()
          : null,
    };
  }

  /**
   * Task 10: POST /orders/:id/cancel
   * Hủy đơn hàng: hoàn kho, hoàn lượt dùng mã giảm giá, hoàn tiền/thu hồi điểm nếu đơn đã PAID.
   */
  async cancelOrder(id: number, user: UserContext) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.userId !== user.id && user.role !== Role.BARISTA) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền hủy đơn hàng này',
        });
      }

      // Kiểm tra xem có giao dịch đang thanh toán dở dang không
      const hasProcessingPayment = order.payments.some((p) => p.status === 'PROCESSING');
      if (hasProcessingPayment) {
        throw new ConflictException({
          code: 'PAYMENT_IN_PROGRESS',
          message: 'Đơn hàng đang có giao dịch thanh toán đang xử lý, không thể hủy lúc này',
        });
      }

      // Kiểm tra chuyển trạng thái qua State Machine
      assertTransition(order.status, OrderStatus.CANCELLED);

      // 1. Hoàn kho nguyên liệu theo snapshot consumption
      await this.releaseStock(tx, order);

      // 2. Hoàn lại số lượt sử dụng mã giảm giá (usedCount)
      if (order.promoCode) {
        await tx.promoCode.update({
          where: { code: order.promoCode },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }

      // 3. Nếu đơn đã PAID: thu hồi điểm thưởng và ghi nhận hoàn tiền mock
      if (order.status === OrderStatus.PAID) {
        if (order.pointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { decrement: order.pointsEarned },
            },
          });

          await tx.loyaltyTransaction.updateMany({
            where: { orderId: order.id },
            data: {
              reversedAt: new Date(),
            },
          });
        }

        // Cập nhật Payment ghi nhận hoàn tiền mock
        const successfulPayment = order.payments.find((p) => p.status === 'SUCCESS');
        if (successfulPayment) {
          await tx.payment.update({
            where: { id: successfulPayment.id },
            data: {
              refundedAt: new Date(),
              refundedAmount: order.total,
              refundRef: `MOCK-REFUND-${Date.now()}`,
            },
          });
        }
      }

      // 4. Đổi trạng thái sang CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      return {
        id: updatedOrder.id,
        code: `#${updatedOrder.id}`,
        status: updatedOrder.status,
        message: 'Đơn hàng đã được hủy thành công',
      };
    });
  }

  /**
   * Tự động hủy một đơn hàng hết hạn thanh toán (hệ thống thực thi, không kiểm tra quyền user).
   */
  async cancelOrderInternal(id: number) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!order) return null;
      if (order.status === OrderStatus.CANCELLED) return order;

      // Không hủy nếu có payment đang PROCESSING
      const hasProcessingPayment = order.payments.some((p) => p.status === 'PROCESSING');
      if (hasProcessingPayment) {
        return null;
      }

      // Chỉ hủy khi ở trạng thái PENDING hoặc PAYMENT_FAILED
      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
        return null;
      }

      // 1. Hoàn kho nguyên liệu theo snapshot consumption
      await this.releaseStock(tx, order);

      // 2. Hoàn lại số lượt sử dụng mã giảm giá (usedCount)
      if (order.promoCode) {
        await tx.promoCode.update({
          where: { code: order.promoCode },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }

      // 3. Đổi trạng thái sang CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Quét và tự động hủy các đơn hàng PENDING hoặc PAYMENT_FAILED đã quá 15 phút.
   */
  async cancelExpiredOrders(): Promise<number> {
    const expiredBefore = new Date(Date.now() - ORDER_PAYMENT_TIMEOUT_MS);
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
        createdAt: { lt: expiredBefore },
      },
      select: { id: true },
    });

    let count = 0;
    for (const item of expiredOrders) {
      try {
        const res = await this.cancelOrderInternal(item.id);
        if (res) count++;
      } catch {
        // Tiếp tục quét các đơn khác nếu có đơn bị lỗi
      }
    }
    return count;
  }

  /**
   * Task 10 & Barista: PATCH /orders/:id/status
   * Barista chuyển bước đơn hàng: PAID → PREPARING → READY → COMPLETED
   */
  async updateOrderStatus(id: number, nextStatus: OrderStatus, user: UserContext) {
    if (user.role !== Role.BARISTA) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista mới có quyền đổi trạng thái đơn hàng',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      // Kiểm tra chuyển tiếp hợp lệ qua State Machine
      assertTransition(order.status, nextStatus);

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
        },
      });

      return {
        id: updated.id,
        code: `#${updated.id}`,
        status: updated.status,
      };
    });
  }

  /**
   * Barista Queue: GET /orders (Mở rộng Barista - Mục 6.15)
   * Hàng đợi phục vụ cho nhân viên Barista: lọc status (mặc định PAID, PREPARING, READY),
   * sắp xếp createdAt tăng dần (cũ nhất lên đầu).
   */
  async getBaristaOrders(query: { status?: string; page?: number; limit?: number }, user: UserContext) {
    if (user.role !== Role.BARISTA) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista mới có quyền xem hàng đợi đơn hàng',
      });
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    let statuses: OrderStatus[] = [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED];
    if (query.status?.trim()) {
      statuses = query.status.split(',').map((s) => s.trim()) as OrderStatus[];
    }

    const where = {
      status: { in: statuses },
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' }, // Cũ nhất lên đầu theo thứ tự đến quầy
        include: {
          user: {
            select: { fullName: true },
          },
          items: true,
        },
      }),
    ]);

    const data = orders.map((order) => ({
      id: order.id,
      code: `#${order.id}`,
      status: order.status,
      total: order.total,
      customerName: order.user?.fullName || 'Khách hàng',
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        productName: item.productName,
        size: item.size,
        qty: item.qty,
        toppings: item.toppings,
        note: item.note,
      })),
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Giữ tồn kho nguyên liệu theo công thức bằng optimistic locking (Ingredient.version).
   * Sắp xếp ingredientId tăng dần để phòng tránh deadlock.
   */
  private async reserveStock(tx: any, items: CreateOrderItemDto[]) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const toppingIds = [...new Set(items.flatMap((i) => i.toppingIds ?? []))];

    const [products, toppings] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds } },
        include: { productRecipes: true },
      }),
      toppingIds.length > 0
        ? tx.topping.findMany({
            where: { id: { in: toppingIds } },
            include: { toppingRecipes: true },
          })
        : Promise.resolve([]),
    ]);

    const productMap = new Map<number, any>(products.map((p: any) => [p.id, p]));
    const toppingMap = new Map<number, any>(toppings.map((t: any) => [t.id, t]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: `Không tìm thấy sản phẩm #${item.productId}`,
          details: [{ productId: item.productId }],
        });
      }
      if (!product.productRecipes || product.productRecipes.length === 0) {
        throw new ConflictException({
          code: 'RECIPE_MISSING',
          message: `Sản phẩm '${product.name}' chưa có công thức`,
          details: [{ productId: product.id }],
        });
      }
    }

    const lineConsumptions: { ingredientId: number; quantity: number }[][] = [];
    const ingredientAffectedProducts = new Map<number, Set<string>>();
    const orderNeedsMap = new Map<number, number>();

    for (const item of items) {
      const product = productMap.get(item.productId)!;
      const itemToppings = (item.toppingIds ?? [])
        .map((id) => toppingMap.get(id))
        .filter(Boolean);

      const lineMap = this.recipeService.calculateLine(
        {
          id: product.id,
          name: product.name,
          recipes: product.productRecipes,
        },
        item.size,
        itemToppings.map((t: any) => ({
          id: t.id,
          name: t.name,
          recipes: t.toppingRecipes,
        })),
        item.quantity,
      );

      const consumption: { ingredientId: number; quantity: number }[] = [];
      for (const [ingredientId, amount] of lineMap.entries()) {
        consumption.push({ ingredientId, quantity: amount });
        orderNeedsMap.set(ingredientId, (orderNeedsMap.get(ingredientId) || 0) + amount);

        let productSet = ingredientAffectedProducts.get(ingredientId);
        if (!productSet) {
          productSet = new Set<string>();
          ingredientAffectedProducts.set(ingredientId, productSet);
        }
        productSet.add(product.name);
      }
      lineConsumptions.push(consumption);
    }

    const sortedIngredientIds = [...orderNeedsMap.keys()].sort((a, b) => a - b);

    for (const ingredientId of sortedIngredientIds) {
      const neededQty = orderNeedsMap.get(ingredientId)!;
      const current = await tx.ingredient.findUnique({
        where: { id: ingredientId },
        select: { id: true, name: true, stock: true, version: true },
      });

      if (!current) {
        throw new NotFoundException({
          code: 'INGREDIENT_NOT_FOUND',
          message: `Không tìm thấy nguyên liệu #${ingredientId}`,
        });
      }

      const affectedProducts = Array.from(ingredientAffectedProducts.get(ingredientId) || []);

      if (current.stock < neededQty) {
        throw new ConflictException({
          code: 'OUT_OF_STOCK',
          message: `Không đủ ${current.name} để pha chế`,
          details: [
            {
              ingredientId: current.id,
              ingredient: current.name,
              available: current.stock,
              required: neededQty,
              products: affectedProducts,
            },
          ],
        });
      }

      const res = await tx.ingredient.updateMany({
        where: {
          id: ingredientId,
          version: current.version,
          stock: { gte: neededQty },
        },
        data: {
          stock: { decrement: neededQty },
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        const latest = await tx.ingredient.findUnique({ where: { id: ingredientId } });
        if (!latest || latest.stock < neededQty) {
          throw new ConflictException({
            code: 'OUT_OF_STOCK',
            message: `Không đủ ${current.name} để pha chế`,
            details: [
              {
                ingredientId: current.id,
                ingredient: current.name,
                available: latest?.stock ?? 0,
                required: neededQty,
                products: affectedProducts,
              },
            ],
          });
        }
        throw new Error('STOCK_RETRY');
      }
    }

    return { lineConsumptions, orderNeedsMap };
  }

  /**
   * Hoàn kho nguyên liệu đúng theo snapshot OrderItem.consumption (không tính lại từ công thức hiện tại).
   */
  private async releaseStock(tx: any, order: { id: number; items: any[] }) {
    const releaseMap = new Map<number, number>();
    for (const item of order.items) {
      const consumption = (item.consumption as { ingredientId: number; quantity: number }[]) || [];
      for (const c of consumption) {
        releaseMap.set(c.ingredientId, (releaseMap.get(c.ingredientId) || 0) + c.quantity);
      }
    }

    const sortedIngredientIds = [...releaseMap.keys()].sort((a, b) => a - b);
    for (const ingredientId of sortedIngredientIds) {
      const qty = releaseMap.get(ingredientId)!;
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: { increment: qty },
          version: { increment: 1 },
        },
      });

      await tx.stockMovement.create({
        data: {
          ingredientId,
          type: 'ORDER_RELEASE',
          quantity: qty,
          orderId: order.id,
        },
      });
    }
  }
}