import { Column, Entity, Index } from 'typeorm';
import type { DeliveryStatus } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/** رویدادهای مأموریت ارسال — شامل گزارش مشکل، تغییر وضعیت و نمونه موقعیت. */
@Entity('delivery_events')
@Index(['deliveryId', 'createdAt'])
export class DeliveryEvent extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  deliveryId!: string;

  @Column({ length: 48 })
  type!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status!: DeliveryStatus | null;

  @Column({ type: 'text' })
  faDescription!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @Column({ length: 16, default: 'user' })
  actorType!: 'user' | 'system' | 'admin' | 'courier' | 'seller';

  @Column({ type: 'float', nullable: true })
  lat!: number | null;

  @Column({ type: 'float', nullable: true })
  lng!: number | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
