import { Global, Module } from '@nestjs/common';
import { RecipeService } from './recipe.service.js';

@Global()
@Module({
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}
