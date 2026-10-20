import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementService } from './announcement.service';
import { SettingsController } from './settings.controller';
import { SystemSetting } from './entities/system-setting.entity';
import { Announcement } from './entities/announcement.entity';
import { SystemSettingsService } from './system-settings.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting, Announcement])],
  controllers: [SettingsController],
  providers: [SystemSettingsService, AnnouncementService],
  exports: [SystemSettingsService, AnnouncementService],
})
export class SettingsModule {}
