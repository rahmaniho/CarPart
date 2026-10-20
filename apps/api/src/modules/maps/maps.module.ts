import { Global, Module } from '@nestjs/common';
import { MapService } from './map.service';

@Global()
@Module({
  providers: [MapService],
  exports: [MapService],
})
export class MapsModule {}
