import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecipeService } from '../common/recipe/recipe.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let recipeService: RecipeService;
  let prismaMock: {
    product: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    topping: {
      findMany: ReturnType<typeof vi.fn>;
    };
    ingredient: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleProducts = [
    {
      id: 1,
      name: 'Cà phê sữa',
      description: 'Cà phê phin pha sữa đặc',
      price: 35000,
      imageUrl: '/img/ca-phe-sua.jpg',
      category: 'Cà phê',
      stock: 40,
      version: 0,
      isActive: true,
      createdAt: new Date(),
      productRecipes: [{ ingredientId: 1, quantity: 20 }],
    },
    {
      id: 2,
      name: 'Americano',
      description: 'Espresso pha loãng',
      price: 40000,
      imageUrl: '/img/americano.jpg',
      category: 'Cà phê',
      stock: 0,
      version: 0,
      isActive: true,
      createdAt: new Date(),
      productRecipes: [], // Không có công thức -> stock = 0, inStock = false
    },
  ];

  const sampleToppings = [
    {
      id: 1,
      name: 'Trân châu',
      price: 5000,
      toppingRecipes: [{ ingredientId: 2, quantity: 40 }],
    },
    {
      id: 2,
      name: 'Kem cheese',
      price: 7000,
      toppingRecipes: [{ ingredientId: 3, quantity: 30 }],
    },
  ];

  const sampleIngredients = [
    { id: 1, name: 'Cà phê', stock: 1000 },
    { id: 2, name: 'Trân châu', stock: 500 },
    { id: 3, name: 'Kem cheese', stock: 500 },
  ];

  beforeEach(() => {
    recipeService = new RecipeService();
    prismaMock = {
      product: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      topping: {
        findMany: vi.fn(),
      },
      ingredient: {
        findMany: vi.fn().mockResolvedValue(sampleIngredients),
      },
    };

    service = new ProductsService(prismaMock as unknown as PrismaService, recipeService);
  });

  describe('findAll', () => {
    it('trả về danh sách sản phẩm phân trang với inStock và meta đầy đủ tính từ nguyên liệu', async () => {
      prismaMock.product.count.mockResolvedValue(2);
      prismaMock.product.findMany.mockResolvedValue(sampleProducts);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(1);
      expect(result.data[0].name).toBe('Cà phê sữa');
      expect(result.data[0].inStock).toBe(true);
      expect(result.data[0].stock).toBeGreaterThan(0);
      expect(result.data[1].inStock).toBe(false); // Không có công thức -> stock = 0, inStock = false
      expect(result.data[1].stock).toBe(0);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('tìm kiếm theo tên (search) và lọc theo danh mục (category)', async () => {
      prismaMock.product.count.mockResolvedValue(1);
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0]]);

      const result = await service.findAll({
        search: 'sữa',
        category: 'Cà phê',
        page: 1,
        limit: 10,
      });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          name: { contains: 'sữa', mode: 'insensitive' },
          category: { equals: 'Cà phê', mode: 'insensitive' },
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
        include: {
          productRecipes: true,
        },
      });
      expect(result.data).toHaveLength(1);
    });

    it('trả về danh sách rỗng 200 khi không có sản phẩm', async () => {
      prismaMock.product.count.mockResolvedValue(0);
      prismaMock.product.findMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('findOne', () => {
    it('trả về chi tiết sản phẩm kèm sizes, toppings có available, maxCups và limitedBy', async () => {
      prismaMock.product.findFirst.mockResolvedValue(sampleProducts[0]);
      prismaMock.topping.findMany.mockResolvedValue(sampleToppings);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Cà phê sữa');
      expect(result.sizes).toEqual([
        { size: 'S', code: 'S', surcharge: 0, maxCups: expect.any(Number) },
        { size: 'M', code: 'M', surcharge: 5000, maxCups: expect.any(Number) },
        { size: 'L', code: 'L', surcharge: 10000, maxCups: expect.any(Number) },
      ]);
      expect(result.toppings).toEqual([
        { id: 1, name: 'Trân châu', price: 5000, available: true },
        { id: 2, name: 'Kem cheese', price: 7000, available: true },
      ]);
      expect(result.inStock).toBe(true);
    });

    it('ném lỗi NotFoundException PRODUCT_NOT_FOUND khi sản phẩm không tồn tại hoặc isActive false', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      try {
        await service.findOne(999);
      } catch (err: unknown) {
        expect((err as NotFoundException).getResponse()).toEqual({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Không tìm thấy sản phẩm #999',
          details: [{ productId: 999 }],
        });
      }
    });
  });
});
