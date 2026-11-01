import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class RecipeItemDto {
  @ApiProperty({ description: 'ID nguyên liệu', example: 1 })
  @IsInt({ message: 'ingredientId phải là số nguyên' })
  @Min(1, { message: 'ingredientId phải lớn hơn 0' })
  ingredientId: number;

  @ApiProperty({ description: 'Định lượng (size M với món, 1 phần với topping)', example: 18 })
  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity phải lớn hơn 0' })
  quantity: number;
}

export class UpdateRecipeDto {
  @ApiProperty({ description: 'Danh sách nguyên liệu trong công thức (tối đa 20 dòng, gửi [] để xóa)', type: [RecipeItemDto] })
  @IsArray({ message: 'items phải là một mảng' })
  @ArrayMaxSize(20, { message: 'Công thức tối đa 20 nguyên liệu' })
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items: RecipeItemDto[];
}
