import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartBrand } from './entities/part-brand.entity';
import { PartCategory } from './entities/part-category.entity';
import { PartCompatibility } from './entities/part-compatibility.entity';
import { Part } from './entities/part.entity';
import { VehicleMake, VehicleModel, VehicleVariant } from './entities/vehicle-catalog.entity';
import { Review } from '../reviews/entities/review.entity';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Vehicle } from '../workshops/entities/vehicle.entity';
import { CatalogAdminController, CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { RankingService } from './ranking.service';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartCategory,
      PartBrand,
      VehicleMake,
      VehicleModel,
      VehicleVariant,
      Part,
      PartCompatibility,
      SellerProduct,
      SellerBranch,
      Seller,
      Review,
      Vehicle,
    ]),
  ],
  providers: [CatalogService, SearchService, RankingService],
  controllers: [CatalogController, CatalogAdminController],
  exports: [CatalogService, SearchService, RankingService],
})
export class CatalogModule {}
