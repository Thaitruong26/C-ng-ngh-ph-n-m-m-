import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddStockDto {
  @ApiProperty({ description: 'Số lượng nhập thêm (1 - 1000)', example: 20, minimum: 1, maximum: 1000 })
  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity tối thiểu là 1' })
  @Max(1000, { message: 'quantity tối đa là 1000' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Ghi chú nhập kho', example: 'Nhập hàng buổi sáng' })
  @IsOptional()
  @IsString({ message: 'note phải là chuỗi ký tự' })
  note?: string;
}
