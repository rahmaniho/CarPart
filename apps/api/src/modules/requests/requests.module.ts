import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Part } from '../catalog/entities/part.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { Review } from '../reviews/entities/review.entity';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SellersModule } from '../sellers/sellers.module';
import { Vehicle } from '../workshops/entities/vehicle.entity';
import { WorkshopsModule } from '../workshops/workshops.module';
import { PartRequest } from './entities/part-request.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Quote } from './entities/quote.entity';
import { QuotesService } from './quotes.service';
import { RequestJobHandlers } from './request-job.handlers';
import { RequestsController, SellerRequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartRequest, Quote, QuoteItem, Seller, SellerBranch, SellerProduct, Part, Review, Vehicle, Order]),
    WorkshopsModule,
    SellersModule,
    CatalogModule,
    OrdersModule,
  ],
  controllers: [RequestsController, SellerRequestsController],
  providers: [RequestsService, QuotesService, RequestJobHandlers],
  exports: [RequestsService, QuotesService],
})
export class RequestsModule {}
