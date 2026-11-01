import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from '../../orders/dto/create-order.dto.js';

export class ValidatePromotionDto {
  @ApiProperty({ description: 'Mã khuyến mãi', example: 'BREW10' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã khuyến mãi' })
  code: string;

  @ApiPropertyOptional({ description: 'Giá trị đơn hàng (nếu truyền trực tiếp)', example: 100000 })
  @IsOptional()
  @IsNumber({}, { message: 'orderValue phải là một số' })
  orderValue?: number;

  @ApiPropertyOptional({
    description: 'Danh sách món trong giỏ để server tự tính giá trị đơn',
    type: [CreateOrderItemDto],
  })
  @IsOptional()
  @IsArray({ message: 'items phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
