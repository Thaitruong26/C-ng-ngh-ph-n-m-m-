import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service.js';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      ingredient: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
      productRecipe: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      topping: {
        findUnique: vi.fn(),
      },
      toppingRecipe: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    service = new IngredientsService(prismaMock);
  });

  describe('findAll', () => {
    it('lấy danh sách nguyên liệu và tự tính trường low = stock <= lowThreshold', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([
        { id: 1, name: 'Cà phê', unit: 'G', stock: 1000, lowThreshold: 500 },
        { id: 2, name: 'Sữa tươi', unit: 'ML', stock: 1800, lowThreshold: 2000 },
      ]);

      const res = await service.findAll({});
      expect(res.data).toHaveLength(2);
      expect(res.data[0].low).toBe(false);
      expect(res.data[1].low).toBe(true);
      expect(res.meta.total).toBe(2);
    });

    it('lọc chỉ lấy nguyên liệu sắp hết khi low = true', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([
        { id: 1, name: 'Cà phê', unit: 'G', stock: 1000, lowThreshold: 500 },
        { id: 2, name: 'Sữa tươi', unit: 'ML', stock: 1800, lowThreshold: 2000 },
      ]);

      const res = await service.findAll({ low: true });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Sữa tươi');
      expect(res.meta.total).toBe(1);
    });
  });

  describe('create', () => {
    it('tạo nguyên liệu mới và ghi StockMovement RESTOCK ban đầu nếu stock > 0', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);
      prismaMock.ingredient.create.mockResolvedValue({
        id: 1,
        name: 'Đường',
        unit: 'G',
        stock: 5000,
        lowThreshold: 500,
        version: 0,
      });

      const res = await service.create(
        { name: 'Đường', unit: 'G' as any, stock: 5000, lowThreshold: 500 },
        1,
      );

      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ingredientId: 1,
          type: 'RESTOCK',
          quantity: 5000,
          userId: 1,
        }),
      });
      expect(res.id).toBe(1);
      expect(res.stock).toBe(5000);
    });

    it('ném lỗi 409 INGREDIENT_ALREADY_EXISTS nếu trùng tên nguyên liệu', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue({ id: 1, name: 'Đường' });

      await expect(
        service.create({ name: 'Đường', unit: 'G' as any }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('addStock', () => {
    it('nhập thêm tồn kho, tăng version và ghi StockMovement RESTOCK', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 2,
        name: 'Sữa tươi',
        unit: 'ML',
        stock: 1800,
        lowThreshold: 2000,
      });
      prismaMock.ingredient.update.mockResolvedValue({
        id: 2,
        name: 'Sữa tươi',
        unit: 'ML',
        stock: 6800,
        lowThreshold: 2000,
      });

      const res = await service.addStock(2, { quantity: 5000, note: 'Nhập hàng sáng' }, 1);

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: {
          stock: { increment: 5000 },
          version: { increment: 1 },
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 2,
          type: 'RESTOCK',
          quantity: 5000,
          userId: 1,
          reason: 'Nhập hàng sáng',
        },
      });
      expect(res.stock).toBe(6800);
      expect(res.low).toBe(false);
    });
  });

  describe('adjustStock', () => {
    it('ghi nhận hao hụt hoặc chênh lệch kiểm kê (diff < 0), ghi StockMovement ADJUST', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 2,
        stock: 1800,
      });
      prismaMock.ingredient.update.mockResolvedValue({
        id: 2,
        stock: 1750,
      });

      const res = await service.adjustStock(
        2,
        { actualStock: 1750, reason: 'Đổ vỡ 50ml khi pha' },
        1,
      );

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: {
          stock: 1750,
          version: { increment: 1 },
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 2,
          type: 'ADJUST',
          quantity: -50,
          userId: 1,
          reason: 'Đổ vỡ 50ml khi pha',
        },
      });
      expect(res.diff).toBe(-50);
      expect(res.stock).toBe(1750);
    });

    it('nếu diff = 0 thì không ghi nhật ký StockMovement', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 2,
        stock: 1800,
      });

      const res = await service.adjustStock(
        2,
        { actualStock: 1800, reason: 'Kiểm kê khớp' },
        1,
      );

      expect(prismaMock.ingredient.update).not.toHaveBeenCalled();
      expect(prismaMock.stockMovement.create).not.toHaveBeenCalled();
      expect(res.diff).toBe(0);
    });
  });

  describe('productRecipe', () => {
    it('cập nhật công thức sản phẩm thành công', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 3, name: 'Cà phê muối' });
      prismaMock.ingredient.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prismaMock.productRecipe.findMany.mockResolvedValue([
        { ingredientId: 1, quantity: 18, ingredient: { name: 'Cà phê', unit: 'G' } },
        { ingredientId: 2, quantity: 120, ingredient: { name: 'Sữa tươi', unit: 'ML' } },
      ]);

      const res = await service.updateProductRecipe(3, {
        items: [
          { ingredientId: 1, quantity: 18 },
          { ingredientId: 2, quantity: 120 },
        ],
      });

      expect(prismaMock.productRecipe.deleteMany).toHaveBeenCalledWith({ where: { productId: 3 } });
      expect(prismaMock.productRecipe.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 3, ingredientId: 1, quantity: 18 },
          { productId: 3, ingredientId: 2, quantity: 120 },
        ],
      });
      expect(res.items).toHaveLength(2);
    });

    it('từ chối nếu trùng lặp nguyên liệu trong cùng công thức', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 3 });

      await expect(
        service.updateProductRecipe(3, {
          items: [
            { ingredientId: 1, quantity: 18 },
            { ingredientId: 1, quantity: 20 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
