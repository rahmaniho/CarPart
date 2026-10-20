import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Order } from '../orders/entities/order.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Review } from './entities/review.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Order, Delivery, Seller, CourierProfile])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
