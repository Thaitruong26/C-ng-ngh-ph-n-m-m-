import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
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
import { ProductsService } from './products.service.js';
import { GetProductsDto } from './dto/get-products.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { IngredientsService } from '../ingredients/ingredients.service.js';
import { UpdateRecipeDto } from '../ingredients/dto/update-recipe.dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly ingredientsService: IngredientsService,
  ) {}

  /** GET /api/products */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm (menu), hỗ trợ tìm kiếm, lọc theo danh mục và phân trang' })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm kèm thông tin phân trang' })
  @ApiResponse({ status: 400, description: 'Tham số truy vấn không hợp lệ' })
  findAll(@Query() query: GetProductsDto) {
    return this.productsService.findAll(query);
  }

  /** GET /api/products/:id */
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một sản phẩm kèm danh sách kích thước (sizes) và toppings' })
  @ApiParam({ name: 'id', description: 'ID của sản phẩm', type: Number, example: 3 })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết sản phẩm' })
  @ApiResponse({ status: 400, description: 'ID không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  /** 4.7. GET /api/products/:id/recipe (Barista) */
  @Get(':id/recipe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy công thức sản phẩm ở size M (Barista)' })
  @ApiParam({ name: 'id', description: 'ID sản phẩm', example: 1 })
  @ApiResponse({ status: 200, description: 'Lấy công thức thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Chỉ Barista có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm' })
  getProductRecipe(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.getProductRecipe(id);
  }

  /** 4.7. PUT /api/products/:id/recipe (Barista) */
  @Put(':id/recipe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật toàn bộ công thức sản phẩm ở size M (Barista)' })
  @ApiParam({ name: 'id', description: 'ID sản phẩm', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật công thức thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ (trùng nguyên liệu)' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Chỉ Barista có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm hoặc nguyên liệu' })
  updateProductRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.ingredientsService.updateProductRecipe(id, dto);
  }
}
