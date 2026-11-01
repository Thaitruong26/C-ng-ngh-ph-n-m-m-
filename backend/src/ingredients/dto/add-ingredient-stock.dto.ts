import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AddIngredientStockDto {
  @ApiProperty({ description: 'Số lượng nhập thêm', example: 5000, minimum: 1, maximum: 1000000 })
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(1000000, { message: 'Số lượng tối đa là 1.000.000' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Ghi chú lý do nhập hàng', example: 'Nhập hàng sáng' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(200, { message: 'Ghi chú tối đa 200 ký tự' })
  note?: string;
}
