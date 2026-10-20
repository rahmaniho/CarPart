import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Payout } from '../finance/entities/payout.entity';
import { User } from '../users/entities/user.entity';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';
import { CourierLocation } from './entities/courier-location.entity';
import { CourierProfile } from './entities/courier-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CourierProfile, CourierLocation, Delivery, Payout, User])],
  controllers: [CouriersController],
  providers: [CouriersService],
  exports: [CouriersService],
})
export class CouriersModule {}
