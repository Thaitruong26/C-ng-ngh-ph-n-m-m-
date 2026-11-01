import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client.js';

export class GetOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Trang hiện tại (bắt đầu từ 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số đơn hàng mỗi trang (tối đa 50)',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(50, { message: 'limit tối đa là 50' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái đơn hàng',
    enum: OrderStatus,
  })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status không hợp lệ' })
  status?: OrderStatus;
}
