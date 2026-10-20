import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Part } from '../catalog/entities/part.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { Commission } from '../finance/entities/commission.entity';
import { Order } from '../orders/entities/order.entity';
import { Quote } from '../requests/entities/quote.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { SellerBranch } from './entities/seller-branch.entity';
import { SellerProduct } from './entities/seller-product.entity';
import { Seller } from './entities/seller.entity';
import { SellerProductsService } from './seller-products.service';
import { PublicSellersController, SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Seller, SellerBranch, SellerProduct, InventoryMovement, Part, Order, Quote, Commission]), CatalogModule],
  controllers: [SellersController, PublicSellersController],
  providers: [SellersService, SellerProductsService],
  exports: [SellersService, SellerProductsService],
})
export class SellersModule {}
