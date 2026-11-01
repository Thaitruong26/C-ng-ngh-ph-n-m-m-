import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Length, Min } from 'class-validator';

export class AdjustIngredientStockDto {
  @ApiProperty({ description: 'Số tồn thực tế đếm được sau kiểm kê', example: 1750, minimum: 0 })
  @IsInt({ message: 'Số tồn thực tế phải là số nguyên' })
  @Min(0, { message: 'Số tồn thực tế không được âm' })
  actualStock: number;

  @ApiProperty({ description: 'Lý do điều chỉnh kiểm kê hoặc hao hụt', example: 'Đổ vỡ 50ml khi pha' })
  @IsString({ message: 'Lý do phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do không được để trống' })
  @Length(3, 200, { message: 'Lý do phải từ 3 đến 200 ký tự' })
  reason: string;
}
