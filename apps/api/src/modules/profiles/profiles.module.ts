import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Workshop } from '../workshops/entities/workshop.entity';
import { ProfilesService } from './profiles.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Workshop, Seller, CourierProfile])],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
