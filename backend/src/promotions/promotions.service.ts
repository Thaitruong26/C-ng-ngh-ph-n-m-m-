import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ValidatePromotionDto } from './dto/validate-promotion.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../common/pricing/pricing.service.js';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly pricingService?: PricingService,
  ) {}

  async validate(dto: ValidatePromotionDto) {
    const code = dto.code ? dto.code.trim().toUpperCase() : '';

    // 1. Tìm mã khuyến mãi trong bảng PromoCode
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promo) {
      throw new NotFoundException({
        code: 'PROMO_NOT_FOUND',
        message: 'Mã khuyến mãi không tồn tại hoặc đã bị xóa!',
      });
    }

    // 2. Kiểm tra trạng thái kích hoạt (isActive)
    if (!promo.isActive) {
      throw new BadRequestException({
        code: 'PROMO_INACTIVE',
        message: 'Mã khuyến mãi này hiện đang bị tạm khóa!',
      });
    }

    // 3. Kiểm tra thời gian sử dụng (startsAt & expiresAt)
    const now = new Date();
    if (now < promo.startsAt) {
      throw new BadRequestException({
        code: 'PROMO_NOT_STARTED',
        message: `Mã khuyến mãi chưa đến thời gian áp dụng (bắt đầu từ ${promo.startsAt.toLocaleDateString('vi-VN')})!`,
        details: { startsAt: promo.startsAt.toISOString() },
      });
    }
    if (now > promo.expiresAt) {
      throw new BadRequestException({
        code: 'PROMO_EXPIRED',
        message: `Mã khuyến mãi đã hết hạn sử dụng (hết hạn ngày ${promo.expiresAt.toLocaleDateString('vi-VN')})!`,
        details: { expiresAt: promo.expiresAt.toISOString() },
      });
    }

    // Tính toán orderValue nếu client truyền items thay vì orderValue
    let orderValue = dto.orderValue;
    if (orderValue === undefined && dto.items && dto.items.length > 0) {
      if (this.pricingService) {
        try {
          const pricing = await this.pricingService.calculate(dto.items as any, this.prisma);
          orderValue = pricing.subtotal;
        } catch {
          orderValue = undefined;
        }
      }
      if (orderValue === undefined) {
        let calculated = 0;
        for (const item of dto.items) {
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
          });
          const base = product?.price ?? 0;
          const surcharge = item.size === 'M' ? 5000 : item.size === 'L' ? 10000 : 0;
          let toppingSum = 0;
          if (item.toppingIds && item.toppingIds.length > 0) {
            const toppings = await this.prisma.topping.findMany({
              where: { id: { in: item.toppingIds } },
            });
            toppingSum = toppings.reduce((s, t) => s + t.price, 0);
          }
          calculated += (base + surcharge + toppingSum) * item.quantity;
        }
        orderValue = calculated;
      }
    }

    if (orderValue === undefined) {
      orderValue = 0;
    }

    // 4. Kiểm tra giá trị đơn tối thiểu (minOrderValue)
    if (orderValue < promo.minOrderValue) {
      throw new BadRequestException({
        code: 'PROMO_MIN_ORDER_NOT_MET',
        message: `Đơn hàng chưa đạt giá trị tối thiểu ${promo.minOrderValue.toLocaleString('vi-VN')}đ để dùng mã này (cần thêm ${(promo.minOrderValue - orderValue).toLocaleString('vi-VN')}đ)!`,
        details: {
          minOrderValue: promo.minOrderValue,
          currentOrderValue: orderValue,
        },
      });
    }

    // 5. Kiểm tra lượt dùng (usageLimit & usedCount)
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException({
        code: 'PROMO_USAGE_EXCEEDED',
        message: 'Mã khuyến mãi này đã hết lượt sử dụng!',
      });
    }

    // 6. Tính toán số tiền được giảm dựa vào type (PERCENT hoặc FIXED)
    let discountAmount = 0;

    if (promo.type === 'PERCENT') {
      discountAmount = Math.floor((orderValue * promo.value) / 100);
      if (promo.maxDiscount !== null && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.type === 'FIXED') {
      discountAmount = promo.value;
    }

    if (discountAmount > orderValue) {
      discountAmount = orderValue;
    }

    const totalAfterDiscount = orderValue - discountAmount;

    return {
      code: promo.code,
      type: promo.type,
      value: promo.value,
      subtotal: orderValue,
      discountAmount,
      totalAfterDiscount,
      success: true,
      message: 'Áp dụng mã khuyến mãi thành công!',
      finalPrice: totalAfterDiscount,
    };
  }
}
