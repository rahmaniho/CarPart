import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { PaymentEvent } from './entities/payment-event.entity';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { AdminPaymentsController, PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentEvent, Refund]), OrdersModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, RefundsService],
  exports: [PaymentsService, RefundsService],
})
export class PaymentsModule {}
