import { describe, expect, it } from 'vitest';
import { RecipeService, type ProductWithRecipes, type ToppingWithRecipes } from './recipe.service.js';
import { ConflictException } from '@nestjs/common';

describe('RecipeService', () => {
  const service = new RecipeService();

  describe('calculateLine', () => {
    it('làm tròn LÊN khi nhân hệ số size S (18g x 0.8 -> 15g) trước khi nhân qty', () => {
      const product: ProductWithRecipes = {
        id: 1,
        name: 'Cà phê đen',
        recipes: [{ ingredientId: 10, quantity: 18 }],
      };

      // 1 ly size S: ceil(18 * 0.8) = ceil(14.4) = 15
      const map1 = service.calculateLine(product, 'S', [], 1);
      expect(map1.get(10)).toBe(15);

      // 2 ly size S: 15 * 2 = 30 (nếu nhân 18 * 0.8 * 2 = 28.8 làm tròn sẽ ra 29, sai quy tắc)
      const map2 = service.calculateLine(product, 'S', [], 2);
      expect(map2.get(10)).toBe(30);
    });

    it('tính đúng cho size M (factor 1.0) và size L (factor 1.3)', () => {
      const product: ProductWithRecipes = {
        id: 1,
        recipes: [{ ingredientId: 10, quantity: 18 }],
      };

      // Size M: 18 * 1.0 = 18
      const mapM = service.calculateLine(product, 'M', [], 1);
      expect(mapM.get(10)).toBe(18);

      // Size L: ceil(18 * 1.3) = ceil(23.4) = 24
      const mapL = service.calculateLine(product, 'L', [], 2);
      expect(mapL.get(10)).toBe(48); // 24 * 2
    });

    it('cộng thêm nguyên liệu từ topping vào mỗi ly trước khi nhân qty', () => {
      const product: ProductWithRecipes = {
        id: 1,
        recipes: [
          { ingredientId: 1, quantity: 150 }, // Cốt trà: 150ml
          { ingredientId: 2, quantity: 100 }, // Sữa: 100ml
        ],
      };

      const topping: ToppingWithRecipes = {
        id: 1,
        recipes: [
          { ingredientId: 3, quantity: 40 }, // Trân châu: 40g
          { ingredientId: 2, quantity: 20 }, // Thêm sữa: 20ml
        ],
      };

      // Size M, 2 ly
      const result = service.calculateLine(product, 'M', [topping], 2);
      expect(result.get(1)).toBe(150 * 2); // 300
      expect(result.get(2)).toBe((100 + 20) * 2); // 240
      expect(result.get(3)).toBe(40 * 2); // 80
    });

    it('ném lỗi 409 RECIPE_MISSING nếu sản phẩm không có công thức', () => {
      const product: ProductWithRecipes = {
        id: 99,
        name: 'Món chưa có công thức',
        recipes: [],
      };

      expect(() => service.calculateLine(product, 'M', [], 1)).toThrow(ConflictException);

      try {
        service.calculateLine(product, 'M', [], 1);
      } catch (err: any) {
        expect(err.getResponse().code).toBe('RECIPE_MISSING');
        expect(err.getResponse().details[0].productId).toBe(99);
      }
    });
  });

  describe('calculateOrder', () => {
    it('gộp nhu cầu theo ingredientId trên toàn bộ đơn hàng', () => {
      const productA: ProductWithRecipes = {
        id: 1,
        recipes: [
          { ingredientId: 1, quantity: 150 }, // Trà
          { ingredientId: 2, quantity: 100 }, // Sữa
        ],
      };

      const productB: ProductWithRecipes = {
        id: 2,
        recipes: [
          { ingredientId: 2, quantity: 120 }, // Sữa
          { ingredientId: 4, quantity: 20 }, // Bột kem
        ],
      };

      const toppingA: ToppingWithRecipes = {
        id: 5,
        recipes: [{ ingredientId: 2, quantity: 15 }], // Sữa thêm
      };

      const orderItems = [
        { product: productA, size: 'M' as const, toppings: [toppingA], qty: 2 }, // Sữa = (100 + 15) * 2 = 230
        { product: productB, size: 'M' as const, toppings: [], qty: 1 }, // Sữa = 120 * 1 = 120
      ];

      const result = service.calculateOrder(orderItems);

      expect(result.get(1)).toBe(300); // 150 * 2
      expect(result.get(2)).toBe(230 + 120); // 350
      expect(result.get(4)).toBe(20);
    });
  });

  describe('maxCups và bottleneck', () => {
    it('tính số ly tối đa theo nguyên liệu thắt nút cổ chai (min tồn / cần)', () => {
      const product: ProductWithRecipes = {
        id: 20,
        name: 'Cà phê muối',
        recipes: [
          { ingredientId: 1, quantity: 50 }, // Cà phê: 50ml
          { ingredientId: 2, quantity: 1 }, // Muối: 1g
        ],
      };

      const stockMap = new Map<number, number>([
        [1, 1000], // Cà phê đủ 1000 / 50 = 20 ly
        [2, 5], // Muối chỉ có 5g -> đủ 5 ly
      ]);

      const maxCups = service.maxCups(product, 'M', stockMap);
      expect(maxCups).toBe(5);

      const ingNames = new Map<number, string>([
        [1, 'Cà phê'],
        [2, 'Muối'],
      ]);
      const bottleneck = service.getBottleneck(product, 'M', stockMap, ingNames);
      expect(bottleneck.maxCups).toBe(5);
      expect(bottleneck.limitedBy).toBe('Muối');
    });

    it('trả về maxCups = 0 nếu sản phẩm không có công thức', () => {
      const product: ProductWithRecipes = {
        id: 88,
        recipes: [],
      };
      const stockMap = new Map<number, number>([[1, 1000]]);

      expect(service.maxCups(product, 'M', stockMap)).toBe(0);
      expect(service.getBottleneck(product, 'M', stockMap).maxCups).toBe(0);
    });
  });

  describe('isToppingAvailable', () => {
    it('kiểm tra đủ nguyên liệu cho ít nhất 1 phần topping', () => {
      const topping: ToppingWithRecipes = {
        id: 1,
        recipes: [{ ingredientId: 10, quantity: 40 }],
      };

      expect(service.isToppingAvailable(topping, new Map([[10, 50]]))).toBe(true);
      expect(service.isToppingAvailable(topping, new Map([[10, 40]]))).toBe(true);
      expect(service.isToppingAvailable(topping, new Map([[10, 39]]))).toBe(false);
      expect(service.isToppingAvailable(topping, new Map())).toBe(false);
    });
  });
});
