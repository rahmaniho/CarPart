import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Part } from '../catalog/entities/part.entity';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Commission } from '../finance/entities/commission.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { PartRequest } from '../requests/entities/part-request.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SupportModule } from '../support/support.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { Workshop } from '../workshops/entities/workshop.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { VerificationsService } from './verifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Seller, CourierProfile, Workshop, Part, SellerProduct, PartRequest, Order, Commission, Delivery]),
    UsersModule,
    OrdersModule,
    PaymentsModule,
    SupportModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, VerificationsService],
  exports: [AdminService, VerificationsService],
})
export class AdminModule {}
