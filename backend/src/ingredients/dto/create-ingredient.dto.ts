import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { IngredientUnit } from '../../generated/prisma/client.js';

export class CreateIngredientDto {
  @ApiProperty({ description: 'Tên nguyên liệu (duy nhất)', example: 'Đường' })
  @IsString({ message: 'Tên nguyên liệu phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên nguyên liệu không được để trống' })
  name: string;

  @ApiProperty({ description: 'Đơn vị đo', enum: IngredientUnit, example: IngredientUnit.G })
  @IsEnum(IngredientUnit, { message: 'Đơn vị phải là G, ML hoặc PCS' })
  unit: IngredientUnit;

  @ApiPropertyOptional({ description: 'Tồn kho ban đầu', example: 5000, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Tồn kho phải là số nguyên' })
  @Min(0, { message: 'Tồn kho không được âm' })
  stock?: number;

  @ApiPropertyOptional({ description: 'Ngưỡng cảnh báo sắp hết', example: 500, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Ngưỡng cảnh báo phải là số nguyên' })
  @Min(0, { message: 'Ngưỡng cảnh báo không được âm' })
  lowThreshold?: number;
}
