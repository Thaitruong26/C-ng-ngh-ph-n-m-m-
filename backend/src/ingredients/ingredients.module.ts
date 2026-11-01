import { Global, Module } from '@nestjs/common';
import { IngredientsController } from './ingredients.controller.js';
import { IngredientsService } from './ingredients.service.js';

@Global()
@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
