import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client.js';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Trạng thái chuyển tiếp tiếp theo (PREPARING, READY, COMPLETED)',
    enum: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED],
    example: OrderStatus.PREPARING,
  })
  @IsIn([OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED], {
    message: 'Trạng thái chỉ có thể là PREPARING, READY hoặc COMPLETED',
  })
  status: OrderStatus;
}
