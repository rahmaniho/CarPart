import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Order } from '../orders/entities/order.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SellersModule } from '../sellers/sellers.module';
import { CouriersModule } from '../couriers/couriers.module';
import { Commission } from './entities/commission.entity';
import { PayoutLine } from './entities/payout-line.entity';
import { Payout } from './entities/payout.entity';
import { CommissionService } from './commission.service';
import { AdminFinanceController, CourierFinanceController, SellerFinanceController } from './finance.controller';
import { PayoutsService } from './payouts.service';
import { PricingService } from './pricing.service';

/**
 * ماژول مالی (سراسری).
 * سرویس قیمت‌گذاری در همه ماژول‌ها در دسترس است تا قواعد پولی در یک نقطه متمرکز بماند.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Commission, Payout, PayoutLine, Order, Seller, Delivery, CourierProfile]), SellersModule, CouriersModule],
  controllers: [SellerFinanceController, CourierFinanceController, AdminFinanceController],
  providers: [PricingService, CommissionService, PayoutsService],
  exports: [PricingService, CommissionService, PayoutsService, TypeOrmModule],
})
export class FinanceModule {}
