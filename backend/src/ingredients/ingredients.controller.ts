import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { IngredientsService } from './ingredients.service.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { GetIngredientsQueryDto } from './dto/get-ingredients-query.dto.js';
import { AddIngredientStockDto } from './dto/add-ingredient-stock.dto.js';
import { AdjustIngredientStockDto } from './dto/adjust-ingredient-stock.dto.js';

@ApiTags('Ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  /** 4.1. GET /ingredients (Công khai hoặc Barista) */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nguyên liệu và tồn kho' })
  @ApiResponse({ status: 200, description: 'Danh sách nguyên liệu thành công' })
  findAll(@Query() query: GetIngredientsQueryDto) {
    return this.ingredientsService.findAll(query);
  }

  /** 4.2. POST /ingredients */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mới nguyên liệu (Barista)' })
  @ApiResponse({ status: 201, description: 'Tạo nguyên liệu thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Chỉ Barista có quyền' })
  @ApiResponse({ status: 409, description: 'Tên nguyên liệu đã tồn tại' })
  create(@Body() dto: CreateIngredientDto, @CurrentUser() user: any) {
    return this.ingredientsService.create(dto, user?.id);
  }

  /** 4.3. PATCH /ingredients/:id */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiOperation({ summary: 'Cập nhật thông tin nguyên liệu (Barista)' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nguyên liệu' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, dto);
  }

  /** 4.4. POST /ingredients/:id/stock (Nhập kho từ Quầy Barista) */
  @Post(':id/stock')
  @ApiOperation({ summary: 'Nhập thêm tồn kho nguyên liệu (Barista)' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu', example: 1 })
  @ApiResponse({ status: 200, description: 'Nhập kho thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nguyên liệu' })
  addStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddIngredientStockDto,
    @CurrentUser() user: any,
  ) {
    return this.ingredientsService.addStock(id, dto, user?.id);
  }

  /** 4.5. POST /ingredients/:id/adjust */
  @Post(':id/adjust')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiOperation({ summary: 'Kiểm kê hoặc ghi nhận hao hụt nguyên liệu (Barista)' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu', example: 1 })
  @ApiResponse({ status: 200, description: 'Điều chỉnh tồn kho thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ (thiếu lý do)' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nguyên liệu' })
  adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdjustIngredientStockDto,
    @CurrentUser() user: any,
  ) {
    return this.ingredientsService.adjustStock(id, dto, user?.id);
  }

  /** 4.6. GET /ingredients/:id/movements */
  @Get(':id/movements')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiOperation({ summary: 'Nhật ký biến động tồn kho của một nguyên liệu (Barista)' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu', example: 1 })
  @ApiResponse({ status: 200, description: 'Lấy nhật ký thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nguyên liệu' })
  getMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.ingredientsService.getMovements(id, pageNum, limitNum);
  }
}
