import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { SellersModule } from '../sellers/sellers.module';
import { User } from '../users/entities/user.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { AdminSupportController, SellerReturnsController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, TicketMessage, ReturnRequest, Order, OrderItem, User]), OrdersModule, SellersModule],
  controllers: [SupportController, SellerReturnsController, AdminSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
