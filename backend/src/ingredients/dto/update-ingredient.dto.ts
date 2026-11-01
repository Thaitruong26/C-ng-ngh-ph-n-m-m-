import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateIngredientDto {
  @ApiPropertyOptional({ description: 'Tên nguyên liệu', example: 'Đường mía' })
  @IsOptional()
  @IsString({ message: 'Tên nguyên liệu phải là chuỗi' })
  name?: string;

  @ApiPropertyOptional({ description: 'Ngưỡng cảnh báo sắp hết', example: 800 })
  @IsOptional()
  @IsInt({ message: 'Ngưỡng cảnh báo phải là số nguyên' })
  @Min(0, { message: 'Ngưỡng cảnh báo không được âm' })
  lowThreshold?: number;
}
