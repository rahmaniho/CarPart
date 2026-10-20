import { Module } from '@nestjs/common';
import { CouriersModule } from '../modules/couriers/couriers.module';
import { OrdersModule } from '../modules/orders/orders.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { RequestsModule } from '../modules/requests/requests.module';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [RequestsModule, OrdersModule, PaymentsModule, CouriersModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
