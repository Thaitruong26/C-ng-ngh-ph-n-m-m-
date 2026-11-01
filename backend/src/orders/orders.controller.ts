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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { OrdersService } from './orders.service.js';
import type { UserContext } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo đơn hàng mới (Task 6, 10)',
    description:
      'Tạo đơn ở trạng thái PENDING, server tự tính giá bằng PricingService, giữ hàng bằng optimistic locking (Product.version).',
  })
  @ApiResponse({ status: 201, description: 'Tạo đơn thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  @ApiResponse({
    status: 409,
    description: 'Hết hàng (OUT_OF_STOCK) hoặc xung đột tồn kho (STOCK_CONFLICT)',
  })
  @ApiResponse({ status: 422, description: 'Lỗi mã khuyến mãi' })
  async createOrder(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Hàng đợi đơn của quán (Mở rộng Barista - Mục 6.15)',
    description:
      'Chỉ nhân viên Barista mới có quyền xem hàng đợi đơn hàng của quán.',
  })
  @ApiResponse({ status: 200, description: 'Lấy hàng đợi đơn thành công' })
  @ApiResponse({
    status: 403,
    description: 'Chỉ nhân viên Barista mới có quyền',
  })
  async getBaristaOrders(
    @CurrentUser() user: UserContext,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.getBaristaOrders(
      { status, page, limit },
      user,
    );
  }

  /**
   * GET /orders/me phải nằm trước GET /orders/:id
   * để "me" không bị hiểu thành ID.
   */
  @Get('me')
  @ApiOperation({
    summary: 'Lịch sử đơn hàng của tôi (Task 9)',
    description:
      'Chỉ trả danh sách đơn của người dùng hiện tại, sắp xếp mới nhất trước, có phân trang.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử đơn thành công' })
  async getOrdersMe(
    @CurrentUser() user: UserContext,
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.ordersService.getOrdersMe(user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết đơn hàng (Task 9)',
    description:
      'Chi tiết đơn hàng kèm danh sách món, lịch sử thanh toán và điểm thưởng tích lũy.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết đơn thành công' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem đơn hàng của người khác',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  async getOrderById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.getOrderById(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hủy đơn hàng (Task 10)',
    description:
      'Chủ đơn hoặc barista hủy đơn: hoàn lại tồn kho, hoàn usedCount mã giảm giá, thu hồi điểm.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Hủy đơn thành công' })
  @ApiResponse({
    status: 409,
    description:
      'Chuyển trạng thái sai (INVALID_TRANSITION) hoặc đang thanh toán (PAYMENT_IN_PROGRESS)',
  })
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.cancelOrder(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Barista cập nhật trạng thái đơn (Task 10 & Mở rộng Barista)',
    description:
      'Chỉ barista có quyền chuyển bước đơn hàng (PAID → PREPARING → READY → COMPLETED).',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái thành công',
  })
  @ApiResponse({
    status: 403,
    description: 'Chỉ nhân viên Barista mới có quyền',
  })
  @ApiResponse({
    status: 409,
    description: 'Bước chuyển trạng thái không hợp lệ (INVALID_TRANSITION)',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.updateOrderStatus(id, dto.status, user);
  }
}