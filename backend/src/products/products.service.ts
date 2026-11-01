import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SIZE_SURCHARGE,
  type SizeKey,
} from '../common/pricing/pricing.constants.js';
import { RecipeService } from '../common/recipe/recipe.service.js';
import type { GetProductsDto } from './dto/get-products.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeService: RecipeService,
  ) {}

  async findAll(dto: GetProductsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: {
      isActive: boolean;
      name?: { contains: string; mode: 'insensitive' };
      category?: { equals: string; mode?: 'insensitive' };
    } = {
      isActive: true,
    };

    if (dto.search?.trim()) {
      where.name = {
        contains: dto.search.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.category?.trim()) {
      where.category = {
        equals: dto.category.trim(),
        mode: 'insensitive',
      };
    }

    const [total, items, ingredients] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          productRecipes: true,
        },
      }),
      this.prisma.ingredient.findMany({
        select: { id: true, name: true, stock: true },
      }),
    ]);

    const stockMap = new Map<number, number>(ingredients.map((i) => [i.id, i.stock]));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: items.map((p) => {
        const productRef = { id: p.id, recipes: p.productRecipes };
        const stock = this.recipeService.maxCups(productRef, 'S', stockMap);
        const inStock = stock > 0;

        return {
          id: p.id,
          name: p.name,
          price: p.price,
          imageUrl: p.imageUrl,
          category: p.category,
          stock,
          inStock,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: number) {
    const [product, toppings, ingredients] = await Promise.all([
      this.prisma.product.findFirst({
        where: { id, isActive: true },
        include: {
          productRecipes: true,
        },
      }),
      this.prisma.topping.findMany({
        where: { isActive: true },
        include: {
          toppingRecipes: true,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.ingredient.findMany({
        select: { id: true, name: true, stock: true },
      }),
    ]);

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Không tìm thấy sản phẩm #${id}`,
        details: [{ productId: id }],
      });
    }

    const stockMap = new Map<number, number>(ingredients.map((i) => [i.id, i.stock]));
    const ingNameMap = new Map<number, string>(ingredients.map((i) => [i.id, i.name]));

    const productRef = { id: product.id, recipes: product.productRecipes };
    const stock = this.recipeService.maxCups(productRef, 'S', stockMap);
    const inStock = stock > 0;
    const bottleneck = this.recipeService.getBottleneck(productRef, 'S', stockMap, ingNameMap);

    const sizes = (Object.keys(SIZE_SURCHARGE) as SizeKey[]).map((size) => ({
      size,
      code: size,
      surcharge: SIZE_SURCHARGE[size],
      maxCups: this.recipeService.maxCups(productRef, size, stockMap),
    }));

    const toppingsWithAvailability = toppings.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      available: this.recipeService.isToppingAvailable(
        { id: t.id, recipes: t.toppingRecipes },
        stockMap,
      ),
    }));

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      stock,
      inStock,
      limitedBy: bottleneck.limitedBy,
      sizes,
      toppings: toppingsWithAvailability,
    };
  }
}
