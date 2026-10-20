import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleModel, VehicleVariant } from '../catalog/entities/vehicle-catalog.entity';
import { Favorite } from './entities/favorite.entity';
import { Vehicle } from './entities/vehicle.entity';
import { WorkshopAddress } from './entities/workshop-address.entity';
import { Workshop } from './entities/workshop.entity';
import { WorkshopsController } from './workshops.controller';
import { WorkshopsService } from './workshops.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workshop, WorkshopAddress, Vehicle, Favorite, VehicleModel, VehicleVariant])],
  controllers: [WorkshopsController],
  providers: [WorkshopsService],
  exports: [WorkshopsService],
})
export class WorkshopsModule {}
