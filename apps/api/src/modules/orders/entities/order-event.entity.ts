import { Column, Entity, Index } from 'typeorm';
import type { OrderStatus, Role } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/**
 * تاریخچه تغییر وضعیت و رویدادهای سفارش.
 * هر تغییر وضعیت با زمان، انجام‌دهنده و دلیل ثبت می‌شود و قابل حذف نیست.
 */
@Entity('order_events')
@Index(['orderId', 'createdAt'])
export class OrderEvent extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  orderId!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fromStatus!: OrderStatus | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  toStatus!: OrderStatus | null;

  /** نام عملیات، مانند transition / payment_created / stock_reserved */
  @Column({ length: 64 })
  action!: string;

  @Column({ type: 'text' })
  faDescription!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  actorRole!: Role | 'system' | null;

  @Column({ length: 16, default: 'user' })
  actorType!: 'user' | 'system' | 'admin';

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
