import { ConflictException, Injectable } from '@nestjs/common';
import { SIZE_FACTOR, type SizeKey } from './recipe.constants.js';

export interface RecipeItemPart {
  ingredientId: number;
  quantity: number;
}

export interface ProductWithRecipes {
  id: number;
  name?: string;
  recipes?: RecipeItemPart[];
  productRecipes?: RecipeItemPart[];
}

export interface ToppingWithRecipes {
  id: number;
  name?: string;
  recipes?: RecipeItemPart[];
  toppingRecipes?: RecipeItemPart[];
}

export interface OrderLineInput {
  product: ProductWithRecipes;
  size: SizeKey;
  toppings?: ToppingWithRecipes[];
  qty: number;
}

@Injectable()
export class RecipeService {
  /**
   * Tính nhu cầu nguyên liệu cho 1 dòng sản phẩm (đã nhân qty).
   * Quy tắc:
   * 1. Nhu cầu món 1 ly = ceil(ProductRecipe.quantity * SizeFactor[size])
   * 2. Nhu cầu topping 1 ly = sum(ToppingRecipe.quantity)
   * 3. Nhu cầu 1 ly = nhu cầu món + nhu cầu topping
   * 4. Nhu cầu dòng = nhu cầu 1 ly * qty
   * Làm tròn LÊN ở bước nhân size, TRƯỚC khi nhân qty.
   */
  calculateLine(
    product: ProductWithRecipes,
    size: SizeKey,
    toppings: ToppingWithRecipes[] = [],
    qty: number = 1,
  ): Map<number, number> {
    const productRecipes = product.recipes ?? product.productRecipes ?? [];
    if (productRecipes.length === 0) {
      throw new ConflictException({
        code: 'RECIPE_MISSING',
        message: `Sản phẩm '${product.name || product.id}' chưa có công thức`,
        details: [{ productId: product.id }],
      });
    }

    const factor = SIZE_FACTOR[size] ?? 1.0;
    const singleCupMap = new Map<number, number>();

    // 1. Nguyên liệu của món chính
    for (const item of productRecipes) {
      const cupNeed = Math.ceil(item.quantity * factor);
      singleCupMap.set(item.ingredientId, (singleCupMap.get(item.ingredientId) || 0) + cupNeed);
    }

    // 2. Nguyên liệu của topping
    for (const topping of toppings) {
      const toppingRecipes = topping.recipes ?? topping.toppingRecipes ?? [];
      for (const item of toppingRecipes) {
        singleCupMap.set(item.ingredientId, (singleCupMap.get(item.ingredientId) || 0) + item.quantity);
      }
    }

    // 3. Nhân với số ly (qty)
    const lineMap = new Map<number, number>();
    for (const [ingredientId, cupNeed] of singleCupMap.entries()) {
      lineMap.set(ingredientId, cupNeed * qty);
    }

    return lineMap;
  }

  /**
   * Tính và gộp nhu cầu nguyên liệu cho toàn bộ đơn hàng.
   * Gộp tất cả các dòng theo ingredientId.
   */
  calculateOrder(items: OrderLineInput[]): Map<number, number> {
    const totalOrderMap = new Map<number, number>();

    for (const item of items) {
      const lineMap = this.calculateLine(
        item.product,
        item.size,
        item.toppings ?? [],
        item.qty,
      );

      for (const [ingredientId, amount] of lineMap.entries()) {
        const current = totalOrderMap.get(ingredientId) || 0;
        totalOrderMap.set(ingredientId, current + amount);
      }
    }

    return totalOrderMap;
  }

  /**
   * Tính số ly tối đa của 1 sản phẩm ở 1 size dựa trên tồn kho hiện tại.
   * soLyToiDa(sp, size) = min over ing ( floor( Ingredient.stock / nhuCauMotLy(ing) ) )
   * Nếu sản phẩm không có công thức: trả về 0.
   */
  maxCups(
    product: ProductWithRecipes,
    size: SizeKey,
    stockMap: Map<number, number>,
  ): number {
    const productRecipes = product.recipes ?? product.productRecipes ?? [];
    if (productRecipes.length === 0) {
      return 0;
    }

    const factor = SIZE_FACTOR[size] ?? 1.0;
    let minCups = Number.MAX_SAFE_INTEGER;

    for (const item of productRecipes) {
      const cupNeed = Math.ceil(item.quantity * factor);
      if (cupNeed <= 0) continue;
      const currentStock = stockMap.get(item.ingredientId) ?? 0;
      const cups = Math.floor(currentStock / cupNeed);
      if (cups < minCups) {
        minCups = cups;
      }
    }

    return minCups === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, minCups);
  }

  /**
   * Tìm số ly tối đa và tên nguyên liệu thắt nút cổ chai (limitedBy).
   */
  getBottleneck(
    product: ProductWithRecipes,
    size: SizeKey,
    stockMap: Map<number, number>,
    ingredientNameMap?: Map<number, string>,
  ): { maxCups: number; limitedBy: string | null } {
    const productRecipes = product.recipes ?? product.productRecipes ?? [];
    if (productRecipes.length === 0) {
      return { maxCups: 0, limitedBy: null };
    }

    const factor = SIZE_FACTOR[size] ?? 1.0;
    let minCups = Number.MAX_SAFE_INTEGER;
    let bottleneckIngId: number | null = null;

    for (const item of productRecipes) {
      const cupNeed = Math.ceil(item.quantity * factor);
      if (cupNeed <= 0) continue;
      const currentStock = stockMap.get(item.ingredientId) ?? 0;
      const cups = Math.floor(currentStock / cupNeed);
      if (cups < minCups) {
        minCups = cups;
        bottleneckIngId = item.ingredientId;
      }
    }

    if (minCups === Number.MAX_SAFE_INTEGER) {
      return { maxCups: 0, limitedBy: null };
    }

    const maxCups = Math.max(0, minCups);
    // Nếu tồn kho còn rất nhiều (ví dụ > 100) thì limitedBy có thể để null hoặc trả về nguyên liệu ít nhất
    const limitedBy = bottleneckIngId && ingredientNameMap ? (ingredientNameMap.get(bottleneckIngId) ?? null) : null;

    return { maxCups, limitedBy };
  }

  /**
   * Kiểm tra topping có sẵn sàng phục vụ cho ít nhất 1 phần không.
   */
  isToppingAvailable(topping: ToppingWithRecipes, stockMap: Map<number, number>): boolean {
    const toppingRecipes = topping.recipes ?? topping.toppingRecipes ?? [];
    if (toppingRecipes.length === 0) return true;

    for (const item of toppingRecipes) {
      const currentStock = stockMap.get(item.ingredientId) ?? 0;
      if (currentStock < item.quantity) {
        return false;
      }
    }
    return true;
  }
}
