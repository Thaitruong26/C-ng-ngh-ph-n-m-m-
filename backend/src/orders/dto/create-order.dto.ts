import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Size } from '../../generated/prisma/client.js';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'ID của sản phẩm',
    example: 3,
  })
  @IsInt({ message: 'productId phải là số nguyên' })
  @Min(1, { message: 'productId phải lớn hơn 0' })
  productId!: number;

  @ApiProperty({
    description: 'Size đồ uống (S, M, L)',
    enum: Size,
    example: Size.M,
  })
  @IsEnum(Size, {
    message: 'size phải là một trong các giá trị: S, M, L',
  })
  size!: Size;

  @ApiPropertyOptional({
    description: 'Danh sách ID topping (tối đa 3 topping)',
    type: [Number],
    example: [1],
  })
  @IsOptional()
  @IsArray({ message: 'toppingIds phải là một mảng số' })
  @ArrayMaxSize(3, {
    message: 'Mỗi ly chỉ được chọn tối đa 3 topping',
  })
  @IsInt({
    each: true,
    message: 'Mỗi phần tử trong toppingIds phải là số nguyên',
  })
  @Min(1, {
    each: true,
    message: 'Mỗi topping ID phải lớn hơn 0',
  })
  toppingIds?: number[];

  @ApiProperty({
    description: 'Số lượng ly',
    example: 1,
    minimum: 1,
    maximum: 20,
  })
  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity tối thiểu là 1' })
  @Max(20, { message: 'quantity tối đa là 20' })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Ghi chú cho món (ví dụ: ít đá, ít ngọt)',
    example: 'ít đá',
  })
  @IsOptional()
  @IsString({ message: 'note phải là chuỗi ký tự' })
  @MaxLength(200, { message: 'note tối đa 200 ký tự' })
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Danh sách các món đồ uống trong giỏ hàng (1 - 30 món)',
    type: [CreateOrderItemDto],
  })
  @IsArray({ message: 'items phải là một mảng' })
  @ArrayMinSize(1, {
    message: 'Giỏ hàng phải có ít nhất 1 sản phẩm',
  })
  @ArrayMaxSize(30, {
    message: 'Giỏ hàng tối đa 30 sản phẩm',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Mã giảm giá áp dụng (nếu có)',
    example: 'BREW10',
  })
  @IsOptional()
  @IsString({ message: 'promoCode phải là chuỗi' })
  @MaxLength(50, {
    message: 'promoCode tối đa 50 ký tự',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  promoCode?: string;
}