import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationDispatchHandler } from './notification-dispatch.handler';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsGateway } from './sms.gateway';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationsService, SmsGateway, NotificationDispatchHandler],
  controllers: [NotificationsController],
  exports: [NotificationsService, SmsGateway],
})
export class NotificationsModule {}
