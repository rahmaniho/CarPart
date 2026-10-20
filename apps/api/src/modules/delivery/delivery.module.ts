import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierLocation } from '../couriers/entities/courier-location.entity';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { CouriersModule } from '../couriers/couriers.module';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { User } from '../users/entities/user.entity';
import { AdminDeliveriesController, CourierDeliveriesController, DeliveryTrackingController } from './delivery.controller';
import { DeliveryJobHandlers } from './delivery-job.handlers';
import { DeliveryService } from './delivery.service';
import { DeliveryEvent } from './entities/delivery-event.entity';
import { Delivery } from './entities/delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, DeliveryEvent, CourierProfile, CourierLocation, Seller, SellerBranch, Order, User]),
    OrdersModule,
    CouriersModule,
  ],
  controllers: [CourierDeliveriesController, DeliveryTrackingController, AdminDeliveriesController],
  providers: [DeliveryService, DeliveryJobHandlers],
  exports: [DeliveryService],
})
export class DeliveryModule {}
