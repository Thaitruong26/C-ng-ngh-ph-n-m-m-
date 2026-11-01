import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { OrdersModule } from '../orders/orders.module.js';

@Module({
  imports: [LoyaltyModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
