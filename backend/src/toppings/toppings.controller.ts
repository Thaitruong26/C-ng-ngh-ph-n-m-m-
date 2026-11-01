import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ToppingsService } from './toppings.service.js';
import { IngredientsService } from '../ingredients/ingredients.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { UpdateRecipeDto } from '../ingredients/dto/update-recipe.dto.js';

@ApiTags('toppings')
@Controller('toppings')
export class ToppingsController {
  constructor(
    private readonly toppingsService: ToppingsService,
    private readonly ingredientsService: IngredientsService,
  ) {}

  /** GET /api/toppings */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách topping đang kích hoạt' })
  @ApiResponse({ status: 200, description: 'Danh sách topping thành công' })
  findAll() {
    return this.toppingsService.findAll();
  }

  /** 4.8. GET /api/toppings/:id/recipe (Barista) */
  @Get(':id/recipe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy công thức topping cho 1 phần (Barista)' })
  @ApiParam({ name: 'id', description: 'ID topping', example: 1 })
  @ApiResponse({ status: 200, description: 'Lấy công thức thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Chỉ Barista có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy topping' })
  getToppingRecipe(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.getToppingRecipe(id);
  }

  /** 4.8. PUT /api/toppings/:id/recipe (Barista) */
  @Put(':id/recipe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật công thức topping cho 1 phần (Barista)' })
  @ApiParam({ name: 'id', description: 'ID topping', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật công thức topping thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ (trùng nguyên liệu)' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Chỉ Barista có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy topping hoặc nguyên liệu' })
  updateToppingRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.ingredientsService.updateToppingRecipe(id, dto);
  }
}
