import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponsModule } from '../coupons/coupons.module';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Commission } from '../finance/entities/commission.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';
import { PartRequest } from '../requests/entities/part-request.entity';
import { Quote } from '../requests/entities/quote.entity';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SellersModule } from '../sellers/sellers.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { OrderEvent } from './entities/order-event.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { AdminOrdersController, OrdersController, SellerOrdersController } from './orders.controller';
import { OrderJobHandlers } from './order-job.handlers';
import { OrdersService } from './orders.service';
import { OrderStateMachine } from './state-machine';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderEvent, SellerProduct, Seller, SellerBranch, Quote, PartRequest, Commission, Payment, Delivery, Refund]),
    SellersModule,
    WorkshopsModule,
    CouponsModule,
  ],
  controllers: [OrdersController, SellerOrdersController, AdminOrdersController],
  providers: [OrdersService, OrderStateMachine, OrderJobHandlers],
  exports: [OrdersService, OrderStateMachine],
})
export class OrdersModule {}
