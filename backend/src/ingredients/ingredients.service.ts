import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { GetIngredientsQueryDto } from './dto/get-ingredients-query.dto.js';
import { AddIngredientStockDto } from './dto/add-ingredient-stock.dto.js';
import { AdjustIngredientStockDto } from './dto/adjust-ingredient-stock.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /ingredients */
  async findAll(query: GetIngredientsQueryDto) {
    const where: any = {};
    if (query.search?.trim()) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const all = await this.prisma.ingredient.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    let filtered = all.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stock: i.stock,
      lowThreshold: i.lowThreshold,
      low: i.stock <= i.lowThreshold,
    }));

    if (query.low) {
      filtered = filtered.filter((i) => i.low);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);
    const data = filtered.slice((page - 1) * limit, page * limit);

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

  /** POST /ingredients */
  async create(dto: CreateIngredientDto, userId?: number) {
    const existing = await this.prisma.ingredient.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException({
        code: 'INGREDIENT_ALREADY_EXISTS',
        message: `Nguyên liệu '${dto.name}' đã tồn tại`,
      });
    }

    const initialStock = dto.stock ?? 0;
    const lowThreshold = dto.lowThreshold ?? 0;

    return await this.prisma.$transaction(async (tx) => {
      const created = await tx.ingredient.create({
        data: {
          name: dto.name,
          unit: dto.unit,
          stock: initialStock,
          lowThreshold,
          version: 0,
        },
      });

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            ingredientId: created.id,
            type: 'RESTOCK',
            quantity: initialStock,
            userId: userId ?? null,
            reason: 'Khởi tạo tồn kho ban đầu',
          },
        });
      }

      return {
        id: created.id,
        name: created.name,
        unit: created.unit,
        stock: created.stock,
        lowThreshold: created.lowThreshold,
        low: created.stock <= created.lowThreshold,
      };
    });
  }

  /** PATCH /ingredients/:id */
  async update(id: number, dto: UpdateIngredientDto) {
    const existing = await this.prisma.ingredient.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'INGREDIENT_NOT_FOUND',
        message: `Không tìm thấy nguyên liệu #${id}`,
      });
    }

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.lowThreshold !== undefined ? { lowThreshold: dto.lowThreshold } : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      unit: updated.unit,
      stock: updated.stock,
      lowThreshold: updated.lowThreshold,
      low: updated.stock <= updated.lowThreshold,
    };
  }

  /** POST /ingredients/:id/stock */
  async addStock(id: number, dto: AddIngredientStockDto, userId?: number) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.ingredient.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'INGREDIENT_NOT_FOUND',
          message: `Không tìm thấy nguyên liệu #${id}`,
        });
      }

      const updated = await tx.ingredient.update({
        where: { id },
        data: {
          stock: { increment: dto.quantity },
          version: { increment: 1 },
        },
      });

      await tx.stockMovement.create({
        data: {
          ingredientId: id,
          type: 'RESTOCK',
          quantity: dto.quantity,
          userId: userId ?? null,
          reason: dto.note || null,
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        unit: updated.unit,
        stock: updated.stock,
        low: updated.stock <= updated.lowThreshold,
      };
    });
  }

  /** POST /ingredients/:id/adjust */
  async adjustStock(id: number, dto: AdjustIngredientStockDto, userId?: number) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.ingredient.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'INGREDIENT_NOT_FOUND',
          message: `Không tìm thấy nguyên liệu #${id}`,
        });
      }

      const diff = dto.actualStock - existing.stock;
      if (diff === 0) {
        return {
          id: existing.id,
          stock: existing.stock,
          diff: 0,
        };
      }

      const updated = await tx.ingredient.update({
        where: { id },
        data: {
          stock: dto.actualStock,
          version: { increment: 1 },
        },
      });

      await tx.stockMovement.create({
        data: {
          ingredientId: id,
          type: 'ADJUST',
          quantity: diff,
          userId: userId ?? null,
          reason: dto.reason,
        },
      });

      return {
        id: updated.id,
        stock: updated.stock,
        diff,
      };
    });
  }

  /** GET /ingredients/:id/movements */
  async getMovements(id: number, page = 1, limit = 20) {
    const existing = await this.prisma.ingredient.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'INGREDIENT_NOT_FOUND',
        message: `Không tìm thấy nguyên liệu #${id}`,
      });
    }

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.stockMovement.count({ where: { ingredientId: id } }),
      this.prisma.stockMovement.findMany({
        where: { ingredientId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data: items.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        orderId: m.orderId,
        userId: m.userId,
        reason: m.reason,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /** GET /products/:id/recipe */
  async getProductRecipe(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Không tìm thấy sản phẩm #${productId}`,
      });
    }

    const items = await this.prisma.productRecipe.findMany({
      where: { productId },
      include: { ingredient: true },
      orderBy: { ingredientId: 'asc' },
    });

    return {
      productId,

      items: items.map((i) => ({
        ingredientId: i.ingredientId,
        name: i.ingredient.name,
        unit: i.ingredient.unit,
        quantity: i.quantity,
      })),
    };
  }

  /** PUT /products/:id/recipe */
  async updateProductRecipe(productId: number, dto: UpdateRecipeDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Không tìm thấy sản phẩm #${productId}`,
      });
    }

    // Kiểm tra trùng lặp ingredientId
    const ingredientIds = dto.items.map((i) => i.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Trùng lặp nguyên liệu trong công thức',
      });
    }

    if (ingredientIds.length > 0) {
      const existingIngs = await this.prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true },
      });
      if (existingIngs.length !== ingredientIds.length) {
        throw new NotFoundException({
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Một hoặc nhiều nguyên liệu không tồn tại',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productRecipe.deleteMany({
        where: { productId },
      });

      if (dto.items.length > 0) {
        await tx.productRecipe.createMany({
          data: dto.items.map((i) => ({
            productId,

            ingredientId: i.ingredientId,
            quantity: i.quantity,
          })),
        });
      }
    });

    return this.getProductRecipe(productId);
  }

  /** GET /toppings/:id/recipe */
  async getToppingRecipe(toppingId: number) {
    const topping = await this.prisma.topping.findUnique({
      where: { id: toppingId },
    });
    if (!topping) {
      throw new NotFoundException({
        code: 'TOPPING_NOT_FOUND',
        message: `Không tìm thấy topping #${toppingId}`,
      });
    }

    const items = await this.prisma.toppingRecipe.findMany({
      where: { toppingId },
      include: { ingredient: true },
      orderBy: { ingredientId: 'asc' },
    });

    return {
      toppingId,
      items: items.map((i) => ({
        ingredientId: i.ingredientId,
        name: i.ingredient.name,
        unit: i.ingredient.unit,
        quantity: i.quantity,
      })),
    };
  }

  /** PUT /toppings/:id/recipe */
  async updateToppingRecipe(toppingId: number, dto: UpdateRecipeDto) {
    const topping = await this.prisma.topping.findUnique({
      where: { id: toppingId },
    });
    if (!topping) {
      throw new NotFoundException({
        code: 'TOPPING_NOT_FOUND',
        message: `Không tìm thấy topping #${toppingId}`,
      });
    }

    const ingredientIds = dto.items.map((i) => i.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Trùng lặp nguyên liệu trong công thức topping',
      });
    }

    if (ingredientIds.length > 0) {
      const existingIngs = await this.prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true },
      });
      if (existingIngs.length !== ingredientIds.length) {
        throw new NotFoundException({
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Một hoặc nhiều nguyên liệu không tồn tại',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.toppingRecipe.deleteMany({
        where: { toppingId },
      });

      if (dto.items.length > 0) {
        await tx.toppingRecipe.createMany({
          data: dto.items.map((i) => ({
            toppingId,
            ingredientId: i.ingredientId,
            quantity: i.quantity,
          })),
        });
      }
    });

    return this.getToppingRecipe(toppingId);
  }
}
